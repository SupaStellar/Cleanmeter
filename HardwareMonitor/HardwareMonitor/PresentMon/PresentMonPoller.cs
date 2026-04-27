using System.Collections.Concurrent;
using System.Diagnostics;
using System.Globalization;
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
        await _process.WaitForExitAsync(stoppingToken);
    }

    public void Stop()
    {
        _process.Kill(true);
    }

    private void ParseData(string? argsData)
    {
        string[] parts;
        if (argsData != null)
        {
            parts = argsData.Split(",");
            CurrentApps.Add(parts[0]);

            if (_currentSelectedApp != NO_SELECTED_APP && _currentSelectedApp != parts[0])
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
}