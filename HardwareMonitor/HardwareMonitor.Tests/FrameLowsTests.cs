using HardwareMonitor.PresentMon;
using Xunit;

namespace HardwareMonitor.Tests;

/// <summary>
/// The two percentile-low accumulators, and specifically the difference in
/// behaviour that made the live overlay reading look broken: a
/// session-cumulative figure cannot report a recovery, a windowed one can.
///
/// Numbers here are exact rather than approximate wherever the workload is
/// synthetic and uniform, because the whole class of bug being guarded against
/// is a figure that does not move when it should.
/// </summary>
public class FrameLowsTests
{
    private const double OnePercent = 0.01;
    private const double PointOnePercent = 0.001;

    /// <summary>Feeds a steady framerate into the session histogram.</summary>
    private static void Feed(FrameLows lows, double fps, double seconds)
    {
        var intervalMs = (float)(1000.0 / fps);
        var frames = (int)Math.Round(fps * seconds);
        for (var i = 0; i < frames; i++) lows.Add(intervalMs);
    }

    /// <summary>
    /// Feeds a steady framerate into the rolling window, advancing PresentMon's
    /// CPUStartTime clock by each frame's own interval — which is what the real
    /// caller passes and what the eviction test compares against.
    /// </summary>
    private sealed class WindowFeeder(FrameLowsWindow window)
    {
        private double _nowMs;

        public void Feed(double fps, double seconds)
        {
            var intervalMs = (float)(1000.0 / fps);
            var frames = (int)Math.Round(fps * seconds);
            for (var i = 0; i < frames; i++)
            {
                window.Add(_nowMs, intervalMs);
                _nowMs += intervalMs;
            }
        }
    }

    // ---------------------------------------------------------------- the bug

    /// <summary>
    /// The reported bug, as arithmetic. A session-length window pins the 1% low
    /// to the slow phase for 99x its duration, so 30s at 60fps holds the
    /// reading at 60 through nearly an hour of 240fps play. Correct for a
    /// benchmark run — every frame of the run counts, which is the point — and
    /// completely wrong for a live reading, which is why the live reading is no
    /// longer this class.
    /// </summary>
    [Fact]
    public void SessionLows_StayPinnedToTheSlowPhase_LongAfterFramerateRecovers()
    {
        var lows = new FrameLows();
        Feed(lows, 60, 30);
        Assert.Equal(60.0f, lows.Compute(OnePercent, 0), 1);

        Feed(lows, 240, 300);
        Assert.Equal(60.0f, lows.Compute(OnePercent, 0), 1);

        // Still pinned after 45 minutes at 240fps. 30s of 60fps needs 99x that
        // — 49.5 minutes — before it stops owning 1% of total session time.
        Feed(lows, 240, 2400);
        Assert.Equal(60.0f, lows.Compute(OnePercent, 0), 1);
    }

    /// <summary>
    /// The 0.1% low needs 999x, which for the same 30s slow phase is over eight
    /// hours. Recorded so nobody reads the 1% figure above as the worst case.
    /// </summary>
    [Fact]
    public void SessionLows_PinThePointOnePercentEvenLonger()
    {
        var lows = new FrameLows();
        Feed(lows, 60, 30);
        Feed(lows, 240, 3600);
        Assert.Equal(60.0f, lows.Compute(PointOnePercent, 0), 1);
    }

    // ---------------------------------------------------------------- the fix

    /// <summary>
    /// The fix. Same framerate change, but the window ages the slow frames out,
    /// so the reading is back on the current framerate once the window has
    /// turned over — bounded staleness instead of unbounded.
    /// </summary>
    [Fact]
    public void WindowedLows_RecoverOnceTheWindowHasTurnedOver()
    {
        var window = new FrameLowsWindow();
        var feeder = new WindowFeeder(window);

        feeder.Feed(60, 30);
        Assert.Equal(60.0f, window.Compute(OnePercent, 0), 1);

        // Halfway through the window the slow frames still hold more than 1% of
        // its time, so the reading is still 60. A phase change is a step, not a
        // glide, and this documents that it is expected.
        feeder.Feed(240, 5);
        Assert.Equal(60.0f, window.Compute(OnePercent, 0), 1);

        // Past the window, every 60fps frame has aged out.
        feeder.Feed(240, 6);
        Assert.Equal(240.0f, window.Compute(OnePercent, 0), 1);
    }

    /// <summary>
    /// The recovery is bounded by the window and nothing else, so a longer slow
    /// phase does not make it slower. This is the property the session
    /// accumulator does not have.
    /// </summary>
    [Theory]
    [InlineData(30)]
    [InlineData(120)]
    [InlineData(600)]
    public void WindowedLows_RecoverInTheSameTimeRegardlessOfHowLongTheSlowPhaseLasted(
        double slowSeconds)
    {
        var window = new FrameLowsWindow();
        var feeder = new WindowFeeder(window);

        feeder.Feed(60, slowSeconds);
        feeder.Feed(240, 11);

        Assert.Equal(240.0f, window.Compute(OnePercent, 0), 1);
    }

    /// <summary>
    /// A drop still lands on the next poll. The asymmetry was never the
    /// problem — a stutter SHOULD show up immediately — so windowing must not
    /// have slowed that down.
    /// </summary>
    [Fact]
    public void WindowedLows_ReportADropImmediately()
    {
        var window = new FrameLowsWindow();
        var feeder = new WindowFeeder(window);

        feeder.Feed(240, 11);
        Assert.Equal(240.0f, window.Compute(OnePercent, 0), 1);

        feeder.Feed(60, 0.5);
        Assert.Equal(60.0f, window.Compute(OnePercent, 0), 1);
    }

    // -------------------------------------------------- agreement on the maths

    /// <summary>
    /// Both classes implement RTSS's integral definition, so on a workload that
    /// fits entirely inside the window they must produce the same number. The
    /// case is the one FrameLows documents: 999 frames at 8ms plus a single
    /// 200ms hitch reads 5.0 fps, because one catastrophic frame covers the
    /// whole 1% time budget on its own. An "average the slowest 1%" rule reads
    /// 36.8 here, so this also pins down which definition is implemented.
    /// </summary>
    [Fact]
    public void BothAccumulators_AgreeWithRtssIntegralDefinition_OnASingleHitch()
    {
        var lows = new FrameLows();
        var window = new FrameLowsWindow();
        var nowMs = 0.0;

        for (var i = 0; i < 999; i++)
        {
            lows.Add(8f);
            window.Add(nowMs, 8f);
            nowMs += 8;
        }
        lows.Add(200f);
        window.Add(nowMs, 200f);

        Assert.Equal(5.0f, lows.Compute(OnePercent, 0), 2);
        Assert.Equal(5.0f, window.Compute(OnePercent, 0), 2);
    }

    /// <summary>
    /// A smaller fraction crosses its budget earlier, on a slower frame, so the
    /// 0.1% low can never read above the 1% low. Two readings that inverted
    /// would be unactionable, and it is the reason one hotkey drives both.
    /// </summary>
    [Fact]
    public void WindowedLows_NeverReportPointOnePercentAboveOnePercent()
    {
        var window = new FrameLowsWindow();
        var random = new Random(1234);
        var nowMs = 0.0;

        // Jittery, with occasional hitches — the shape that separates the two.
        for (var i = 0; i < 20_000; i++)
        {
            var intervalMs = (float)(4.0 + random.NextDouble() * 2.0);
            if (i % 500 == 0) intervalMs = (float)(30.0 + random.NextDouble() * 40.0);
            window.Add(nowMs, intervalMs);
            nowMs += intervalMs;
        }

        var onePercent = window.Compute(OnePercent, 0);
        var pointOne = window.Compute(PointOnePercent, 0);

        Assert.True(onePercent > 0);
        Assert.True(pointOne > 0);
        Assert.True(
            pointOne <= onePercent,
            $"0.1% low ({pointOne}) must not exceed 1% low ({onePercent})");
    }

    // ------------------------------------------------------------- the window

    [Fact]
    public void WindowedLows_EvictFramesOlderThanTheWindow()
    {
        var window = new FrameLowsWindow();
        var feeder = new WindowFeeder(window);

        feeder.Feed(120, 60);

        // A minute fed in, ~10s retained. One frame of slack: eviction is on
        // `>` the window, so the frame sitting exactly on the boundary stays.
        Assert.InRange(window.TotalMs, FrameLowsWindow.DefaultWindowMs,
            FrameLowsWindow.DefaultWindowMs + 1000.0 / 120 * 2);
    }

    /// <summary>
    /// The window is a duration, so an uncapped menu running at thousands of
    /// frames per second would otherwise size the queue and the per-poll sort
    /// off the framerate.
    /// </summary>
    [Fact]
    public void WindowedLows_CapRetainedFramesEvenWhenTheWindowWouldHoldMore()
    {
        var window = new FrameLowsWindow();
        var feeder = new WindowFeeder(window);

        // 4,000fps for the full window is 40,000 frames, well past the cap.
        feeder.Feed(4000, 10);

        Assert.True(
            window.FrameCount <= FrameLowsWindow.MaxFrames,
            $"retained {window.FrameCount} frames, cap is {FrameLowsWindow.MaxFrames}");
        Assert.Equal(4000.0f, window.Compute(OnePercent, 0), 0);
    }

    /// <summary>
    /// Above ~3,277fps the frame cap binds before the warm-up threshold does:
    /// MaxFrames is 16,384 frames, which is only 4,096ms at 4,000fps, so the
    /// window's total can never reach a 5,000ms threshold no matter how long the
    /// game runs. Without a full buffer counting as warmed up, the live lows
    /// would read 0 forever at exactly the uncapped-menu framerate the
    /// MaxFrames comment cites.
    /// </summary>
    [Fact]
    public void WindowedLows_ReportFromAFullBufferEvenBelowTheWarmUpThreshold()
    {
        var window = new FrameLowsWindow();
        const double fps = 4000;
        const float frametimeMs = (float)(1000.0 / fps);
        var nowMs = 0.0;

        // Fill the cap and then some, so eviction is by MaxFrames, not by time.
        for (var i = 0; i < FrameLowsWindow.MaxFrames * 2; i++)
        {
            window.Add(nowMs, frametimeMs);
            nowMs += frametimeMs;
        }

        Assert.Equal(FrameLowsWindow.MaxFrames, window.FrameCount);
        // The whole point: the buffer is full but holds less than the threshold.
        Assert.True(window.TotalMs < 5_000, $"expected a capped span, got {window.TotalMs}ms");

        Assert.True(window.Compute(OnePercent, 5_000) > 0, "1% low blanked on a full buffer");
        Assert.True(window.Compute(PointOnePercent, 5_000) > 0, "0.1% low blanked on a full buffer");
        Assert.Equal(fps, window.Compute(OnePercent, 5_000), 0);
    }

    [Fact]
    public void WindowedLows_ReportNothingBeforeTheWarmUpThreshold()
    {
        var window = new FrameLowsWindow();
        var feeder = new WindowFeeder(window);

        feeder.Feed(240, 1);
        Assert.Equal(0f, window.Compute(OnePercent, 5_000));

        feeder.Feed(240, 5);
        Assert.True(window.Compute(OnePercent, 5_000) > 0);
    }

    /// <summary>
    /// A frame arriving long after the last one drops the whole stale window in
    /// one pass, because eviction runs on every Add and compares CPUStartTime.
    /// This is what lets SetLowsMode return to Live without clearing first: a
    /// user unfreezing while still playing keeps a full window, and one who
    /// unfreezes after a long gap gets the stale frames flushed by the first
    /// new frame rather than blended into the reading.
    /// </summary>
    [Fact]
    public void WindowedLows_FlushStaleFramesOnTheFirstFrameAfterAGap()
    {
        var window = new FrameLowsWindow();
        var feeder = new WindowFeeder(window);

        feeder.Feed(240, 11);
        Assert.True(window.FrameCount > 1000);

        // Twenty minutes of frozen-at-the-desktop, then one frame.
        window.Add(11_000 + 20 * 60 * 1000, 4.1667f);

        Assert.Equal(1, window.FrameCount);
    }

    [Fact]
    public void WindowedLows_ClearForgetsEverything()
    {
        var window = new FrameLowsWindow();
        var feeder = new WindowFeeder(window);

        feeder.Feed(240, 11);
        Assert.True(window.Compute(OnePercent, 0) > 0);

        window.Clear();

        Assert.Equal(0, window.FrameCount);
        Assert.Equal(0, window.TotalMs);
        Assert.Equal(0f, window.Compute(OnePercent, 0));
    }

    /// <summary>
    /// A garbled PresentMon CSV field parses to infinity or NaN as happily as
    /// to a number. In a running sum that is permanent damage — the eviction
    /// subtraction can never bring the total back to finite — so it has to be
    /// rejected at the door, not clamped downstream.
    /// </summary>
    [Theory]
    [InlineData(float.PositiveInfinity)]
    [InlineData(float.NaN)]
    [InlineData(0f)]
    [InlineData(-1f)]
    public void WindowedLows_RejectUnusableIntervals(float intervalMs)
    {
        var window = new FrameLowsWindow();
        var feeder = new WindowFeeder(window);
        feeder.Feed(240, 11);

        var before = window.Compute(OnePercent, 0);
        window.Add(11_000, intervalMs);

        Assert.Equal(before, window.Compute(OnePercent, 0), 3);
        Assert.True(double.IsFinite(window.TotalMs));
    }

    [Fact]
    public void WindowedLows_RejectANonFiniteTimestamp()
    {
        var window = new FrameLowsWindow();
        var feeder = new WindowFeeder(window);
        feeder.Feed(240, 11);

        var before = window.Compute(OnePercent, 0);
        window.Add(double.PositiveInfinity, 4.1667f);

        Assert.Equal(before, window.Compute(OnePercent, 0), 3);
        Assert.True(double.IsFinite(window.TotalMs));
    }

    [Theory]
    [InlineData(0.0)]
    [InlineData(-1.0)]
    [InlineData(1.5)]
    public void WindowedLows_RefuseFractionsOutsideZeroToOne(double fraction)
    {
        var window = new FrameLowsWindow();
        var feeder = new WindowFeeder(window);
        feeder.Feed(240, 11);

        Assert.Equal(0f, window.Compute(fraction, 0));
    }

    // ------------------------------------------------------------- the protocol

    /// <summary>
    /// The mode discriminants are the pipe payload
    /// (MonitorPacketCommand.SetLowsMode), and 0/1 carry the meanings the
    /// earlier boolean payload had. Reordering them would silently change what
    /// a keypress does across a version mismatch.
    /// </summary>
    [Fact]
    public void LowsMode_WireValuesAreFixed()
    {
        Assert.Equal(0, (int)LowsMode.Frozen);
        Assert.Equal(1, (int)LowsMode.Recording);
        Assert.Equal(2, (int)LowsMode.Live);
    }

    /// <summary>
    /// The warm-up has to be shorter than the window or the live reading never
    /// appears at all: the window can never hold more than its own length.
    /// </summary>
    [Fact]
    public void WindowIsLongerThanTheWarmUpThresholdUsedByThePoller()
    {
        // LOWS_MIN_TOTAL_MS in PresentMonPoller.
        const double warmUpMs = 5_000;
        Assert.True(FrameLowsWindow.DefaultWindowMs > warmUpMs);
    }
}
