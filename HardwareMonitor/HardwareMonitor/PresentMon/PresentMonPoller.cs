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
    public PresentMonSensor OnePercentLow { get; private set; }
    public PresentMonSensor ZeroPointOnePercentLow { get; private set; }

    public Action OnUpdateApps;

    // Apps seen presenting, against the TickCount64 of their most recent frame.
    //
    // This used to be a HashSet wiped in full every 10 seconds, immediately
    // after being pushed to the app, which made the settings dropdown a
    // 10-second sample of the machine rather than a list of apps: it emptied
    // itself whenever a game stopped presenting for a moment, and the settings
    // UI hid the whole control while it was empty. Ageing entries out one by
    // one keeps a running game listed across the gap.
    //
    // Case-insensitive for the same reason the old set was: PresentMon reports
    // column 0 in the exe's filesystem casing (e.g. "MyGame.EXE") while
    // Process.ProcessName + ".exe" is whatever Windows reports, and two
    // spellings would list the app twice and miss matches in the foreground
    // filter. The indexer keeps the first spelling seen, so the entry does not
    // flip casing under the user mid-session.
    private readonly Dictionary<string, long> _appLastSeenMs = new(StringComparer.OrdinalIgnoreCase);

    // How long an app stays listed after its last observed frame. Comfortably
    // longer than APP_PUSH_INTERVAL_MS so an app is never dropped between two
    // pushes, and long enough to survive alt-tabbing out of a game to reach
    // Settings, which is the only way to see the dropdown at all.
    private const int APP_TTL_MS = 30_000;
    private const int APP_PUSH_INTERVAL_MS = 10_000;

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

    // Percentile lows (1% / 0.1%) need a longer window than the 1s one above,
    // which holds ~120 frames at 120fps and so has no meaningful "worst 1%" at
    // all. There are two of them because MSI Afterburner has two, for the two
    // different questions being asked (see LowsMode):
    //
    //   _lowsLive   rolling ~10s window, the always-on overlay reading
    //   _lows       session-cumulative, an explicitly started benchmark run
    //
    // The live one is not a nicety. A session-cumulative figure cannot report
    // a recovery: banked slow frames keep the whole 1% time budget until the
    // fast run is 99x longer, so 30s capped at 60fps pins the 1% low at 60 for
    // the next 49 minutes of 240fps play. FrameLowsWindow has the arithmetic
    // and the RTSS documentation that says to use a ring for a permanently-on
    // reading.
    //
    // See FrameLows for why the session one is a histogram and not a list of
    // frametimes, and for which of the three competing "1% low" definitions
    // both implement.
    private const double ONE_PERCENT = 0.01;
    private const double ZERO_POINT_ONE_PERCENT = 0.001;
    private const double LOWS_MIN_TOTAL_MS = 5_000;
    // A short gap (alt-tab, a loading screen, a pause menu) must NOT wipe a
    // session-long statistic, so this deliberately survives the FPS_STALE_MS
    // zeroing that resets the 1s averages. It is dropped only once rows have
    // been absent long enough that the game is plainly gone, rather than
    // leaving a dead game's lows on screen at the desktop.
    private const int LOWS_ABANDON_MS = 30_000;
    private readonly FrameLows _lows = new();
    private readonly FrameLowsWindow _lowsLive = new();
    // The app whose frames are currently in the histogram. See the reset guard
    // in ParseData for why attribution is tracked here rather than inferred
    // from the selection or the foreground.
    private string _lowsApp = "";
    // What the published figures are measuring. Live at startup: the overlay
    // pill is on from launch, and RTSS's own guidance for a permanently-on
    // reading is a rolling window rather than an unbounded one.
    //
    // While Frozen both accumulators are inert — ParseData does not add to
    // them, the diagnostics loop does not recompute from them, and neither the
    // app-change guard nor the LOWS_ABANDON_MS sweep clears them. That
    // inertness is the point: a stopped run is a result, and alt-tabbing to
    // look at it, or quitting the game it measured, must not wipe the number
    // being read. Only an explicit mode change moves off it.
    //
    // While Recording the live window keeps filling even though nothing reads
    // it, so returning to Live shows a current number immediately instead of
    // blanking for the warm-up. It costs one enqueue per frame.
    //
    // Guarded by _stateLock like every other field here.
    private LowsMode _lowsMode = LowsMode.Live;

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

    // Restart policy for the PresentMon process. A denied trace session fails
    // the same way every time, so a failing start backs off instead of
    // spinning; a process that ran normally for PRESENTMON_HEALTHY_RUN_MS
    // before dying starts again from the short delay rather than inheriting an
    // old backoff.
    private const int PRESENTMON_MIN_RESTART_MS = 2_000;
    private const int PRESENTMON_MAX_RESTART_MS = 30_000;
    private const int PRESENTMON_HEALTHY_RUN_MS = 60_000;

    // Last app list written to the log, so a change is logged once rather than
    // on every push. Only touched by the push loop.
    private string _lastLoggedApps = "";

    // Whether the PresentMon stderr line currently being read belongs to a
    // warning rather than an error, so indented continuation lines can inherit
    // it. Only touched by the stderr callback, which delivers lines in order.
    private bool _stderrIsWarning;

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    // Returns a Task rather than being async void, and guards its whole body.
    //
    // As async void, anything that threw here reached the thread pool with no
    // handler and killed the sidecar process. The console host has no
    // SynchronizationContext to marshal it back to. The easiest way to trigger
    // that was a missing ignored-processes.txt, opened below before any of the
    // guarded work started, which a partial install, an antivirus quarantine or
    // a dev-tree run can all produce. Because the app's supervisor respawns the
    // sidecar on a flat one-second delay for as long as the app runs, a single
    // absent text file became a permanent once-a-second crash loop rather than a
    // degraded feature. The existing guard inside RunPresentMonAsync only ever
    // covered the work after this point.
    // Split out of Start so the sensors and the CSV number format can be set up
    // without spawning PresentMon, which is what HardwareMonitor.Tests needs to
    // drive ParseData directly. Start's behaviour is unchanged: this is the
    // first thing it does.
    internal void InitializeSensors()
    {
        _cultureInfo.NumberFormat.NumberDecimalSeparator = ".";

        Displayed = new PresentMonSensor(_hardware, "displayed", 0, "Displayed Frames");
        Presented = new PresentMonSensor(_hardware, "presented", 1, "Presented Frames");
        Frametime = new PresentMonSensor(_hardware, "frametime", 2, "Frametime");
        // Spelled out rather than "1% Low": MonitorPoller.RemoveSpecialCharacters
        // rewrites anything outside [a-zA-Z0-9_ .] to an underscore before the
        // name goes on the wire, so "1% Low" would reach the sensor picker as
        // "1_ Low". The overlay resolves these by identifier, but the picker
        // shows the name.
        OnePercentLow = new PresentMonSensor(_hardware, "onepercentlow", 3, "1 Percent Low");
        ZeroPointOnePercentLow = new PresentMonSensor(_hardware, "zeropointonepercentlow", 4, "0.1 Percent Low");
    }

    public async Task Start(CancellationToken stoppingToken)
    {
        try
        {
            InitializeSensors();

            // Resolve the foreground app once, synchronously, before PresentMon
            // starts emitting rows. Without this, the first ~500ms of CSV output
            // is dropped (Auto mode) or attributed to stale state because
            // PollForegroundAsync hasn't had a tick yet.
            _foregroundAppName = ResolveForegroundProcessName();

            var filteredApps = await ReadIgnoredProcessArgumentsAsync();

            _ = PushAppsPeriodicallyAsync(stoppingToken);
            _ = PollForegroundAsync(stoppingToken);
            _ = LogFpsDiagnosticsAsync(stoppingToken);

            await RunPresentMonAsync(filteredApps, stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Normal shutdown.
        }
        catch (Exception ex)
        {
            // Sensors are polled independently of this, so the sidecar stays
            // useful with FPS reading 0 rather than dying and being respawned.
            logger.LogError(ex, "PresentMon poller stopped; FPS and the app list are unavailable for this session");
        }
    }

    /// Builds the --exclude arguments from ignored-processes.txt.
    ///
    /// The file only suppresses noise in PresentMon's output, so an unreadable
    /// one degrades to no exclusions instead of failing the poller: PresentMon
    /// still runs and FPS still reports.
    private async Task<string> ReadIgnoredProcessArgumentsAsync()
    {
        var path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ignored-processes.txt");

        try
        {
            var contents = await File.ReadAllTextAsync(path);
            var excludes = contents
                .Split("\n", StringSplitOptions.RemoveEmptyEntries)
                .Select(x => x.Trim())
                .Where(x => x.Length > 0)
                .Select(x => $"--exclude {x}");
            return string.Join(" ", excludes);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not read {Path}; continuing with no process exclusions", path);
            return string.Empty;
        }
    }

    // Keeps PresentMon running for as long as the sidecar runs.
    //
    // This method used to start the process once and await its exit with
    // nothing after the await. If PresentMon died, whether its trace session
    // was refused, another capture tool stopped it, the exe was quarantined,
    // or it simply crashed, the sidecar carried on serving sensors while FPS
    // sat at 0 and the app list stayed empty for the rest of the session, with
    // no exit code written anywhere. Nothing in the UI could report that,
    // because from the app's point of view monitoring was connected and fine.
    //
    // The body is guarded because a throw here used to take the whole sidecar
    // down: Start is async void, so an exception out of Process.Start (a
    // missing presentmon.exe, for one) reached the thread pool unhandled.
    private async Task RunPresentMonAsync(string filteredApps, CancellationToken stoppingToken)
    {
        // Pre-flight once. Restarts do not repeat it: the launch arguments
        // already carry --stop_existing_session, which clears a session left
        // behind by the instance that just died.
        try
        {
            await TerminateCurrentPresentMon();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Could not terminate an existing PresentMon session");
        }

        var restartDelayMs = PRESENTMON_MIN_RESTART_MS;

        while (!stoppingToken.IsCancellationRequested)
        {
            var startedAtMs = Environment.TickCount64;

            try
            {
                StartPresentMonProcess(filteredApps);
                await _process.WaitForExitAsync(stoppingToken);
                if (stoppingToken.IsCancellationRequested) break;
                logger.LogError(
                    "PresentMon exited with code {ExitCode}. FPS and the monitored-app list are unavailable until it restarts.",
                    _process.ExitCode);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "PresentMon could not be started. FPS and the monitored-app list are unavailable.");
            }

            if (stoppingToken.IsCancellationRequested) break;

            if (Environment.TickCount64 - startedAtMs > PRESENTMON_HEALTHY_RUN_MS)
                restartDelayMs = PRESENTMON_MIN_RESTART_MS;

            try
            {
                await Task.Delay(restartDelayMs, stoppingToken);
            }
            catch (TaskCanceledException)
            {
                break;
            }

            restartDelayMs = Math.Min(restartDelayMs * 2, PRESENTMON_MAX_RESTART_MS);
        }
    }

    private void StartPresentMonProcess(string filteredApps)
    {
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

        var process = new Process();
        process.StartInfo = processStartInfo;
        process.OutputDataReceived += (sender, args) => ParseData(args.Data);
        // PresentMon states its reason for refusing to start here (no
        // elevation, a session held by another capture tool, a blocked exe),
        // which is the only field evidence of why FPS never appears. Null
        // arrives when the stream closes, and a raw message would be read as a
        // log template, so neither is passed straight through.
        process.ErrorDataReceived += (sender, args) =>
        {
            if (string.IsNullOrWhiteSpace(args.Data)) return;

            // PresentMon writes warnings to stderr alongside errors, and every
            // restart produces "a trace session named HardwareMonitor is
            // already running", so logging the stream at Error would make a
            // healthy restart read as a failure in the one place someone looks
            // to tell the two apart. A warning's continuation lines are
            // indented and carry no prefix of their own, so they inherit the
            // level of the line they belong to rather than being read as a
            // second, unrelated error.
            if (!char.IsWhiteSpace(args.Data[0]))
                _stderrIsWarning = args.Data.StartsWith("warning", StringComparison.OrdinalIgnoreCase);

            if (_stderrIsWarning)
                logger.LogWarning("PresentMon: {Output}", args.Data);
            else
                logger.LogError("PresentMon: {Output}", args.Data);
        };

        try
        {
            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();
        }
        catch
        {
            // A failed start still holds an OS handle, and the caller retries
            // on a timer, so this would accumulate one per attempt.
            process.Dispose();
            throw;
        }

        var previous = _process;
        _process = process;
        previous?.Dispose();
    }

    public void Stop()
    {
        // Null before the first launch and between restarts, and already gone
        // if PresentMon exited on its own. Shutdown is not the place to throw.
        try
        {
            _process?.Kill(true);
        }
        catch (Exception ex)
        {
            logger.LogInformation("PresentMon was already stopped: {Message}", ex.Message);
        }
    }

    // internal, not private, so HardwareMonitor.Tests can drive the real row
    // path with synthetic PresentMon CSV rows. The percentile-low wiring —
    // which accumulator a row feeds, the app-change guard, what each mode
    // publishes — only exists here, and a unit test of the accumulators alone
    // cannot see any of it.
    internal void ParseData(string? argsData)
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

        // PresentMon writes the CSV header before the first frame row, and it
        // is wide enough to survive the length check above. Its first column
        // is the literal "Application", which would otherwise be offered as an
        // app to monitor; a real entry always carries the .exe suffix.
        if (string.Equals(rowApp, "Application", StringComparison.Ordinal)) return;

        var nowMs = Environment.TickCount64;

        bool match;
        lock (_stateLock)
        {
            // Record inside the lock: Dictionary<K,V> is not thread-safe, and
            // _appLastSeenMs is also read by SnapshotCurrentApps on the pipe
            // serializer's thread and pruned there.
            _appLastSeenMs[rowApp] = nowMs;


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

            // The percentile lows read the same present-to-present interval as
            // the Presented sensor (the reading the overlay defaults to), but
            // accumulate for the session instead of a 1s window. One
            // increment per row: no trim, no re-sort, no growth.
            //
            // Reset on the app whose frames are actually being counted, not on
            // the setting or the foreground, because three separate paths can
            // change it and only one of them is an explicit user action:
            // SetSelectedApp (the user picks another app), a foreground change
            // in Auto mode, and — the one that has no event at all — the
            // fallback at the top of this method, which starts counting the
            // foreground once a manually-picked app has been silent for
            // SELECTED_APP_STALE_MS. Without this guard that last path blends
            // apps into one histogram indefinitely, and since the window is
            // the whole session it never ages out.
            //
            // Worst case is the fallback engaging and disengaging repeatedly,
            // which SELECTED_APP_STALE_MS caps at one reset per 5s. That keeps
            // the histogram under its warm-up so the overlay shows nothing,
            // which is the right outcome when attribution is genuinely
            // ambiguous: no reading beats a blended one.
            if (_lowsMode != LowsMode.Frozen)
            {
                if (!string.Equals(_lowsApp, rowApp, StringComparison.OrdinalIgnoreCase))
                {
                    _lows.Clear();
                    _lowsLive.Clear();
                    OnePercentLow.Value = 0;
                    ZeroPointOnePercentLow.Value = 0;
                    _lowsApp = rowApp;
                }
                // Both are fed whenever frames are being counted, even though
                // only one of them is read (see _lowsMode). The session
                // histogram is only meaningful for a run that was explicitly
                // started, so it is the one gated on the mode.
                _lowsLive.Add(startMs, ftMs);
                if (_lowsMode == LowsMode.Recording) _lows.Add(ftMs);
            }

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

    /// <summary>
    /// Switch what the percentile lows are measuring. See <see cref="LowsMode"/>.
    ///
    /// <c>Recording</c> clears the histogram and zeroes the published figures,
    /// so a run always measures from zero — the same contract MSI Afterburner's
    /// "begin recording" has. <c>Frozen</c> computes the final figures off
    /// whatever the outgoing mode was reading and freezes them. <c>Live</c>
    /// publishes the rolling window straight away rather than leaving a
    /// finished run's figures on screen until the next diagnostics tick.
    ///
    /// Idempotent in the ways that matter: starting an already-running
    /// recording still clears, which is what a user pressing the key twice by
    /// accident at the start line wants, and re-freezing an already-frozen run
    /// recomputes the same figures off the same frozen histogram. Only the pipe
    /// reconnect in pipe_client.rs actually does the latter.
    /// </summary>
    public void SetLowsMode(LowsMode mode)
    {
        lock (_stateLock)
        {
            switch (mode)
            {
                case LowsMode.Recording:
                    _lows.Clear();
                    // Cleared too, so the first row of the new run re-attributes
                    // through ParseData's guard rather than continuing to count
                    // against whatever app the last run measured. That guard
                    // also drops the live window, which is the right trade: it
                    // refills inside its own window and nothing reads it during
                    // a run anyway.
                    _lowsApp = "";
                    OnePercentLow.Value = 0;
                    ZeroPointOnePercentLow.Value = 0;
                    break;

                case LowsMode.Frozen:
                    // Publish once more BEFORE freezing. The diagnostics loop
                    // recomputes on a FPS_DIAG_WINDOW_MS tick, so the figure
                    // standing when the key is pressed is up to a second old and
                    // the last second of the run — 1.7% of a 60s benchmark, and
                    // the part most likely to hold the frames the user was
                    // watching for — would never reach the number they stopped to
                    // read. Afterburner computes its result at end-of-recording;
                    // so does this.
                    //
                    // Off the OUTGOING mode's source, not unconditionally off the
                    // histogram: freezing from Live has to freeze the number the
                    // user was actually looking at, and the histogram holds
                    // nothing at all in that case.
                    PublishLows(_lowsMode);
                    break;

                case LowsMode.Live:
                    // Straight away, so leaving a finished run does not leave
                    // its figures standing for up to a second while the live
                    // reading is already available — the window kept filling
                    // throughout the run.
                    //
                    // Not cleared first, even though a long freeze leaves stale
                    // frames in it. FrameLowsWindow is indexed on PresentMon's
                    // CPUStartTime and evicts on every Add, so the first frame
                    // after unfreezing carries a timestamp far enough ahead to
                    // drop the whole stale window in one pass — microseconds
                    // later, at any framerate. Clearing here would instead
                    // blank the reading for the warm-up in the common case,
                    // which is a user unfreezing WHILE still playing, where the
                    // window is seconds old and perfectly good. If the game is
                    // gone there are no new frames either way, and the
                    // LOWS_ABANDON_MS sweep — live again the moment this stops
                    // being Frozen — clears it within 30s.
                    PublishLows(LowsMode.Live);
                    break;
            }

            _lowsMode = mode;
        }

        logger.LogInformation("Percentile-low mode {Mode}", mode);
    }

    /// <summary>
    /// Recompute and publish the two low figures from whichever accumulator
    /// <paramref name="source"/> names. No-op for <see cref="LowsMode.Frozen"/>,
    /// which is what makes "frozen" true of the published values and not just
    /// of their inputs.
    ///
    /// Caller must hold <c>_stateLock</c>: it writes
    /// <c>PresentMonSensor.Value</c> (a <c>float?</c>, so a torn read is
    /// possible) on the same lock the pipe serializer takes.
    /// </summary>
    private void PublishLows(LowsMode source)
    {
        switch (source)
        {
            case LowsMode.Live:
                OnePercentLow.Value = _lowsLive.Compute(ONE_PERCENT, LOWS_MIN_TOTAL_MS);
                ZeroPointOnePercentLow.Value =
                    _lowsLive.Compute(ZERO_POINT_ONE_PERCENT, LOWS_MIN_TOTAL_MS);
                break;
            case LowsMode.Recording:
                OnePercentLow.Value = _lows.Compute(ONE_PERCENT, LOWS_MIN_TOTAL_MS);
                ZeroPointOnePercentLow.Value =
                    _lows.Compute(ZERO_POINT_ONE_PERCENT, LOWS_MIN_TOTAL_MS);
                break;
        }
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
            // The lows survive an alt-tab (see LOWS_ABANDON_MS) but never a
            // change of monitored app: the window is the whole session, so
            // without this the old game's stutters would sit in the new
            // game's reading for as long as the app stays open.
            //
            // Unless a run is stopped, in which case the histogram is a
            // finished result and nothing but an explicit start may clear it.
            // Picking another app in the dropdown to read its name, with a
            // benchmark frozen on the overlay, must not throw the benchmark
            // away.
            if (_lowsMode != LowsMode.Frozen)
            {
                _lows.Clear();
                _lowsLive.Clear();
                _lowsApp = "";
                OnePercentLow.Value = 0;
                ZeroPointOnePercentLow.Value = 0;
            }
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

    // Pushes the current app list to connected clients on a fixed cadence.
    //
    // The previous version cleared the whole set immediately after each push,
    // which is what made the list a 10-second sample; entries now expire
    // individually in SnapshotCurrentApps. The cadence is unchanged so the
    // shape of the pipe traffic stays exactly as it was.
    private async Task PushAppsPeriodicallyAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(APP_PUSH_INTERVAL_MS, cancellationToken);
            }
            catch (TaskCanceledException)
            {
                break;
            }

            LogAppListIfChanged();
            OnUpdateApps?.Invoke();
        }
    }

    // One log line per change to the app list.
    //
    // Serilog runs at its default Information level (the sidecar ships no
    // appsettings.json), so every LogDebug in this file is dropped before it
    // reaches disk. Without this line, a report of "the monitored-app dropdown
    // is empty" has nothing in the log to separate "nothing was presenting"
    // from "PresentMon never emitted a row on this machine", which are the two
    // causes and have different fixes.
    private void LogAppListIfChanged()
    {
        // Already sorted by SnapshotCurrentApps, which is what makes comparing
        // the joined string against the last one a reliable change check.
        var apps = SnapshotCurrentApps();
        var joined = apps.Length == 0 ? "(none)" : string.Join(", ", apps);
        if (joined == _lastLoggedApps) return;

        _lastLoggedApps = joined;
        logger.LogInformation("PresentMon apps: {Apps}", joined);
    }

    // Returns the apps seen within APP_TTL_MS and drops the rest, for callers
    // on other threads (e.g. MonitorPoller serializing the dropdown payload to
    // the pipe). The dictionary is not safe to enumerate concurrently with
    // ParseData's write, so the read runs under _stateLock.
    //
    // Sorted because dictionary order is an implementation detail that shifts
    // once a key has been removed, and this array is the order of the settings
    // dropdown: without it, entries can reorder under the cursor on any of the
    // pushes that happen while the menu is open.
    public string[] SnapshotCurrentApps()
    {
        var cutoffMs = Environment.TickCount64 - APP_TTL_MS;
        string[] apps;

        lock (_stateLock)
        {
            // Materialised before removing: a Dictionary cannot be modified
            // while it is being enumerated.
            var expired = _appLastSeenMs
                .Where(entry => entry.Value < cutoffMs)
                .Select(entry => entry.Key)
                .ToList();
            foreach (var app in expired)
            {
                _appLastSeenMs.Remove(app);
            }

            apps = _appLastSeenMs.Keys.ToArray();
        }

        // Outside the lock: the array is already a private copy, and ParseData
        // is on the hot path for every CSV row.
        Array.Sort(apps, StringComparer.OrdinalIgnoreCase);
        return apps;
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
            long lowsFrames;
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

                    // The percentile buffer is deliberately NOT cleared here.
                    // Staleness fires on every alt-tab, loading screen and
                    // pause menu, and wiping a session-long statistic each time
                    // would leave it permanently empty for anyone who tabs
                    // out. It is dropped only once the game has been gone for
                    // LOWS_ABANDON_MS, so the desktop doesn't sit there
                    // showing a closed game's lows.
                    if (_lowsMode != LowsMode.Frozen
                        && (_lastRowArrivalMs == 0 || wallNow - _lastRowArrivalMs > LOWS_ABANDON_MS))
                    {
                        _lows.Clear();
                        _lowsLive.Clear();
                        _lowsApp = "";
                        OnePercentLow.Value = 0;
                        ZeroPointOnePercentLow.Value = 0;
                    }
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
                // Computed under the lock rather than on a snapshot taken out
                // of it. In Recording the walk starts at the slowest frame
                // recorded and stops at the 1% crossing, so it reads a few
                // thousand bucket counts and takes microseconds — nothing like
                // sorting a session's frametimes, which the histogram means
                // never happens. In Live it sorts the window, which is a few
                // thousand floats once per tick. Publishing here also keeps the
                // write to PresentMonSensor.Value (a float?, so a torn read is
                // possible) on the same lock the pipe serializer takes.
                //
                // Deliberately outside the stale/else split above: when rows
                // have merely paused, the frames already measured are still
                // there and the lows should keep reporting rather than blank
                // out with the 1s averages.
                //
                // Skipped entirely while Frozen rather than recomputed from a
                // frozen accumulator: the two are the same number today, but
                // leaving the write out is what makes "frozen" true of the
                // published value and not just of its inputs.
                PublishLows(_lowsMode);
                lowsFrames = _lowsMode == LowsMode.Live ? _lowsLive.FrameCount : _lows.FrameCount;
            }
            var countedStr = counted.Count == 0
                ? "-"
                : string.Join(", ", counted.OrderByDescending(kv => kv.Value).Select(kv => $"{kv.Key}:{kv.Value}"));
            var droppedStr = dropped.Count == 0
                ? "-"
                : string.Join(", ", dropped.OrderByDescending(kv => kv.Value).Select(kv => $"{kv.Key}:{kv.Value}"));

            logger.LogDebug(
                "[FPS-DEBUG] fg={Fg} sel={Sel} fps={Fps:F1} ft={Ft:F2}ms buf.presented={QP} buf.displayed={QD} lows.frames={LowsFrames} rows={Total} short={Short} stale={Stale} counted=[{Counted}] dropped=[{Dropped}]",
                string.IsNullOrEmpty(fg) ? "(empty)" : fg,
                sel,
                fps,
                ft,
                presentedQueue,
                displayedQueue,
                lowsFrames,
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
                            // The percentile histogram is deliberately NOT
                            // cleared here. A foreground change is not the
                            // same event as "a different app's frames arrived"
                            // — alt-tabbing to something that never presents
                            // (Notepad, a settings window) would wipe a
                            // session-long statistic that LOWS_ABANDON_MS
                            // exists to protect. ParseData resets it on the
                            // precise condition instead, when a row from a
                            // different app is actually counted.
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