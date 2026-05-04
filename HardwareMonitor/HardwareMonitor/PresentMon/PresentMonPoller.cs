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

    // Frame-time-based FPS aggregation, indexed by PresentMon's own
    // CPUStartTime (column 8, ms since capture start) — NOT wall-clock
    // arrival. PresentMon delivers rows in ETW bursts (often a 300+ row
    // dump every other second), so an arrival-time window inflates 2-3x
    // during bursts even though the long-term rate matches the game.
    // Frame timestamps are immune to delivery jitter: 380 rows arriving
    // in 50ms still represent ~6 seconds of game time and trim correctly.
    // fps = N * 1000 / Σ frametime_ms — the same formula CapFrameX,
    // OCAT, and the Intel PresentMon SDK use.
    private const int FPS_WINDOW_MS = 1000;
    private const int FPS_STALE_MS = 1500;
    private readonly Queue<(double startTimeMs, float intervalMs)> _presentedFrames = new();
    private readonly Queue<(double startTimeMs, float intervalMs)> _displayedFrames = new();
    // Running sums kept in lockstep with the queues so UpdateFromBuffer is
    // O(1) instead of O(N). At 180-300 fps the queues hold ~180-300 entries
    // and ParseData's O(N) sum was burning lock-time on every row; pre-aggregating
    // means the lock-held block is just an enqueue + dequeue + arithmetic.
    private double _presentedSumMs;
    private double _displayedSumMs;
    private double _latestStartTimeMs;
    private long _lastRowArrivalMs;

    // FPS diagnostics. Counters live under _stateLock alongside the other
    // attribution state. Rollup task logs once per FPS_DIAG_WINDOW_MS so the
    // log line cadence matches what the overlay shows; raw-row dump is one-
    // shot and bounded so large CSVs don't bloat the log.
    private const int FPS_DIAG_WINDOW_MS = 1000;
    private const int RAW_ROWS_TO_LOG = 3;
    private int _rawRowsLogged;
    private readonly Dictionary<string, int> _countedByApp = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, int> _droppedByApp = new(StringComparer.OrdinalIgnoreCase);
    private int _shortRowCount;
    private int _totalRowCount;

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
        _ = LogFpsDiagnosticsAsync(stoppingToken);
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

        // One-shot raw-row dump verifies PresentMon's actual column layout
        // matches the hard-coded indices ([0]=app, [9]=frametime,
        // [17]=displayed). If PresentMon's CSV format changed, attribution
        // would silently read wrong columns — this catches that.
        var seen = Interlocked.Increment(ref _rawRowsLogged);
        if (seen <= RAW_ROWS_TO_LOG)
        {
            logger.LogDebug("[FPS-DEBUG] Raw row {N} ({Cols} cols): {Line}",
                seen, parts.Length, argsData);
        }

        Interlocked.Increment(ref _totalRowCount);
        if (parts.Length < 18)
        {
            Interlocked.Increment(ref _shortRowCount);
            return;
        }

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

            if (match)
                _countedByApp[rowApp] = _countedByApp.GetValueOrDefault(rowApp) + 1;
            else
                _droppedByApp[rowApp] = _droppedByApp.GetValueOrDefault(rowApp) + 1;

            if (!match) return;

            // Parse PresentMon's per-frame timestamps. CPUStartTime [8]
            // is monotonic ms since capture start; FrameTime [9] is the
            // present-to-present interval. fps = N * 1000 / Σ frametime
            // is independent of when the row arrived in our process,
            // which is the point — ETW burst delivery doesn't affect it.
            // Skip rows we can't parse or with non-positive frametime
            // (would NaN the sum or divide by zero downstream).
            if (!double.TryParse(parts[8], NumberStyles.Any, _cultureInfo, out var startMs)) return;
            if (!float.TryParse(parts[9], NumberStyles.Any, _cultureInfo, out var ftMs) || ftMs <= 0) return;

            if (startMs > _latestStartTimeMs) _latestStartTimeMs = startMs;
            _lastRowArrivalMs = nowMs;

            _presentedFrames.Enqueue((startMs, ftMs));
            _presentedSumMs += ftMs;
            UpdateFromBuffer(_presentedFrames, ref _presentedSumMs, Presented);

            // Displayed FPS uses the display-to-display interval (column
            // 17), NOT the present-to-present interval. The presented-FPS
            // and displayed-FPS values diverge whenever the display
            // refresh rate clamps the rendered framerate (e.g. 240fps
            // game on a 144Hz monitor displays ~144fps). Frames where
            // DisplayedTime is 0 were dropped before scan-out and don't
            // contribute to either count or sum.
            if (double.TryParse(parts[17], NumberStyles.Any, _cultureInfo, out var displayedTime)
                && displayedTime > 0)
            {
                var dtMs = (float)displayedTime;
                _displayedFrames.Enqueue((startMs, dtMs));
                _displayedSumMs += dtMs;
                UpdateFromBuffer(_displayedFrames, ref _displayedSumMs, Displayed);
            }

            // Raw per-frame value — graph plots history of this and gets
            // the high-frequency jitter that's diagnostic of stutters /
            // 1% lows. The averaged FPS reading is computed separately
            // from the buffer above; the two are intentionally different
            // shapes.
            Frametime.Value = ftMs;
        }
    }

    // Trims entries older than FPS_WINDOW_MS of game time (using PresentMon's
    // own CPUStartTime, NOT wall clock — see field comment above) and
    // recomputes the sensor value as fps = N * 1000 / Σ interval_ms. Maintains
    // the running sum by ref so the trim is O(K) on the entries actually
    // dequeued (typically 0-1 per call) rather than O(N) over the whole
    // buffer. Caller must hold _stateLock. Empty buffer → 0 fps.
    private void UpdateFromBuffer(Queue<(double startTimeMs, float intervalMs)> q, ref double sumMs, PresentMonSensor sensor)
    {
        while (q.Count > 0 && _latestStartTimeMs - q.Peek().startTimeMs > FPS_WINDOW_MS)
        {
            sumMs -= q.Dequeue().intervalMs;
        }
        if (q.Count == 0 || sumMs <= 0)
        {
            sumMs = 0;
            sensor.Value = 0;
            return;
        }
        sensor.Value = (float)(q.Count * 1000.0 / sumMs);
    }

    public void SetSelectedApp(string appName)
    {
        lock (_stateLock)
        {
            // Drop prior app's frametimes so the 1s window doesn't blend
            // the new app's FPS with the old app's frame timings.
            _presentedFrames.Clear();
            _displayedFrames.Clear();
            _presentedSumMs = 0;
            _displayedSumMs = 0;
            _latestStartTimeMs = 0;
            Presented.Value = 0;
            Displayed.Value = 0;
            Frametime.Value = 0;
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

    // Once-per-second rollup of attribution outcomes. Logs which processes
    // contributed counted vs dropped rows in the just-elapsed window plus
    // the rolling-window queue sizes — directly comparable to whatever the
    // overlay is currently showing. If the overlay reads 425 fps but the
    // log shows counted={Game.exe:180}, the inflation is downstream of
    // here (queue-trim, sensor wiring); if the log shows
    // counted={Game.exe:425}, PresentMon is genuinely emitting 425
    // application rows/sec for the game and the bug is upstream (column
    // layout, FrameType, dual-presents in borderless).
    private async Task LogFpsDiagnosticsAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(FPS_DIAG_WINDOW_MS, cancellationToken);
            }
            catch (TaskCanceledException)
            {
                break;
            }

            Dictionary<string, int> counted, dropped;
            int total, shortRows;
            string fg, sel;
            int presentedQueue, displayedQueue;
            float fps, ft;
            bool stale;
            lock (_stateLock)
            {
                // Re-trim and recompute under the lock so the overlay value
                // refreshes even when PresentMon is between bursts (an
                // arrival-only path went stale here for up to a second). If
                // no row has arrived for FPS_STALE_MS, treat as paused /
                // alt-tabbed and zero everything out — otherwise the buffer
                // would keep showing the last burst's fps forever.
                var wallNow = Environment.TickCount64;
                stale = _lastRowArrivalMs == 0 || wallNow - _lastRowArrivalMs > FPS_STALE_MS;
                if (stale)
                {
                    _presentedFrames.Clear();
                    _displayedFrames.Clear();
                    _presentedSumMs = 0;
                    _displayedSumMs = 0;
                    Presented.Value = 0;
                    Displayed.Value = 0;
                    Frametime.Value = 0;
                }
                else
                {
                    UpdateFromBuffer(_presentedFrames, ref _presentedSumMs, Presented);
                    UpdateFromBuffer(_displayedFrames, ref _displayedSumMs, Displayed);
                    // Frametime intentionally not updated here — ParseData
                    // sets it raw per row so the overlay graph keeps its
                    // per-frame jitter. This branch only refreshes the
                    // averaged FPS counters that ParseData wouldn't update
                    // between bursts.
                }

                counted = new Dictionary<string, int>(_countedByApp, StringComparer.OrdinalIgnoreCase);
                dropped = new Dictionary<string, int>(_droppedByApp, StringComparer.OrdinalIgnoreCase);
                _countedByApp.Clear();
                _droppedByApp.Clear();
                total = Interlocked.Exchange(ref _totalRowCount, 0);
                shortRows = Interlocked.Exchange(ref _shortRowCount, 0);
                fg = _foregroundAppName;
                sel = _currentSelectedApp;
                presentedQueue = _presentedFrames.Count;
                displayedQueue = _displayedFrames.Count;
                fps = Presented.Value ?? 0f;
                ft = Frametime.Value ?? 0f;
            }
            var countedStr = counted.Count == 0
                ? "-"
                : string.Join(", ", counted.OrderByDescending(kv => kv.Value).Select(kv => $"{kv.Key}:{kv.Value}"));
            var droppedStr = dropped.Count == 0
                ? "-"
                : string.Join(", ", dropped.OrderByDescending(kv => kv.Value).Select(kv => $"{kv.Key}:{kv.Value}"));

            logger.LogDebug(
                "[FPS-DEBUG] fg={Fg} sel={Sel} fps={Fps:F1} ft={Ft:F2}ms buf.presented={QP} buf.displayed={QD} rows={Total} short={Short} stale={Stale} counted=[{Counted}] dropped=[{Dropped}]",
                string.IsNullOrEmpty(fg) ? "(empty)" : fg,
                sel,
                fps,
                ft,
                presentedQueue,
                displayedQueue,
                total,
                shortRows,
                stale,
                countedStr,
                droppedStr);
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
                        logger.LogDebug("[FPS-DEBUG] Foreground change: {Old} -> {New}",
                            string.IsNullOrEmpty(_foregroundAppName) ? "(empty)" : _foregroundAppName,
                            string.IsNullOrEmpty(newName) ? "(empty)" : newName);
                        _foregroundAppName = newName;
                        if (_currentSelectedApp == NO_SELECTED_APP)
                        {
                            _presentedFrames.Clear();
                            _displayedFrames.Clear();
                            _presentedSumMs = 0;
                            _displayedSumMs = 0;
                            _latestStartTimeMs = 0;
                            Presented.Value = 0;
                            Displayed.Value = 0;
                            Frametime.Value = 0;
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