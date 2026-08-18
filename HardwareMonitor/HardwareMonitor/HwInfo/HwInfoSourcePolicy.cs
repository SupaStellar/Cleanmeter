using HardwareMonitor.Monitor;

namespace HardwareMonitor.HwInfo;

public static class HwInfoSourcePolicy
{
    public static bool WantsHwInfo(SensorSourcePreference preference) =>
        preference != SensorSourcePreference.Lhm;

    public static bool ShouldReportFallback(
        SensorSourcePreference preference,
        bool usingHwInfo,
        bool hwInfoSeenThisSession)
    {
        if (usingHwInfo)
            return false;

        return preference switch
        {
            SensorSourcePreference.Lhm => false,
            SensorSourcePreference.Hwinfo => true,
            SensorSourcePreference.Auto => hwInfoSeenThisSession,
            _ => false,
        };
    }
}
