namespace HardwareMonitor.Monitor;

public enum MonitorPacketCommand : short
{
    Data = 0,
    RefreshPresentMonApps = 1,
    SelectPresentMonApp = 2,
    PresentMonApps = 3,
    SelectPollingRate = 4,

    /// <summary>
    /// Set what the percentile-low readings measure: payload 0 freezes a
    /// finished run, 1 starts a session-cumulative recording run, 2 returns to
    /// the rolling live window. Sent by the Rust side when the recording hotkey
    /// is pressed; see PresentMonPoller.SetLowsMode and LowsMode, whose values
    /// these are.
    ///
    /// 0 and 1 keep the meanings the original boolean payload had, so a client
    /// and sidecar that disagree by one version still agree about stop and
    /// start; only 2 is new, and an older sidecar rejects it and stays where it
    /// was rather than misreading it.
    /// </summary>
    SetLowsMode = 5
}