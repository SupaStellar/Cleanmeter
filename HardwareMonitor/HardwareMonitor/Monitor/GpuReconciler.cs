using LibreHardwareMonitor.Hardware;

namespace HardwareMonitor.Monitor;

/// <summary>
/// Compares the GPUs the device tree reports against the GPUs
/// LibreHardwareMonitor actually produced, and says which are unaccounted for.
///
/// Deliberately pure: the whole decision is a function of two lists, so it can
/// be exercised without a machine that has the hardware in question. The
/// caller owns the side effects (rebuilding LibreHardwareMonitor's GPU groups,
/// synthesising placeholder entries, logging).
///
/// Matching is per vendor, by count, not per device. LibreHardwareMonitor's
/// IHardware exposes only Name and Identifier, never a PCI device ID, so there
/// is nothing to join two specific devices on. Counting per vendor is exact
/// for the case this exists to serve, a laptop with one integrated and one
/// discrete GPU from different vendors, and degrades to "how many are missing"
/// rather than "which one" for two cards from the same vendor.
/// </summary>
public static class GpuReconciler
{
    /// <summary>
    /// The adapters the device tree sees but LibreHardwareMonitor has not
    /// produced hardware for. Empty when everything is accounted for, which is
    /// the case on every single-GPU machine and is the cheap path.
    ///
    /// When a vendor is short by N, the trailing N adapters of that vendor are
    /// reported. Which specific device is missing is unknowable here, so the
    /// choice is arbitrary but deterministic.
    /// </summary>
    public static IReadOnlyList<DisplayAdapters.DisplayAdapter> Missing(
        IReadOnlyList<DisplayAdapters.DisplayAdapter> adapters,
        IEnumerable<HardwareType> detectedGpuTypes)
    {
        var detected = new Dictionary<HardwareType, int>();
        foreach (var type in detectedGpuTypes)
        {
            if (!IsGpu(type))
                continue;

            detected[type] = detected.GetValueOrDefault(type) + 1;
        }

        var missing = new List<DisplayAdapters.DisplayAdapter>();
        var seen = new Dictionary<HardwareType, int>();

        foreach (var adapter in adapters)
        {
            var index = seen.GetValueOrDefault(adapter.Type);
            seen[adapter.Type] = index + 1;

            // The first N adapters of a vendor are taken to be the N that
            // LibreHardwareMonitor produced; anything past that is missing.
            if (index >= detected.GetValueOrDefault(adapter.Type))
                missing.Add(adapter);
        }

        return missing;
    }

    /// <summary>
    /// A stable, ASCII-only identifier for a GPU the device tree sees but
    /// LibreHardwareMonitor has no reading for.
    ///
    /// Kept clearly distinct from LibreHardwareMonitor's own identifiers
    /// (/gpu-nvidia/0 and friends) so the two can never collide, and so a
    /// reader can tell at a glance that an entry carries no sensors. The index
    /// disambiguates two identical cards.
    /// </summary>
    public static string PlaceholderIdentifier(DisplayAdapters.DisplayAdapter adapter, int index) =>
        $"/gpu-absent/{adapter.VendorId}-{adapter.DeviceId}-{index}";

    public static bool IsGpu(HardwareType type) =>
        type is HardwareType.GpuNvidia or HardwareType.GpuAmd or HardwareType.GpuIntel;
}
