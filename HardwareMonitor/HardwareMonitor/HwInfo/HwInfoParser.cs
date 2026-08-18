using System.Text;
using System.Text.RegularExpressions;

namespace HardwareMonitor.HwInfo;

public enum HwInfoParseStatus
{
    Ok,
    Dead,
    Invalid,
}

public sealed class HwInfoHeader
{
    public uint Signature { get; init; }
    public uint Version { get; init; }
    public uint Revision { get; init; }
    public long PollTime { get; init; }
    public int OffsetOfSensorSection { get; init; }
    public int SizeOfSensorElement { get; init; }
    public int NumSensorElements { get; init; }
    public int OffsetOfReadingSection { get; init; }
    public int SizeOfReadingElement { get; init; }
    public int NumReadingElements { get; init; }
    public int PollingPeriod { get; init; }
}

public sealed class HwInfoHardware
{
    public required string Name { get; init; }
    public required string Identifier { get; init; }
    public required int HardwareType { get; init; }
}

public sealed class HwInfoReading
{
    public required string Name { get; init; }
    public required string Identifier { get; init; }
    public required string HardwareIdentifier { get; init; }
    public required int SensorType { get; init; }
    public required float Value { get; init; }
}

public sealed class HwInfoSnapshot
{
    public required HwInfoHeader Header { get; init; }
    public required List<HwInfoHardware> Hardwares { get; init; }
    public required List<HwInfoReading> Sensors { get; init; }
}

public readonly struct HwInfoParseResult
{
    public HwInfoParseStatus Status { get; init; }
    public HwInfoSnapshot? Snapshot { get; init; }

    public static HwInfoParseResult Ok(HwInfoSnapshot snapshot) => new()
    {
        Status = HwInfoParseStatus.Ok,
        Snapshot = snapshot,
    };

    public static HwInfoParseResult Dead() => new() { Status = HwInfoParseStatus.Dead };

    public static HwInfoParseResult Invalid() => new() { Status = HwInfoParseStatus.Invalid };
}

/// <summary>
/// Parses an HWiNFO sensor shared-memory buffer into the existing
/// HardwareMonitor hardware/sensor list shape.
/// </summary>
public static class HwInfoParser
{
    public const uint SignatureActive = 0x53695748; // "HWiS"
    public const uint SignatureDead = 0x44414544;   // "DEAD"

    public const int MinHeaderSize = 44;
    public const int HeaderSizeWithPollingPeriod = 48;
    public const int SensorNameLength = 128;
    public const int UnitLength = 16;
    public const int DefaultSensorElementSize = 264;
    public const int DefaultReadingElementSize = 316;
    public const int MaxSharedMemoryBytes = 16 * 1024 * 1024;
    public const int MaxElements = 10_000;

    // Integer codes match LibreHardwareMonitor's HardwareType / SensorType.
    public const int HardwareMotherboard = 0;
    public const int HardwareCpu = 2;
    public const int HardwareMemory = 3;
    public const int HardwareGpuNvidia = 4;
    public const int HardwareGpuAmd = 5;
    public const int HardwareGpuIntel = 6;
    public const int HardwareStorage = 7;
    public const int HardwareNetwork = 8;
    public const int HardwarePsu = 11;
    public const int HardwareBattery = 12;

    public const int SensorVoltage = 0;
    public const int SensorCurrent = 1;
    public const int SensorPower = 2;
    public const int SensorClock = 3;
    public const int SensorTemperature = 4;
    public const int SensorLoad = 5;
    public const int SensorFan = 7;
    public const int SensorFactor = 11;
    public const int SensorSmallData = 13;
    public const int SensorThroughput = 14;
    public const int SensorTimeSpan = 15;

    public static HwInfoParseResult Parse(ReadOnlySpan<byte> buffer)
    {
        if (!TryReadHeader(buffer, out var header))
            return HwInfoParseResult.Invalid();

        if (header.Signature == SignatureDead)
            return HwInfoParseResult.Dead();

        if (header.Signature != SignatureActive)
            return HwInfoParseResult.Invalid();

        if (!IsHeaderSane(header, buffer.Length))
            return HwInfoParseResult.Invalid();

        if (header.NumSensorElements == 0 || header.NumReadingElements == 0)
            return HwInfoParseResult.Invalid();

        var sensors = ReadSensors(buffer, header);
        if (sensors.Count != header.NumSensorElements)
            return HwInfoParseResult.Invalid();

        var readings = ReadReadings(buffer, header, sensors);
        if (readings.Count == 0)
            return HwInfoParseResult.Invalid();

        return HwInfoParseResult.Ok(new HwInfoSnapshot
        {
            Header = header,
            Hardwares = sensors.ConvertAll(s => s.Hardware),
            Sensors = readings,
        });
    }

    public static bool TryReadHeader(ReadOnlySpan<byte> buffer, out HwInfoHeader header)
    {
        header = null!;
        if (buffer.Length < MinHeaderSize)
            return false;

        header = new HwInfoHeader
        {
            Signature = ReadU32(buffer, 0),
            Version = ReadU32(buffer, 4),
            Revision = ReadU32(buffer, 8),
            PollTime = ReadI64(buffer, 12),
            OffsetOfSensorSection = ReadI32(buffer, 20),
            SizeOfSensorElement = ReadI32(buffer, 24),
            NumSensorElements = ReadI32(buffer, 28),
            OffsetOfReadingSection = ReadI32(buffer, 32),
            SizeOfReadingElement = ReadI32(buffer, 36),
            NumReadingElements = ReadI32(buffer, 40),
            PollingPeriod = buffer.Length >= HeaderSizeWithPollingPeriod ? ReadI32(buffer, 44) : 0,
        };
        return true;
    }

    public static bool IsHealthyActiveHeader(HwInfoHeader header) =>
        header.Signature == SignatureActive
        && IsHeaderSane(header, int.MaxValue)
        && header.NumSensorElements > 0
        && header.NumReadingElements > 0;

    private static bool IsHeaderSane(HwInfoHeader header, int bufferLength)
    {
        if (header.SizeOfSensorElement < DefaultSensorElementSize
            || header.SizeOfReadingElement < DefaultReadingElementSize)
            return false;

        if (header.NumSensorElements is < 0 or > MaxElements)
            return false;
        if (header.NumReadingElements is < 0 or > MaxElements)
            return false;

        if (header.OffsetOfSensorSection < MinHeaderSize
            || header.OffsetOfReadingSection < MinHeaderSize)
            return false;

        long sensorEnd = (long)header.OffsetOfSensorSection
            + (long)header.SizeOfSensorElement * header.NumSensorElements;
        long readingEnd = (long)header.OffsetOfReadingSection
            + (long)header.SizeOfReadingElement * header.NumReadingElements;

        if (sensorEnd > MaxSharedMemoryBytes || readingEnd > MaxSharedMemoryBytes)
            return false;
        if (sensorEnd > bufferLength || readingEnd > bufferLength)
            return false;

        return true;
    }

    private readonly record struct ParsedHardware(uint SensorId, uint SensorInst, HwInfoHardware Hardware);

    private static List<ParsedHardware> ReadSensors(ReadOnlySpan<byte> buffer, HwInfoHeader header)
    {
        var list = new List<ParsedHardware>(header.NumSensorElements);
        for (var i = 0; i < header.NumSensorElements; i++)
        {
            var offset = header.OffsetOfSensorSection + (header.SizeOfSensorElement * i);
            if (offset + DefaultSensorElementSize > buffer.Length)
                return [];

            var sensorId = ReadU32(buffer, offset);
            var sensorInst = ReadU32(buffer, offset + 4);
            var nameOrig = ReadFixedString(buffer, offset + 8, SensorNameLength);
            var nameUser = ReadFixedString(buffer, offset + 8 + SensorNameLength, SensorNameLength);
            var name = string.IsNullOrWhiteSpace(nameUser) ? nameOrig : nameUser;
            if (string.IsNullOrWhiteSpace(name))
                name = $"Sensor {sensorId:x}";

            list.Add(new ParsedHardware(sensorId, sensorInst, new HwInfoHardware
            {
                Name = SanitizeName(name),
                Identifier = HardwareIdentifier(sensorId, sensorInst),
                HardwareType = InferHardwareType(nameOrig, nameUser),
            }));
        }

        return list;
    }

    private static List<HwInfoReading> ReadReadings(
        ReadOnlySpan<byte> buffer,
        HwInfoHeader header,
        List<ParsedHardware> sensors)
    {
        var list = new List<HwInfoReading>(header.NumReadingElements);
        for (var i = 0; i < header.NumReadingElements; i++)
        {
            var offset = header.OffsetOfReadingSection + (header.SizeOfReadingElement * i);
            if (offset + DefaultReadingElementSize > buffer.Length)
                return [];

            var readingType = ReadI32(buffer, offset);
            var sensorIndex = ReadI32(buffer, offset + 4);
            var readingId = ReadU32(buffer, offset + 8);
            var labelOrig = ReadFixedString(buffer, offset + 12, SensorNameLength);
            var labelUser = ReadFixedString(buffer, offset + 12 + SensorNameLength, SensorNameLength);
            var unit = ReadFixedString(buffer, offset + 12 + SensorNameLength * 2, UnitLength);
            var value = ReadDouble(buffer, offset + 12 + SensorNameLength * 2 + UnitLength);

            if (sensorIndex < 0 || sensorIndex >= sensors.Count)
                continue;

            var parsed = sensors[sensorIndex];
            var label = string.IsNullOrWhiteSpace(labelUser) ? labelOrig : labelUser;
            if (string.IsNullOrWhiteSpace(label))
                label = $"Reading {readingId}";

            var sensorType = MapReadingType(readingType, unit);
            list.Add(new HwInfoReading
            {
                Name = SanitizeName(label),
                Identifier = ReadingIdentifier(parsed.SensorId, parsed.SensorInst, readingId),
                HardwareIdentifier = parsed.Hardware.Identifier,
                SensorType = sensorType,
                Value = NormalizeReadingValue(sensorType, unit, value),
            });
        }

        return list;
    }

    public static string HardwareIdentifier(uint sensorId, uint sensorInst) =>
        $"/hwinfo/{sensorId:x}/{sensorInst:x}";

    public static string ReadingIdentifier(uint sensorId, uint sensorInst, uint readingId) =>
        $"/hwinfo/{sensorId:x}/{sensorInst:x}/{readingId:x}";

    public static int InferHardwareType(string nameOrig, string nameUser = "")
    {
        var n = $"{nameOrig} {nameUser}".ToLowerInvariant();

        if (ContainsAny(n, "nvidia", "geforce", "quadro", "rtx", "gtx"))
            return HardwareGpuNvidia;
        if (ContainsAny(n, "radeon", "rx ", "vega", "amd gpu"))
            return HardwareGpuAmd;
        if (ContainsAny(n, "intel arc", "iris", "uhd graphics", "intel gpu"))
            return HardwareGpuIntel;
        if (n.Contains("gpu") || n.Contains("graphics"))
        {
            if (n.Contains("amd")) return HardwareGpuAmd;
            if (n.Contains("intel")) return HardwareGpuIntel;
            return HardwareGpuNvidia;
        }

        if (ContainsAny(n, "cpu", "processor", "ryzen", "core i", "threadripper", "epyc", "xeon"))
            return HardwareCpu;
        if (ContainsAny(n, "memory", "ram", "dimm", "sdram"))
            return HardwareMemory;
        if (ContainsAny(n, "network", "lan", "wifi", "wi-fi", "ethernet", "nic", "killer"))
            return HardwareNetwork;
        if (ContainsAny(n, "nvme", "ssd", "hdd", "drive", "s.m.a.r.t", "smart"))
            return HardwareStorage;
        if (n.Contains("battery"))
            return HardwareBattery;
        if (n.Contains("psu") || n.Contains("power supply"))
            return HardwarePsu;

        return HardwareMotherboard;
    }

    public static int MapReadingType(int readingType, string unit)
    {
        return readingType switch
        {
            1 => SensorTemperature,
            2 => SensorVoltage,
            3 => SensorFan,
            4 => SensorCurrent,
            5 => SensorPower,
            6 => SensorClock,
            7 => SensorLoad,
            _ => InferFromUnit(unit),
        };
    }

    public static int InferFromUnit(string unit)
    {
        var u = unit.Trim().ToLowerInvariant();
        if (u is "%" or "percent")
            return SensorLoad;
        if (u is "c" or "°c" or "f" or "°f" or "degc" or "degf")
            return SensorTemperature;
        if (u is "w" or "mw" or "kw")
            return SensorPower;
        if (u is "v" or "mv")
            return SensorVoltage;
        if (u is "a" or "ma")
            return SensorCurrent;
        if (u is "rpm")
            return SensorFan;
        if (u is "mhz" or "ghz" or "hz" or "khz")
            return SensorClock;
        if (u.Contains("/s") || u is "kbps" or "mbps" or "gbps")
            return SensorThroughput;
        if (u is "mb" or "gb" or "tb" or "kb")
            return SensorSmallData;
        if (u is "ms" or "s")
            return SensorTimeSpan;
        return SensorFactor;
    }

    /// <summary>
    /// Overlay/LHM throughput is bytes/s. HWiNFO publishes KB/s (and similar)
    /// for Current DL/UP rate, so convert at the mapping boundary.
    /// </summary>
    public static float NormalizeReadingValue(int sensorType, string unit, double value)
    {
        if (double.IsNaN(value) || double.IsInfinity(value))
            return 0f;

        if (sensorType == SensorThroughput)
            value *= ThroughputBytesPerSecondScale(unit);

        return (float)value;
    }

    public static double ThroughputBytesPerSecondScale(string unit)
    {
        var u = unit.Trim().ToLowerInvariant().Replace(" ", "");
        return u switch
        {
            "kb/s" or "kbyte/s" or "kbytes/s" or "kib/s" or "kib/sec" => 1024,
            "mb/s" or "mbyte/s" or "mbytes/s" or "mib/s" => 1024d * 1024,
            "gb/s" or "gbyte/s" or "gbytes/s" or "gib/s" => 1024d * 1024 * 1024,
            "kbps" or "kbit/s" => 1000d / 8,
            "mbps" or "mbit/s" => 1_000_000d / 8,
            "gbps" or "gbit/s" => 1_000_000_000d / 8,
            _ => 1,
        };
    }

    private static string SanitizeName(string name) =>
        Regex.Replace(name, "[^a-zA-Z0-9_ .]+", "_", RegexOptions.Compiled);

    private static bool ContainsAny(string haystack, params string[] needles)
    {
        foreach (var needle in needles)
        {
            if (haystack.Contains(needle))
                return true;
        }

        return false;
    }

    private static uint ReadU32(ReadOnlySpan<byte> buffer, int offset) =>
        BitConverter.ToUInt32(buffer.Slice(offset, 4));

    private static int ReadI32(ReadOnlySpan<byte> buffer, int offset) =>
        BitConverter.ToInt32(buffer.Slice(offset, 4));

    private static long ReadI64(ReadOnlySpan<byte> buffer, int offset) =>
        BitConverter.ToInt64(buffer.Slice(offset, 8));

    private static double ReadDouble(ReadOnlySpan<byte> buffer, int offset) =>
        BitConverter.ToDouble(buffer.Slice(offset, 8));

    private static string ReadFixedString(ReadOnlySpan<byte> buffer, int offset, int maxLen)
    {
        var limit = Math.Min(offset + maxLen, buffer.Length);
        var end = offset;
        while (end < limit && buffer[end] != 0)
            end++;
        return Encoding.Latin1.GetString(buffer.Slice(offset, end - offset)).Trim();
    }
}
