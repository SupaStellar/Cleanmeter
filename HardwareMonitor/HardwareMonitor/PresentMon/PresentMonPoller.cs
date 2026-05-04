using System.Collections.Concurrent;
using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using LibreHardwareMonitor.Hardware;
using Microsoft.Extensions.Logging;

// ReSharper disable FieldCanBeMadeReadOnly.Local
#pragma warning disable CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider adding the 'required' modifier or declaring as nullable.

namespace HardwareMonitor.PresentMon;

public class PresentMonPoller(ILogger logger)
{
    private const string NO_SELECTED_APP = "NONE";
    private const string AUTO_MODE = "Auto";

    private IHardware _hardware = new PresentMonHardware();
    public PresentMonSensor Displayed { get; private set; }
    public PresentMonSensor Presented { get; private set; }
    public PresentMonSensor Frametime { get; private set; }
    public HashSet<string> CurrentApps { get; private set; }

    public Action OnUpdateApps;

    private Process _process;
    private CultureInfo _cultureInfo = (CultureInfo)CultureInfo.CurrentCulture.Clone();

    // Serializes attribution-state transitions: foreground-app swap, manual
    // selection change, and the rolling-window queue clears that go with
    // them. Without this, ParseData (PresentMon callback thread) can enqueue
    // a frame against process A in the same instant PollForegroundAsync
    // swaps to process B and clears the queues, blending cross-process
    // frames into the count for up to FPS_WINDOW_MS.
    private readonly object _stateLock = new();

    private string _currentSelectedApp = NO_SELECTED_APP;

    // Wall-clock timestamp (TickCount64) of the most recent CSV row whose
    // process matched _currentSelectedApp. If a manually-selected app has
    // not been observed for SELECTED_APP_STALE_MS, ParseData falls back to
    // foreground filtering for that row so the overlay keeps tracking the
    // user's actual game instead of frozen at 0 fps. The dropdown stays as
    // the user left it; this only affects which frames count.
    private const int SELECTED_APP_STALE_MS = 5000;
    private long _lastSelectedAppMatchMs;

    // Foreground-window-derived process name (e.g. "MyGame.exe"). Used as the
    // implicit filter when the user picks "Auto" in the dropdown. Resolved
    // synchronously once in Start() before PresentMon emits any rows, then
    // refreshed on a background timer so we don't pay the
    // GetForegroundWindow + Process.GetProcessById cost on every CSV row.
    private const int FOREGROUND_POLL_MS = 500;
    private volatile string _foregroundAppName = "";

    // Rolling 1-second timestamp windows for frame-rate aggregation.
    // Each PresentMon CSV row is one frame; counting how many landed in the
    // last 1000ms gives classic frames-per-second, matching Afterburner/RTSS.
    // Without this, Value would be 1000/single_frametime — per-frame
    // instantaneous FPS, which is extremely noisy.
    // ConcurrentQueue rather than Queue: ParseData runs on the
    // OutputDataReceived background thread while SetSelectedApp/Clear can
    // fire from the UI thread, and Queue<T> is not thread-safe.
    private const int FPS_WINDOW_MS = 1000;
    private readonly ConcurrentQueue<long> _presentedTimestamps = new();
    private readonly ConcurrentQueue<long> _displayedTimestamps = new();

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    public async void Start(CancellationToken stoppingToken)
    {
        _cultureInfo.NumberFormat.NumberDecimalSeparator = ".";

        Displayed = new PresentMonSensor(_hardware, "displayed", 0, "Displayed Frames");
        Presented = new PresentMonSensor(_hardware, "presented", 1, "Presented Frames");
        Frametime = new PresentMonSensor(_hardware, "frametime", 2, "Frametime");
        // OrdinalIgnoreCase: PresentMon CSV column 0 is filesystem-cased
        // (e.g. "MyGame.EXE") while Process.ProcessName + ".exe" is whatever
        // Windows reports (often lowercase). A case-sensitive set would
        // populate the dropdown with duplicates and miss matches in the
        // foreground filter.
        CurrentApps = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        // Resolve the foreground app once, synchronously, before PresentMon
        // starts emitting rows. Without this, the first ~500ms of CSV output
        // is dropped (Auto mode) or attributed to stale state because
        // PollForegroundAsync hasn't had a tick yet.
        _foregroundAppName = ResolveForegroundProcessName();

        using var reader = new StreamReader(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ignored-processes.txt"));
        var text = (await reader.ReadToEndAsync())
            .Split("\n", StringSplitOptions.RemoveEmptyEntries)
            .Select(x => $"--exclude {x.Trim()}");
        var filteredApps = string.Join(" ", text);

        await TerminateCurrentPresentMon();
        var processStartInfo = new ProcessStartInfo
        {
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            FileName = "presentmon.exe",
            Arguments =
                $"--stop_existing_session --no_console_stats --output_stdout --session_name HardwareMonitor {filteredApps}",
        };
        logger.LogInformation("Starting PresentMon process with {Arguments}", processStartInfo.Arguments);

        _process = new Process();
        _process.StartInfo = processStartInfo;
        _process.OutputDataReceived += (sender, args) => ParseData(args.Data);
        _process.ErrorDataReceived += (sender, args) => logger.LogError(args.Data);

        _process.Start();
        _process.BeginOutputReadLine();
        _process.BeginErrorReadLine();

        _ = ClearCurrentAppsAsync(stoppingToken);
        _ = PollForegroundAsync(stoppingToken);
        await _process.WaitForExitAsync(stoppingToken);
    }

    public void Stop()
    {
        _process.Kill(true);
    }

    private void ParseData(string? argsData)
    {
        if (argsData == null) return;
        var parts = argsData.Split(",");
        if (parts.Length < 18) return;

        var rowApp = parts[0];
        var nowMs = Environment.TickCount64;

        bool match;
        lock (_stateLock)
        {
            // Add inside the lock — HashSet<T> is not thread-safe, and
            // CurrentApps is also touched by ClearCurrentAppsAsync (timer)
            // and MonitorPoller's SendPresentMonAppsToClients (pipe
            // serializer). The set is case-insensitive, so duplicate-cased
            // entries collapse.
            CurrentApps.Add(rowApp);


            // Decide attribution under the lock so a foreground swap or
            // manual-selection change can't slip in between the comparison
            // and the enqueue. Single comparison per branch — once we know
            // whether this row counts, the lock has nothing else to guard.
            // - Manual selection: row counts if it matches the picked app.
            //   If no row has matched the picked app for
            //   SELECTED_APP_STALE_MS (e.g. user picked slack.exe from a
            //   prior session and Slack isn't running), the row counts if
            //   it matches the foreground instead — keeps the overlay
            //   tracking the actual game without disturbing the dropdown.
            // - Auto: row counts if it matches the foreground.
            if (_currentSelectedApp != NO_SELECTED_APP)
            {
                if (string.Equals(_currentSelectedApp, rowApp, StringComparison.OrdinalIgnoreCase))
                {
                    _lastSelectedAppMatchMs = nowMs;
                    match = true;
                }
                else if (nowMs - _lastSelectedAppMatchMs > SELECTED_APP_STALE_MS
                         && !string.IsNullOrEmpty(_foregroundAppName)
                         && string.Equals(_foregroundAppName, rowApp, StringComparison.OrdinalIgnoreCase))
                {
                    match = true;
                }
                else
                {
                    match = false;
                }
            }
            else
            {
                match = !string.IsNullOrEmpty(_foregroundAppName)
                        && string.Equals(_foregroundAppName, rowApp, StringComparison.OrdinalIgnoreCase);
            }

            if (!match) return;

            // Every CSV row that gets here is a present event for the
            // active app. Enqueue under the lock so concurrent queue
            // clears (foreground swap, SetSelectedApp) can't drop this
            // frame mid-update.
            _presentedTimestamps.Enqueue(nowMs);

            // Only count as a displayed frame when the scan-out interval
            // is non-zero (dropped frames report 0 here).
            if (float.TryParse(parts[17], NumberStyles.Any, _cultureInfo, out var displayed)
                && displayed > 0)
            {
                _displayedTimestamps.Enqueue(nowMs);
            }
        }

        // Trimming and Value writes happen outside the lock — both queues
        // are ConcurrentQueue and the sensor Value writes are independent
        // of the attribution state. Holding the lock through TrimWindow
        // (which can dequeue hundreds of items per call) would stall
        // PollForegroundAsync at 500ms cadence on every row.
        if (float.TryParse(parts[9], NumberStyles.Any, _cultureInfo, out var frametime))
        {
            Frametime.Value = frametime;
        }
        TrimWindow(_presentedTimestamps, nowMs);
        Presented.Value = _presentedTimestamps.Count;
        TrimWindow(_displayedTimestamps, nowMs);
        Displayed.Value = _displayedTimestamps.Count;
    }

    private static void TrimWindow(ConcurrentQueue<long> q, long nowMs)
    {
        while (q.TryPeek(out var oldest) && nowMs - oldest > FPS_WINDOW_MS)
        {
            q.TryDequeue(out _);
        }
    }

    public void SetSelectedApp(string appName)
    {
        lock (_stateLock)
        {
            // Drop prior app's timestamps so the 1s window doesn't inflate
            // the new app's FPS for the first second after a switch.
            _presentedTimestamps.Clear();
            _displayedTimestamps.Clear();
            // Reset the stale-fallback clock so a freshly-picked app gets a
            // full SELECTED_APP_STALE_MS grace period before we'd ever
            // fall back to foreground attribution.
            _lastSelectedAppMatchMs = Environment.TickCount64;

            if (string.Equals(appName, AUTO_MODE, StringComparison.OrdinalIgnoreCase))
            {
                _currentSelectedApp = NO_SELECTED_APP;
                return;
            }

            _currentSelectedApp = appName;
        }
    }

    private async Task TerminateCurrentPresentMon()
    {
        var processStartInfo = new ProcessStartInfo
        {
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            FileName = "presentmon.exe",
            Arguments =
                $"--terminate_existing_session --no_console_stats --output_stdout --session_name HardwareMonitor",
        };
        logger.LogInformation("Starting PresentMon process with {Arguments}", processStartInfo.Arguments);

        var process = new Process();
        process.StartInfo = processStartInfo;
        process.Start();
        await process.WaitForExitAsync();
    }

    private async Task ClearCurrentAppsAsync(CancellationToken cancellationToken)
    {
        if (cancellationToken.IsCancellationRequested) return;
        await Task.Delay(10_000, cancellationToken);
        OnUpdateApps?.Invoke();
        lock (_stateLock)
        {
            CurrentApps.Clear();
        }
        _ = ClearCurrentAppsAsync(cancellationToken);
    }

    // Returns a point-in-time copy of CurrentApps for callers on other
    // threads (e.g. MonitorPoller serializing the dropdown payload to
    // the pipe). HashSet<T> is not safe to enumerate concurrently with
    // ParseData's Add, so the snapshot is taken under _stateLock.
    public string[] SnapshotCurrentApps()
    {
        lock (_stateLock)
        {
            var snapshot = new string[CurrentApps.Count];
            CurrentApps.CopyTo(snapshot);
            return snapshot;
        }
    }

    // Single foreground resolution — used both for the synchronous warm-up
    // call in Start() and for each tick of PollForegroundAsync. PresentMon
    // emits process names with the .exe suffix (e.g. "MyGame.exe"), so we
    // match that format. Returns "" if the foreground window can't be
    // resolved or the process exited mid-call.
    private static string ResolveForegroundProcessName()
    {
        var hwnd = GetForegroundWindow();
        if (hwnd == IntPtr.Zero) return "";
        GetWindowThreadProcessId(hwnd, out var pid);
        if (pid == 0) return "";
        try
        {
            using var proc = Process.GetProcessById((int)pid);
            return proc.ProcessName + ".exe";
        }
        catch
        {
            return "";
        }
    }

    // Tracks the current foreground process name. When the foreground app
    // changes while in Auto mode, the rolling window is cleared so the
    // prior app's frames don't inflate the new app's count for the first
    // second. Polled rather than hooked because SetWinEventHook requires a
    // message pump, which this background service doesn't have.
    private async Task PollForegroundAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                var newName = ResolveForegroundProcessName();

                // Both the field swap and the queue clear must be atomic
                // with ParseData's read+enqueue, otherwise frames from the
                // prior app can land in the new app's freshly-cleared
                // window.
                lock (_stateLock)
                {
                    if (!string.Equals(newName, _foregroundAppName, StringComparison.OrdinalIgnoreCase))
                    {
                        _foregroundAppName = newName;
                        if (_currentSelectedApp == NO_SELECTED_APP)
                        {
                            _presentedTimestamps.Clear();
                            _displayedTimestamps.Clear();
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Foreground poll failed");
            }

            try
            {
                await Task.Delay(FOREGROUND_POLL_MS, cancellationToken);
            }
            catch (TaskCanceledException)
            {
                break;
            }
        }
    }
}