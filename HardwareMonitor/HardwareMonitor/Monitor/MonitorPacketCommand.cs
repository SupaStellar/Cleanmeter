namespace HardwareMonitor.Monitor;

public enum MonitorPacketCommand : short
{
    Data = 0,
    RefreshPresentMonApps = 1,
    SelectPresentMonApp = 2,
    PresentMonApps = 3,
    SelectPollingRate = 4,
    SelectSensorSource = 5,
}

public enum SensorSourcePreference : short
{
    Auto = 0,
    Lhm = 1,
    Hwinfo = 2,
}

public enum ActiveSensorSource : byte
{
    Lhm = 0,
    Hwinfo = 1,
}
