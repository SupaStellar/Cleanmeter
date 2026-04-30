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

    private IHardware _hardware = new PresentMonHardware();
    public PresentMonSensor Displayed { get; private set; }
    public PresentMonSensor Presented { get; private set; }
    public PresentMonSensor Frametime { get; private set; }
    public HashSet<string> CurrentApps { get; private set; }

    public Action OnUpdateApps;

    private Process _process;
    private CultureInfo _cultureInfo = (CultureInfo)CultureInfo.CurrentCulture.Clone();

    private string _currentSelectedApp = NO_SELECTED_APP;

    // Foreground-window-derived process name (e.g. "MyGame.exe"). Used as the
    // implicit filter when the user picks "Auto" in the dropdown. Empty until
    // the first poll resolves a process. Updated on a background timer so we
    // don't pay the GetForegroundWindow + Process.GetProcessById cost on every
    // PresentMon CSV row.
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
        CurrentApps = [];

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
        CurrentApps.Add(parts[0]);

        // Determine which app's frames count for the rolling window.
        // - Manual selection: filter by exactly that app.
        // - Auto (NO_SELECTED_APP): filter by the current foreground process.
        //   This is what makes Auto actually auto-detect — without it, every
        //   un-ignored process's frames would be summed into one count.
        // If neither yields an app (foreground unresolved at startup), drop
        // the row rather than aggregate everything.
        var activeApp = _currentSelectedApp != NO_SELECTED_APP
            ? _currentSelectedApp
            : _foregroundAppName;

        if (string.IsNullOrEmpty(activeApp) || activeApp != parts[0])
        {
            return;
        }

        if (float.TryParse(parts[9], NumberStyles.Any, _cultureInfo, out var frametime))
        {
            Frametime.Value = frametime;
        }

        var nowMs = Environment.TickCount64;

        // Every CSV row is a present event — count them over 1000ms.
        _presentedTimestamps.Enqueue(nowMs);
        TrimWindow(_presentedTimestamps, nowMs);
        Presented.Value = _presentedTimestamps.Count;

        // Only count as a displayed frame when the scan-out interval is
        // non-zero (dropped frames report 0 here).
        if (float.TryParse(parts[17], NumberStyles.Any, _cultureInfo, out var displayed)
            && displayed > 0)
        {
            _displayedTimestamps.Enqueue(nowMs);
        }
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
        // Drop prior app's timestamps so the 1s window doesn't inflate the
        // new app's FPS for the first second after a switch.
        _presentedTimestamps.Clear();
        _displayedTimestamps.Clear();

        if (appName == "Auto")
        {
            _currentSelectedApp = NO_SELECTED_APP;
            return;
        }

        _currentSelectedApp = appName;
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
        CurrentApps.Clear();
        _ = ClearCurrentAppsAsync(cancellationToken);
    }

    // Tracks the current foreground process name. PresentMon emits process
    // names with the .exe suffix (e.g. "MyGame.exe"), so we match that format.
    // When the foreground app changes while in Auto mode, the rolling window
    // is cleared so the prior app's frames don't inflate the new app's count
    // for the first second. Polled rather than hooked because SetWinEventHook
    // requires a message pump, which this background service doesn't have.
    private async Task PollForegroundAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                var newName = "";
                var hwnd = GetForegroundWindow();
                if (hwnd != IntPtr.Zero)
                {
                    GetWindowThreadProcessId(hwnd, out var pid);
                    if (pid != 0)
                    {
                        try
                        {
                            using var proc = Process.GetProcessById((int)pid);
                            newName = proc.ProcessName + ".exe";
                        }
                        catch
                        {
                            // Process exited between the handle lookup and
                            // here, or is inaccessible — leave newName empty.
                        }
                    }
                }

                if (newName != _foregroundAppName)
                {
                    _foregroundAppName = newName;
                    if (_currentSelectedApp == NO_SELECTED_APP)
                    {
                        _presentedTimestamps.Clear();
                        _displayedTimestamps.Clear();
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