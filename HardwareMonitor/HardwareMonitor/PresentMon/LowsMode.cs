namespace HardwareMonitor.PresentMon;

/// <summary>
/// What the 1% / 0.1% low readings are currently measuring.
///
/// These are MSI Afterburner's two answers to the same question, kept apart
/// because they are genuinely different statistics and a single one cannot do
/// both jobs. RTSS exposes the choice as its "Percentile buffer" option and
/// documents when each is wanted: unlimited "if you manually start
/// benchmarking session with a hotkey", ring "if you permanently keep the
/// benchmark mode enabled and want to see 1% and 0.1% low metrics reflecting
/// just a few last seconds of gameplay".
///
/// The overlay pill is on from launch, so <see cref="Live"/> is the default
/// and <see cref="Recording"/> is what the hotkey opts into. See
/// <see cref="FrameLowsWindow"/> for why a session-length window cannot serve
/// as a live reading.
///
/// Wire values are the payload of <c>MonitorPacketCommand.SetLowsMode</c> and
/// are load-bearing: 0 and 1 keep the meanings the older boolean payload had
/// (0 stop, 1 start), so a sidecar and a client that disagree by one version
/// still agree about those two.
/// </summary>
public enum LowsMode
{
    /// <summary>
    /// A finished run, held on screen. Nothing accumulates and nothing is
    /// published, so the figures stay exactly as the run left them — a user
    /// who stopped to read a benchmark keeps that number while they alt-tab
    /// away, quit the game, or pick another app in the dropdown.
    /// </summary>
    Frozen = 0,

    /// <summary>
    /// An explicitly started benchmark run: session-cumulative from the moment
    /// the hotkey was pressed, over every frame since. This is the figure that
    /// belongs in a benchmark result, and the one that agrees with RTSS's
    /// default unlimited buffer.
    /// </summary>
    Recording = 1,

    /// <summary>
    /// The always-on live reading: a rolling window of the last few seconds,
    /// so it tracks what the game is doing NOW and recovers from a framerate
    /// change within the window rather than staying pinned to the worst phase
    /// of the whole session.
    /// </summary>
    Live = 2
}
