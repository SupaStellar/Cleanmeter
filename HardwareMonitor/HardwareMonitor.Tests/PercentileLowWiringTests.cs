using System.Globalization;
using HardwareMonitor.PresentMon;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HardwareMonitor.Tests;

/// <summary>
/// The percentile-low wiring, driven through the real CSV row path.
///
/// <see cref="FrameLowsTests"/> covers the arithmetic; this covers the part
/// around it that only exists in <see cref="PresentMonPoller"/> — which
/// accumulator a row feeds, what each mode publishes, and whether a frozen run
/// really stops moving. That wiring is where the reported bug actually lived:
/// the maths was doing exactly what it was asked to, on the wrong span.
///
/// Rows are synthetic PresentMon CSV, so no PresentMon process, no game and no
/// hardware is involved.
/// </summary>
public class PercentileLowWiringTests
{
    private const string App = "game.exe";

    /// <summary>
    /// A poller with its sensors up and <see cref="App"/> selected, but nothing
    /// started — no PresentMon process, no background loops.
    /// </summary>
    private static PresentMonPoller NewPoller()
    {
        var poller = new PresentMonPoller(NullLogger.Instance)
        {
            OnUpdateApps = () => { }
        };
        poller.InitializeSensors();
        poller.SetSelectedApp(App);
        return poller;
    }

    /// <summary>
    /// One PresentMon CSV row. Only columns 0 (application), 8 (CPUStartTime),
    /// 9 (FrameTime) and 17 (DisplayedTime) are read; the rest just have to be
    /// there, because a row under 18 columns is discarded as short.
    /// </summary>
    private static string Row(double startMs, double frametimeMs)
    {
        var parts = new string[18];
        for (var i = 0; i < parts.Length; i++) parts[i] = "0";
        parts[0] = App;
        parts[8] = startMs.ToString("R", CultureInfo.InvariantCulture);
        parts[9] = frametimeMs.ToString("R", CultureInfo.InvariantCulture);
        parts[17] = frametimeMs.ToString("R", CultureInfo.InvariantCulture);
        return string.Join(",", parts);
    }

    /// <summary>Feeds a steady framerate, advancing the frame clock.</summary>
    private static void Feed(PresentMonPoller poller, ref double nowMs, double fps, double seconds)
    {
        var frametimeMs = 1000.0 / fps;
        var frames = (int)Math.Round(fps * seconds);
        for (var i = 0; i < frames; i++)
        {
            poller.ParseData(Row(nowMs, frametimeMs));
            nowMs += frametimeMs;
        }
    }

    /// <summary>
    /// The reported bug, through the whole path: a game that runs at 60fps and
    /// then at 240fps must not leave the live 1% low reading 60.
    ///
    /// Live is the startup mode, so this is what a user who never touches the
    /// hotkey sees — which is who reported it.
    /// </summary>
    [Fact]
    public void LiveLows_FollowTheFramerateAfterASuddenChange()
    {
        var poller = NewPoller();
        var nowMs = 0.0;

        Feed(poller, ref nowMs, 60, 30);
        poller.SetLowsMode(LowsMode.Live);
        Assert.Equal(60f, poller.OnePercentLow.Value!.Value, 0);

        Feed(poller, ref nowMs, 240, 11);
        poller.SetLowsMode(LowsMode.Live);
        Assert.Equal(240f, poller.OnePercentLow.Value!.Value, 0);
        Assert.Equal(240f, poller.ZeroPointOnePercentLow.Value!.Value, 0);
    }

    /// <summary>
    /// A recording run is still cumulative over the whole run, which is the
    /// point of it — a benchmark that forgot its first thirty seconds would be
    /// the opposite bug. So the same framerate change that the live reading
    /// follows must leave the run's figure on the slow phase.
    /// </summary>
    [Fact]
    public void RecordedLows_StayCumulativeAcrossTheSameFramerateChange()
    {
        var poller = NewPoller();
        var nowMs = 0.0;

        poller.SetLowsMode(LowsMode.Recording);
        Feed(poller, ref nowMs, 60, 30);
        Feed(poller, ref nowMs, 240, 11);

        poller.SetLowsMode(LowsMode.Frozen);
        Assert.Equal(60f, poller.OnePercentLow.Value!.Value, 0);
    }

    /// <summary>
    /// A frozen run is a result somebody is reading. Frames arriving while it is
    /// frozen must not move it — not the figure, and not the accumulators
    /// behind the figure.
    /// </summary>
    [Fact]
    public void FrozenLows_DoNotMoveWhileFramesKeepArriving()
    {
        var poller = NewPoller();
        var nowMs = 0.0;

        poller.SetLowsMode(LowsMode.Recording);
        Feed(poller, ref nowMs, 60, 30);
        poller.SetLowsMode(LowsMode.Frozen);

        var frozen = poller.OnePercentLow.Value!.Value;
        Assert.Equal(60f, frozen, 0);

        Feed(poller, ref nowMs, 240, 60);

        Assert.Equal(frozen, poller.OnePercentLow.Value!.Value);
    }

    /// <summary>
    /// Leaving a frozen run returns to a live reading of the CURRENT framerate,
    /// not the run's. Without this the hotkey would have no way back to a
    /// number that tracks the game.
    /// </summary>
    [Fact]
    public void LeavingAFrozenRun_ReturnsToALiveReading()
    {
        var poller = NewPoller();
        var nowMs = 0.0;

        poller.SetLowsMode(LowsMode.Recording);
        Feed(poller, ref nowMs, 60, 30);
        poller.SetLowsMode(LowsMode.Frozen);
        Assert.Equal(60f, poller.OnePercentLow.Value!.Value, 0);

        // Back to live, then keep playing at the higher framerate.
        poller.SetLowsMode(LowsMode.Live);
        Feed(poller, ref nowMs, 240, 11);
        poller.SetLowsMode(LowsMode.Live);

        Assert.Equal(240f, poller.OnePercentLow.Value!.Value, 0);
    }

    /// <summary>
    /// Starting a run measures from zero rather than inheriting whatever the
    /// live window had, which is the contract Afterburner's "begin recording"
    /// has. A run started during a smooth stretch must not already know about
    /// stutters from before it began.
    /// </summary>
    [Fact]
    public void StartingARun_MeasuresFromZero()
    {
        var poller = NewPoller();
        var nowMs = 0.0;

        Feed(poller, ref nowMs, 60, 30);
        poller.SetLowsMode(LowsMode.Recording);
        Feed(poller, ref nowMs, 240, 11);
        poller.SetLowsMode(LowsMode.Frozen);

        // Only the 240fps frames were in the run.
        Assert.Equal(240f, poller.OnePercentLow.Value!.Value, 0);
    }

    /// <summary>
    /// Frames belonging to another application are not counted, in any mode.
    /// The lows are attributed the same way the FPS reading is.
    /// </summary>
    [Fact]
    public void LowsIgnoreRowsFromAnotherApplication()
    {
        var poller = NewPoller();
        var nowMs = 0.0;

        Feed(poller, ref nowMs, 240, 11);
        poller.SetLowsMode(LowsMode.Live);
        var before = poller.OnePercentLow.Value!.Value;
        Assert.Equal(240f, before, 0);

        // A second app stuttering badly, for as long again.
        for (var i = 0; i < 2640; i++)
        {
            poller.ParseData(Row(nowMs, 100.0).Replace(App, "other.exe"));
            nowMs += 100.0;
        }
        poller.SetLowsMode(LowsMode.Live);

        Assert.Equal(before, poller.OnePercentLow.Value!.Value);
    }
}
