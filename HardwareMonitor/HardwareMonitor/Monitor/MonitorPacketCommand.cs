namespace HardwareMonitor.Monitor;

public enum MonitorPacketCommand : short
{
    Data = 0,
    RefreshPresentMonApps = 1,
    SelectPresentMonApp = 2,
    PresentMonApps = 3,
    SelectPollingRate = 4,

    /// <summary>
    /// Start (payload 1) or stop (payload 0) accumulating frametimes into the
    /// percentile-low histogram. Sent by the Rust side when the recording
    /// hotkey is pressed; see PresentMonPoller.SetLowsRecording.
    /// </summary>
    SetLowsRecording = 5
}