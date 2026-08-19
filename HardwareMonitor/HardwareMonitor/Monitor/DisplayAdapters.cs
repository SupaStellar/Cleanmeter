using System.Runtime.InteropServices;
using System.Text;
using LibreHardwareMonitor.Hardware;

namespace HardwareMonitor.Monitor;

/// <summary>
/// The GPUs Windows reports as physically present, read from the PnP device
/// tree rather than from a vendor SDK.
///
/// LibreHardwareMonitor builds its GPU list exactly once, in the constructors
/// of AmdGpuGroup / NvidiaGroup / IntelGpuGroup, from ADL / NvAPI / IntelGcl.
/// A vendor SDK that is not answering at that moment produces an empty group
/// which is never retried, so a machine can run an entire session with a GPU
/// the app never mentions. This is the second opinion that makes that
/// detectable: CfgMgr32 walks the device tree, so it sees a card whether or
/// not its vendor SDK is up, and whether or not the card is currently powered.
///
/// LibreHardwareMonitor runs the same enumeration internally, in
/// D3DDisplayDevice.GetDeviceIdentifiers, but that type is `internal` and
/// cannot be called from here.
/// </summary>
public static class DisplayAdapters
{
    /// <summary>A GPU the device tree reports as present.</summary>
    public readonly record struct DisplayAdapter(
        HardwareType Type,
        string VendorId,
        string DeviceId,
        string InstanceId,
        string Name);

    // GUID_DISPLAY_DEVICE_ARRIVAL. The interface class every display adapter
    // registers, which is what keeps this a GPU enumeration rather than a walk
    // of the whole device tree.
    private static Guid _displayDeviceArrival = new("1CA05180-A699-450A-9A0C-DE4FBE3DDD89");

    private const uint CmGetDeviceInterfaceListPresent = 0x00000001;
    private const uint CrSuccess = 0x00000000;
    private const uint CrBufferSmall = 0x0000001A;
    private const uint CmLocateDevNodeNormal = 0x00000000;
    private const uint CmDrpDeviceDesc = 0x00000001;
    private const uint RegSz = 0x00000001;

    // The three PCI vendor IDs that ship GPUs LibreHardwareMonitor has a
    // backend for. Anything else in the display class (Microsoft's Basic
    // Render Driver lives under ROOT\BasicRender, and remote-desktop and VM
    // software register their own virtual adapters) is not something we can
    // read sensors from, so listing it would only offer the user a dead choice.
    private const string VendorNvidia = "10DE";
    private const string VendorAmd = "1002";
    private const string VendorIntel = "8086";

    [DllImport("cfgmgr32.dll", CharSet = CharSet.Unicode, EntryPoint = "CM_Get_Device_Interface_List_SizeW")]
    private static extern uint CM_Get_Device_Interface_List_Size(
        out uint pulLen, ref Guid interfaceClassGuid, string? pDeviceId, uint ulFlags);

    [DllImport("cfgmgr32.dll", CharSet = CharSet.Unicode, EntryPoint = "CM_Get_Device_Interface_ListW")]
    private static extern uint CM_Get_Device_Interface_List(
        ref Guid interfaceClassGuid, string? pDeviceId, char[] buffer, uint bufferLen, uint ulFlags);

    [DllImport("cfgmgr32.dll", CharSet = CharSet.Unicode, EntryPoint = "CM_Locate_DevNodeW")]
    private static extern uint CM_Locate_DevNode(out uint pdnDevInst, string pDeviceId, uint ulFlags);

    [DllImport("cfgmgr32.dll", CharSet = CharSet.Unicode, EntryPoint = "CM_Get_DevNode_Registry_PropertyW")]
    private static extern uint CM_Get_DevNode_Registry_Property(
        uint dnDevInst, uint ulProperty, out uint pulRegDataType, byte[]? buffer, ref uint pulLength, uint ulFlags);

    /// <summary>
    /// Every present GPU from the three vendors above. Returns an empty list
    /// rather than throwing when the device tree cannot be read, so a failure
    /// here degrades to "no second opinion" instead of taking the sidecar down.
    /// </summary>
    public static IReadOnlyList<DisplayAdapter> Enumerate()
    {
        var adapters = new List<DisplayAdapter>();

        foreach (var path in GetInterfacePaths())
        {
            if (!TryParseInterfacePath(path, out var adapter))
                continue;

            adapters.Add(adapter with { Name = ReadDeviceDescription(adapter.InstanceId) ?? adapter.Name });
        }

        return adapters;
    }

    private static string[] GetInterfacePaths()
    {
        // Sizing the list and reading it are two calls against a device tree
        // that can change in between, which is what CR_BUFFER_SMALL means
        // here. Retry rather than truncate.
        for (var attempt = 0; attempt < 3; attempt++)
        {
            if (CM_Get_Device_Interface_List_Size(
                    out var size, ref _displayDeviceArrival, null, CmGetDeviceInterfaceListPresent) != CrSuccess)
            {
                return [];
            }

            if (size == 0)
                return [];

            var buffer = new char[size];
            var result = CM_Get_Device_Interface_List(
                ref _displayDeviceArrival, null, buffer, (uint)buffer.Length, CmGetDeviceInterfaceListPresent);

            if (result == CrSuccess)
                return new string(buffer).Split('\0', StringSplitOptions.RemoveEmptyEntries);

            if (result != CrBufferSmall)
                return [];
        }

        return [];
    }

    /// <summary>
    /// Pull the vendor and device out of a device interface path.
    ///
    /// A real card looks like
    ///   \\?\PCI#VEN_10DE&amp;DEV_2702&amp;SUBSYS_89641043&amp;REV_A1#4&amp;8fc2ab9&amp;0&amp;0009#{1ca05180-...}
    /// and Microsoft's software adapter looks like
    ///   \\?\ROOT#BasicRender#0000#{1ca05180-...}
    /// which has no VEN_ and is rejected here.
    ///
    /// False for anything that is not a PCI device from one of the three
    /// vendors we can read sensors from.
    /// </summary>
    internal static bool TryParseInterfacePath(string interfacePath, out DisplayAdapter adapter)
    {
        adapter = default;

        if (string.IsNullOrEmpty(interfacePath))
            return false;

        var vendorId = ReadHexToken(interfacePath, "VEN_");
        if (vendorId is null)
            return false;

        HardwareType type;
        switch (vendorId)
        {
            case VendorNvidia:
                type = HardwareType.GpuNvidia;
                break;
            case VendorAmd:
                type = HardwareType.GpuAmd;
                break;
            case VendorIntel:
                type = HardwareType.GpuIntel;
                break;
            default:
                return false;
        }

        var deviceId = ReadHexToken(interfacePath, "DEV_") ?? "";

        adapter = new DisplayAdapter(
            type,
            vendorId,
            deviceId,
            ToInstanceId(interfacePath),
            // Only used when the device tree has no description for the node.
            // Recognisable, and never blank, so the GPU stays selectable.
            $"{VendorName(type)} Graphics {deviceId}".TrimEnd());

        return true;
    }

    /// <summary>
    /// The 4 hex digits following a token, e.g. "VEN_" in "PCI#VEN_10DE&amp;DEV_2702".
    /// Null when the token is absent or is not followed by 4 hex digits.
    /// Upper-cased so callers can compare without picking a culture.
    /// </summary>
    internal static string? ReadHexToken(string value, string token)
    {
        var start = value.IndexOf(token, StringComparison.OrdinalIgnoreCase);
        if (start < 0)
            return null;

        start += token.Length;
        if (start + 4 > value.Length)
            return null;

        for (var i = start; i < start + 4; i++)
        {
            if (!Uri.IsHexDigit(value[i]))
                return null;
        }

        return value.Substring(start, 4).ToUpperInvariant();
    }

    /// <summary>
    /// Device interface path to device instance ID, which is what
    /// CM_Locate_DevNode takes:
    ///   \\?\PCI#VEN_10DE&amp;DEV_2702#4&amp;8fc2ab9&amp;0&amp;0009#{1ca05180-...}
    /// becomes
    ///   PCI\VEN_10DE&amp;DEV_2702\4&amp;8fc2ab9&amp;0&amp;0009
    /// Mirrors LibreHardwareMonitor's D3DDisplayDevice.GetActualDeviceIdentifier.
    /// </summary>
    internal static string ToInstanceId(string interfacePath)
    {
        var value = interfacePath;

        if (value.StartsWith(@"\\?\", StringComparison.Ordinal))
            value = value[4..];

        if (value.Length > 0 && value[^1] == '}')
        {
            var brace = value.LastIndexOf('{');
            // The brace is preceded by the '#' separating it from the
            // instance, so that goes too. brace > 0 keeps a malformed path
            // from producing a negative length.
            if (brace > 0)
                value = value[..(brace - 1)];
        }

        return value.Replace('#', '\\');
    }

    /// <summary>
    /// The device tree's description for a node, e.g. "NVIDIA GeForce RTX 4080
    /// SUPER". Null when the node cannot be located or has no description, in
    /// which case the caller keeps its vendor-and-device fallback name.
    /// </summary>
    private static string? ReadDeviceDescription(string instanceId)
    {
        if (CM_Locate_DevNode(out var devInst, instanceId, CmLocateDevNodeNormal) != CrSuccess)
            return null;

        uint length = 0;
        var sized = CM_Get_DevNode_Registry_Property(devInst, CmDrpDeviceDesc, out _, null, ref length, 0);

        if ((sized != CrSuccess && sized != CrBufferSmall) || length == 0)
            return null;

        var buffer = new byte[length];
        if (CM_Get_DevNode_Registry_Property(devInst, CmDrpDeviceDesc, out var type, buffer, ref length, 0) != CrSuccess)
            return null;

        // DeviceDesc is REG_SZ on every device Windows populates it for, but
        // the property is registry-backed and nothing guarantees the type.
        // Decoding a REG_BINARY or REG_MULTI_SZ as UTF-16 would put mojibake in
        // the GPU picker, so anything else falls back to the caller's name.
        if (type != RegSz)
            return null;

        return CleanDeviceDescription(Encoding.Unicode.GetString(buffer));
    }

    /// <summary>
    /// Device descriptions come back NUL-terminated, and sometimes still in
    /// the INF's unresolved form:
    ///   "@oem12.inf,%nvidia_dev.2702%;NVIDIA GeForce RTX 4080 SUPER"
    /// The readable half is whatever follows the last ';'. Null for an empty
    /// result, so the caller falls back rather than showing a blank row.
    /// </summary>
    internal static string? CleanDeviceDescription(string raw)
    {
        var value = raw;

        var nul = value.IndexOf('\0');
        if (nul >= 0)
            value = value[..nul];

        var semicolon = value.LastIndexOf(';');
        if (semicolon >= 0 && semicolon < value.Length - 1)
            value = value[(semicolon + 1)..];

        value = value.Trim();

        return value.Length == 0 ? null : value;
    }

    private static string VendorName(HardwareType type)
    {
        switch (type)
        {
            case HardwareType.GpuNvidia:
                return "NVIDIA";
            case HardwareType.GpuAmd:
                return "AMD";
            case HardwareType.GpuIntel:
                return "Intel";
            default:
                return "Unknown";
        }
    }
}
