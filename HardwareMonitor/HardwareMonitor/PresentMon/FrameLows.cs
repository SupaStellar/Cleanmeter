namespace HardwareMonitor.PresentMon;

/// <summary>
/// Percentile-low framerates ("1% low", "0.1% low") for a play session.
///
/// There is no single industry definition and the three in circulation
/// disagree by a wide margin on the same gameplay:
///
///   1. Frame-count percentile (P1): the single frametime sitting at the 1%
///      position once sorted. Intel PresentMon and CapFrameX's "1% percentile"
///      report this. It ignores everything worse than that one frame, so a
///      handful of severe hitches move it not at all.
///   2. Time-integral threshold: sort slowest-first, accumulate frametimes
///      until the sum reaches 1% of total session time, report the frametime
///      at that crossing point. <b>This is what RTSS / MSI Afterburner
///      reports</b>, and it is a percentile whose N is derived from time
///      rather than fixed at the 99th.
///   3. Average of the tail: average the frametimes of the slowest 1% of
///      frames. GamersNexus popularised this; CapFrameX ships it separately
///      as "1% low average".
///
/// This implements (2), to agree with the overlay most Cleanmeter users
/// already have running. The practical difference is large: on 999 frames at
/// 8ms plus a single 200ms hitch, (3) reads 36.8 fps while (2) reads 5.0 fps,
/// because one catastrophic frame alone covers the whole 1% time budget.
///
/// Held as a histogram of frametimes rather than a list of them. The window is
/// the whole session (RTSS's "unlimited" default), and a four-hour session at
/// 300fps is 4.3M frames, which is not something to keep in a list and re-sort
/// once a second. Bucketed counts make both memory and compute constant no
/// matter how long the session runs, and because every frame in a bucket
/// shares one quantised frametime, walking the histogram from the slow end
/// gives exactly the answer walking the sorted frames would.
///
/// RTSS bounds the same problem by keeping only the 1024 slowest frames, which
/// saturates in a long session once those 1024 no longer cover 1% of elapsed
/// time. The histogram has no such ceiling, so it tracks the definition RTSS
/// documents rather than reproducing that truncation.
///
/// <b>Not thread-safe. Callers must serialize access.</b> Every member mutates
/// or reads unsynchronised state, and the two callers live on different
/// threads: <c>Add</c> runs on PresentMon's output callback thread, while
/// <c>Compute</c>, <c>Clear</c> and <c>FrameCount</c> run on the diagnostics
/// loop. Both hold <c>PresentMonPoller._stateLock</c>, which is the only
/// reason this is correct — an unlocked <c>Add</c> added later would tear
/// <c>_totalMs</c>, <c>_frameCount</c> and <c>_highestBucket</c> against each
/// other with nothing local to signal it.
/// </summary>
public sealed class FrameLows
{
    /// Histogram resolution. 0.01ms keeps the reported figure within about
    /// 0.1% of the exact answer even up at 250fps, where a frametime is only
    /// 4ms and coarse buckets would start to show.
    public const double BucketMs = 0.01;

    /// Frames at or beyond this land in the top bucket. A frame taking a full
    /// second is already a catastrophic hitch, and clamping only changes the
    /// reported number in the case where the answer itself is 1 fps.
    public const double MaxFrametimeMs = 1000.0;

    private const int BucketCount = (int)(MaxFrametimeMs / BucketMs) + 1;

    private readonly uint[] _buckets = new uint[BucketCount];
    private double _totalMs;
    private long _frameCount;
    // Highest populated bucket, so the walk starts at the slowest frame seen
    // instead of scanning 100k empty buckets from the top every time.
    private int _highestBucket = -1;

    public long FrameCount => _frameCount;

    /// Total frame time recorded, quantised the same way the buckets are so
    /// the budget and the walk cannot disagree by a rounding error.
    public double TotalMs => _totalMs;

    /// <summary>Record one frame interval, in milliseconds.</summary>
    public void Add(float intervalMs)
    {
        // Infinity has to be rejected explicitly, not just by the `> 0` test
        // it passes: float.TryParse yields PositiveInfinity for "Infinity" or
        // an overflowing literal like "1e40", Math.Round preserves it, and
        // .NET 8 leaves the unchecked (int) conversion of a non-finite double
        // UNSPECIFIED — in practice int.MinValue, which slips past the
        // `>= BucketCount` clamp below and indexes the array negatively.
        // One malformed PresentMon row would then throw
        // IndexOutOfRangeException on the per-frame path. IsFinite also
        // covers NaN, so this subsumes the NaN case.
        if (!float.IsFinite(intervalMs) || intervalMs <= 0) return;

        // Clamp in the double domain BEFORE the cast, not after. Any interval
        // above ~2.1e7 ms makes `intervalMs / BucketMs` exceed int.MaxValue,
        // and .NET 8 leaves that unchecked conversion unspecified — it lands
        // on int.MinValue, which is not `>= BucketCount`, so a post-cast clamp
        // never sees it and the negative index throws. float.MaxValue arrives
        // here from a garbage CSV field like "1e30", which parses as perfectly
        // finite.
        var clampedMs = intervalMs >= MaxFrametimeMs ? MaxFrametimeMs : intervalMs;
        var index = (int)Math.Round(clampedMs / BucketMs);
        if (index >= BucketCount) index = BucketCount - 1;

        _buckets[index]++;
        _totalMs += index * BucketMs;
        _frameCount++;
        if (index > _highestBucket) _highestBucket = index;
    }

    /// <summary>Forget the session so far (app switch, or the game is gone).</summary>
    public void Clear()
    {
        Array.Clear(_buckets, 0, _buckets.Length);
        _totalMs = 0;
        _frameCount = 0;
        _highestBucket = -1;
    }

    /// <summary>
    /// The percentile low, in frames per second.
    /// </summary>
    /// <param name="fraction">0.01 for a 1% low, 0.001 for a 0.1% low.</param>
    /// <param name="minTotalMs">
    /// Refuse to report until this much frame time has accumulated. RTSS has
    /// no warm-up and reports from the first frame, but a figure derived from
    /// half a second of play changes on every poll and reads as broken rather
    /// than as early. Returns 0 below the threshold, the same "nothing to
    /// show" convention the Presented/Displayed sensors use.
    /// </param>
    /// <returns>Frames per second, or 0 when there is not enough data yet.</returns>
    /// <remarks>
    /// The 1% and 0.1% lows legitimately report the SAME number sometimes,
    /// and it is not a bug or a wiring mistake — worth knowing before anyone
    /// goes looking for one. A smaller fraction crosses its budget earlier,
    /// on a slower frame, so 0.1% low is always &lt;= 1% low; they meet
    /// whenever both budgets are satisfied inside a single bucket. That
    /// happens when the workload is very steady (a desktop app paces so
    /// evenly that the slowest 1% of time sits in one 0.01ms bucket) and
    /// when one hitch is long enough to cover the whole 1% budget by itself.
    /// Measured against this class: 60s of 60fps desktop gives 59.3 / 59.3,
    /// while 60s of a stuttering game gives 15.4 / 14.0.
    /// </remarks>
    public float Compute(double fraction, double minTotalMs)
    {
        if (_frameCount == 0 || _totalMs < minTotalMs) return 0f;
        if (fraction <= 0 || fraction > 1) return 0f;

        var budgetMs = _totalMs * fraction;
        if (budgetMs <= 0) return 0f;

        double accumulated = 0;
        for (var index = _highestBucket; index >= 0; index--)
        {
            var count = _buckets[index];
            if (count == 0) continue;

            var frametimeMs = index * BucketMs;
            accumulated += frametimeMs * count;

            // Every frame in this bucket shares one frametime, so it makes no
            // difference whether the budget is crossed by the bucket's first
            // frame or its last — the answer is this bucket's frametime
            // either way. That is what makes the histogram exact rather than
            // an approximation of the frame-by-frame walk.
            if (accumulated >= budgetMs)
            {
                return frametimeMs > 0 ? (float)(1000.0 / frametimeMs) : 0f;
            }
        }

        return 0f;
    }
}
