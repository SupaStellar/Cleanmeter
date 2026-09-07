using System.ComponentModel;
using System.Runtime.InteropServices;
using LibreHardwareMonitor.Hardware;

namespace HardwareMonitor.Monitor;

/// <summary>
/// OS memory usage only. Deliberately never creates LHM's MemoryGroup, whose
/// constructor also loads a RAM driver and probes DIMMs over SMBus. Those
/// optional temperature/detail probes must not gate ordinary RAM usage.
/// </summary>
internal sealed class WindowsMemoryHardware : IHardware
{
    internal readonly record struct Snapshot(ulong TotalPhysical, ulong AvailablePhysical,
        ulong TotalCommit, ulong AvailableCommit);

    private readonly bool _virtual;
    private readonly Func<Snapshot> _read;
    private readonly MemorySensor _used;
    private readonly MemorySensor _available;
    private readonly MemorySensor _load;

    internal WindowsMemoryHardware(bool virtualMemory = false, Func<Snapshot>? read = null)
    {
        _virtual = virtualMemory;
        _read = read ?? ReadWindows;
        Name = virtualMemory ? "Virtual Memory" : "Total Memory";
        Identifier = new Identifier(virtualMemory ? "vram" : "ram");
        // Preserve LHM 0.9.6 identifiers and GiB units, including its legacy
        // /vram name for system committed memory (not GPU VRAM).
        _used = new(this, "Memory Used", SensorType.Data, virtualMemory ? 2 : 0);
        _available = new(this, "Memory Available", SensorType.Data, virtualMemory ? 3 : 1);
        _load = new(this, "Memory", SensorType.Load, virtualMemory ? 1 : 0);
        Sensors = [_used, _available, _load];
    }

    public void Update()
    {
        var sample = _read();
        var total = _virtual ? sample.TotalCommit : sample.TotalPhysical;
        var available = Math.Min(total, _virtual ? sample.AvailableCommit : sample.AvailablePhysical);
        const double gib = 1024d * 1024 * 1024;
        _used.Set(total == 0 ? null : (float)((total - available) / gib));
        _available.Set(total == 0 ? null : (float)(available / gib));
        _load.Set(total == 0 ? null : (float)(100d * (total - available) / total));
    }

    public HardwareType HardwareType => HardwareType.Memory;
    public Identifier Identifier { get; }
    public string Name { get; set; }
    public IHardware Parent => null!;
    public ISensor[] Sensors { get; }
    public IHardware[] SubHardware => [];
    public IDictionary<string, string> Properties { get; } = new Dictionary<string, string>();
#pragma warning disable CS0067 // Fixed topology; these events never fire.
    public event SensorEventHandler? SensorAdded;
    public event SensorEventHandler? SensorRemoved;
#pragma warning restore CS0067
    public void Accept(IVisitor visitor) => visitor.VisitHardware(this);
    public void Traverse(IVisitor visitor) { foreach (var sensor in Sensors) sensor.Accept(visitor); }
    public string GetReport() => "Windows GlobalMemoryStatusEx; DIMM/SMBus probing disabled";

    [StructLayout(LayoutKind.Sequential)]
    private struct MemoryStatus
    {
        public uint Length;
        public uint Load;
        public ulong TotalPhysical;
        public ulong AvailablePhysical;
        public ulong TotalPageFile;
        public ulong AvailablePageFile;
        public ulong TotalVirtual;
        public ulong AvailableVirtual;
        public ulong AvailableExtendedVirtual;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GlobalMemoryStatusEx(ref MemoryStatus status);

    internal static Snapshot ReadWindows()
    {
        var status = new MemoryStatus { Length = (uint)Marshal.SizeOf<MemoryStatus>() };
        if (!GlobalMemoryStatusEx(ref status)) throw new Win32Exception(Marshal.GetLastWin32Error());
        return new(status.TotalPhysical, status.AvailablePhysical, status.TotalPageFile, status.AvailablePageFile);
    }

    private sealed class MemorySensor : ISensor
    {
        internal MemorySensor(IHardware hardware, string name, SensorType type, int index)
        {
            Hardware = hardware;
            Name = name;
            SensorType = type;
            Index = index;
            Identifier = new Identifier(hardware.Identifier, type.ToString().ToLowerInvariant(), index.ToString(System.Globalization.CultureInfo.InvariantCulture));
        }
        internal void Set(float? value)
        {
            Value = value;
            if (value is not { } v) return;
            Min = Min.HasValue ? Math.Min(Min.Value, v) : v;
            Max = Max.HasValue ? Math.Max(Max.Value, v) : v;
        }
        public IHardware Hardware { get; }
        public Identifier Identifier { get; }
        public string Name { get; set; }
        public SensorType SensorType { get; }
        public int Index { get; }
        public float? Value { get; private set; }
        public float? Min { get; private set; }
        public float? Max { get; private set; }
        public bool IsDefaultHidden => false;
        public IControl Control => null!;
        public IReadOnlyList<IParameter> Parameters => [];
        public IEnumerable<SensorValue> Values => [];
        public TimeSpan ValuesTimeWindow { get; set; } = TimeSpan.Zero;
        public void Accept(IVisitor visitor) => visitor.VisitSensor(this);
        public void Traverse(IVisitor visitor) { }
        public void ResetMin() => Min = Value;
        public void ResetMax() => Max = Value;
        public void ClearValues() { }
    }
}
