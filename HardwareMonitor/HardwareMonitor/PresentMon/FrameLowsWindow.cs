namespace HardwareMonitor.PresentMon;

/// <summary>
/// Percentile-low framerates over a ROLLING WINDOW of recent frames, for the
/// always-on overlay reading.
///
/// This is the counterpart to <see cref="FrameLows"/>, which measures a whole
/// session. Both compute the same statistic — RTSS's integral percentile, the
/// frametime at which the slowest frames have used up 1% (or 0.1%) of the
/// measured time — and they differ only in what "the measured time" is.
///
/// <b>Why this exists.</b> A session-length window cannot report a recovery.
/// The slow frames it has already banked keep owning the whole 1% budget until
/// the fast run is long enough to dilute them, and the arithmetic is brutal:
/// the reading is pinned until
///
///     T_fast &gt; T_slow * (1 / fraction - 1)
///
/// which is 99x the slow phase for a 1% low and 999x for a 0.1% low. Thirty
/// seconds capped at 60fps therefore pins the 1% low at 60 for the next 49
/// minutes of 240fps play, and pins the 0.1% low for over eight hours. Drops
/// land on the next poll but recoveries effectively never do, so the number
/// only ever ratchets downward and reads as frozen.
///
/// MSI Afterburner has the same problem and the same fix. RTSS's "Percentile
/// buffer" option switches its lows between an unlimited buffer and a rolling
/// ring, and its own documentation says which is which:
///
///   "Unlimited mode is preferred if you manually start benchmarking session
///    with a hotkey. Ring mode can be preferred if you permanently keep the
///    benchmark mode enabled and want to see 1% and 0.1% low metrics
///    reflecting just a few last seconds of gameplay."
///
/// Cleanmeter's overlay pill is the second case — permanently on, from launch
/// — so the live reading is a ring and only an explicitly started run is
/// unlimited. That is Afterburner's split, not one invented here.
///
/// <b>The part that actually matters.</b> Bounding the SAMPLES is not the fix
/// on its own; the budget has to come from the same window. RTSS's unlimited
/// mode keeps the 1024 slowest frames of the session but takes the budget from
/// total session time, and the two populations drift apart until the buffer
/// can no longer cover 1% of the session — at which point its loop finds no
/// crossing at all, leaves the published figure untouched and stays frozen for
/// good. (Verified against Unwinder's own reference implementation, shipped as
/// CFrametimeStats in the RTSS SDK.) So <see cref="Compute"/> derives the
/// budget from <see cref="TotalMs"/>, which is the sum of the frames still in
/// the window and nothing else. Window in, window out.
///
/// <b>Not thread-safe. Callers must serialize access.</b> Same contract as
/// <see cref="FrameLows"/> and for the same reason: <c>Add</c> runs on
/// PresentMon's output callback thread while <c>Compute</c> and <c>Clear</c>
/// run on the diagnostics loop, and both callers hold
/// <c>PresentMonPoller._stateLock</c>.
/// </summary>
public sealed class FrameLowsWindow
{
    /// <summary>
    /// How much recent frame time the window holds.
    ///
    /// This is the worst-case staleness of the reading, and there is no way to
    /// make it smaller than the window: a phase change is a step, not a glide,
    /// because the old phase keeps more than 1% of the window's time until
    /// almost all of it has aged out. A 10s window is pinned for ~9.9s and
    /// then moves.
    ///
    /// 10s rather than RTSS's 1024 frames. RTSS counts frames because 1024 is
    /// the size of the shared-memory buffer it exports, and that makes its
    /// window 4.3s at 240fps but 17s at 60fps — the reading recovers at a
    /// different speed depending on how fast the game is running, which is the
    /// one property this fix exists to remove. Ten seconds sits inside the
    /// range RTSS spans at real framerates and behaves the same at both ends
    /// of it.
    /// </summary>
    public const double DefaultWindowMs = 10_000;

    /// <summary>
    /// Hard cap on retained frames, independent of the window.
    ///
    /// The window is a duration, so the frame count it implies scales with
    /// framerate: 10s is 2,400 frames at 240fps but 40,000 in a menu running
    /// uncapped at 4,000fps. The cap keeps both the queue and the per-poll
    /// sort bounded there. 16,384 frames is 10s at 1,638fps, so any workload
    /// fast enough to hit it gets a shorter window on frames so uniform that
    /// the 1% budget still spans hundreds of them.
    /// </summary>
    public const int MaxFrames = 16_384;

    private readonly Queue<(double startTimeMs, float intervalMs)> _frames = new();
    private readonly double _windowMs;
    private double _sumMs;
    // PresentMon's own CPUStartTime, monotonic ms since capture start. Game
    // time rather than wall clock, matching the 1s Presented/Displayed windows
    // in PresentMonPoller: ETW delivers rows in bursts, so trimming on arrival
    // time would evict a burst's own frames against each other.
    private double _latestStartTimeMs;
    // Reused across polls so a once-per-second Compute does not hand the GC a
    // multi-thousand-element array every time. Grown, never shrunk.
    private float[] _sorted = new float[1024];

    public FrameLowsWindow(double windowMs = DefaultWindowMs)
    {
        _windowMs = windowMs > 0 ? windowMs : DefaultWindowMs;
    }

    /// <summary>Frames currently inside the window.</summary>
    public int FrameCount => _frames.Count;

    /// <summary>Total frame time currently inside the window, in ms.</summary>
    public double TotalMs => _sumMs;

    /// <summary>
    /// Record one frame, then evict everything that has aged out.
    /// </summary>
    /// <param name="startTimeMs">PresentMon CPUStartTime for this frame.</param>
    /// <param name="intervalMs">Present-to-present interval, in ms.</param>
    public void Add(double startTimeMs, float intervalMs)
    {
        // Same rejection as FrameLows.Add and for the same reason: float
        // parsing yields PositiveInfinity for an overflowing CSV field like
        // "1e40", and letting one into _sumMs makes the sum non-finite
        // permanently — the eviction subtraction can never bring it back, so
        // every later reading is NaN rather than just this frame's.
        if (!float.IsFinite(intervalMs) || intervalMs <= 0) return;
        if (!double.IsFinite(startTimeMs)) return;

        if (startTimeMs > _latestStartTimeMs) _latestStartTimeMs = startTimeMs;

        _frames.Enqueue((startTimeMs, intervalMs));
        _sumMs += intervalMs;

        while (_frames.Count > 0
               && (_latestStartTimeMs - _frames.Peek().startTimeMs > _windowMs
                   || _frames.Count > MaxFrames))
        {
            _sumMs -= _frames.Dequeue().intervalMs;
        }

        // Floating-point drift only, not a correctness guard: _sumMs is a
        // running add-and-subtract over millions of frames, so it can land a
        // hair off zero once the queue empties. Left alone it would make the
        // next budget negative and Compute would answer with the fastest frame
        // in the window instead of the slowest.
        if (_frames.Count == 0) _sumMs = 0;
    }

    /// <summary>Forget the window (app switch, or the game is gone).</summary>
    public void Clear()
    {
        _frames.Clear();
        _sumMs = 0;
        _latestStartTimeMs = 0;
    }

    /// <summary>
    /// The percentile low over the current window, in frames per second.
    /// </summary>
    /// <param name="fraction">0.01 for a 1% low, 0.001 for a 0.1% low.</param>
    /// <param name="minTotalMs">
    /// Refuse to report until the window holds this much frame time, so the
    /// figure does not swing wildly over its first second. Returns 0 below the
    /// threshold, the same "nothing to show" convention the Presented and
    /// Displayed sensors use. Must be shorter than the window, or the reading
    /// never appears at all.
    /// </param>
    /// <returns>Frames per second, or 0 when the window is too short yet.</returns>
    public float Compute(double fraction, double minTotalMs)
    {
        if (_frames.Count == 0 || _sumMs < minTotalMs) return 0f;
        if (fraction <= 0 || fraction > 1) return 0f;

        var budgetMs = _sumMs * fraction;
        if (budgetMs <= 0) return 0f;

        var count = _frames.Count;
        if (_sorted.Length < count) _sorted = new float[Math.Max(count, _sorted.Length * 2)];

        var i = 0;
        foreach (var (_, intervalMs) in _frames) _sorted[i++] = intervalMs;

        // Ascending, then walked from the back. Array.Sort has no descending
        // overload that does not either allocate a comparer or pay
        // Comparison<T> indirection on every comparison, and this runs on the
        // diagnostics tick over a few thousand floats.
        Array.Sort(_sorted, 0, count);

        double accumulated = 0;
        for (var index = count - 1; index >= 0; index--)
        {
            var frametimeMs = _sorted[index];
            accumulated += frametimeMs;

            // `>=` walking from the slow end is exactly equivalent to the
            // strict `>` RTSS's ring mode applies walking from the fast end
            // (CalcIntegralRank in the SDK's OverlayDataSource.cpp), ties
            // included: the two were checked against 18 constructed exact ties
            // and 4,000 random sessions with zero disagreements. Ring is the
            // half to match here, since it is the mode RTSS's own docs prefer
            // for a permanently-enabled overlay.
            //
            // FrameLows is the one that parts from CFrametimeStats (RTSS's
            // unlimited mode), which skips to the next faster frame on a tie.
            // Only on an exact tie, which its bucket arithmetic did not produce
            // once across 200,000 simulated sessions.
            if (accumulated >= budgetMs)
            {
                return frametimeMs > 0 ? (float)(1000.0 / frametimeMs) : 0f;
            }
        }

        return 0f;
    }
}
