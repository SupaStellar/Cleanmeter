using System.Text;
using HardwareMonitor.HwInfo;
using HardwareMonitor.Monitor;
using Xunit;

namespace HardwareMonitor.Tests;

public class HwInfoParserTests
{
    [Fact]
    public void DeadSignatureIsDeadNotActive()
    {
        var buffer = Header(HwInfoParser.SignatureDead, sensorCount: 1, readingCount: 1);
        var result = HwInfoParser.Parse(buffer);
        Assert.Equal(HwInfoParseStatus.Dead, result.Status);
        Assert.Null(result.Snapshot);
    }

    [Fact]
    public void MissingBufferIsInvalid()
    {
        var result = HwInfoParser.Parse([]);
        Assert.Equal(HwInfoParseStatus.Invalid, result.Status);
    }

    [Fact]
    public void TruncatedHeaderIsInvalid()
    {
        var result = HwInfoParser.Parse(new byte[20]);
        Assert.Equal(HwInfoParseStatus.Invalid, result.Status);
    }

    [Fact]
    public void UnknownSignatureIsInvalid()
    {
        var buffer = Header(0x464F4F42, sensorCount: 1, readingCount: 1);
        Assert.Equal(HwInfoParseStatus.Invalid, HwInfoParser.Parse(buffer).Status);
    }

    [Fact]
    public void ActiveHeaderWithNoReadingsFallsBack()
    {
        var buffer = Header(HwInfoParser.SignatureActive, sensorCount: 0, readingCount: 0);
        Assert.Equal(HwInfoParseStatus.Invalid, HwInfoParser.Parse(buffer).Status);
    }

    [Fact]
    public void ActiveSnapshotMapsStableIdsAndLeavesLabelsForDisplay()
    {
        var buffer = BuildSnapshot(
            sensorId: 0xE0000200,
            sensorInst: 1,
            sensorName: "CPU [#0]: AMD Ryzen",
            readings:
            [
                (1, 0x100u, "CPU Package", "°C", 67.5),
                (7, 0x200u, "CPU Total Load", "%", 22.0),
            ]);

        var result = HwInfoParser.Parse(buffer);
        Assert.Equal(HwInfoParseStatus.Ok, result.Status);
        var snapshot = result.Snapshot!;
        Assert.Equal(1, snapshot.Header.NumSensorElements);
        Assert.Equal(500, snapshot.Header.PollingPeriod);
        Assert.Equal("/hwinfo/e0000200/1", snapshot.Hardwares[0].Identifier);
        Assert.Equal(HwInfoParser.HardwareCpu, snapshot.Hardwares[0].HardwareType);
        Assert.Equal("CPU Package", snapshot.Sensors[0].Name);
        Assert.Equal("/hwinfo/e0000200/1/100", snapshot.Sensors[0].Identifier);
        Assert.Equal("/hwinfo/e0000200/1", snapshot.Sensors[0].HardwareIdentifier);
        Assert.Equal(HwInfoParser.SensorTemperature, snapshot.Sensors[0].SensorType);
        Assert.Equal(67.5f, snapshot.Sensors[0].Value, 3);
        Assert.Equal(HwInfoParser.SensorLoad, snapshot.Sensors[1].SensorType);
    }

    [Fact]
    public void IdentifiersStayStableWhenEnglishLabelsChange()
    {
        var first = HwInfoParser.Parse(BuildSnapshot(
            0x1000, 0, "GPU", [(1, 0x10u, "GPU Core", "°C", 40)])).Snapshot!;
        var second = HwInfoParser.Parse(BuildSnapshot(
            0x1000, 0, "GPU", [(1, 0x10u, "GPU Nucleo", "°C", 41)])).Snapshot!;

        Assert.Equal(first.Sensors[0].Identifier, second.Sensors[0].Identifier);
        Assert.Equal("GPU Nucleo", second.Sensors[0].Name);
    }

    [Fact]
    public void OtherNetworkRateBecomesThroughputFromUnit()
    {
        Assert.Equal(HwInfoParser.SensorThroughput, HwInfoParser.MapReadingType(8, "KB/s"));
        Assert.Equal(HwInfoParser.SensorLoad, HwInfoParser.MapReadingType(7, "%"));
        Assert.Equal(HwInfoParser.SensorTemperature, HwInfoParser.MapReadingType(1, "C"));
        Assert.Equal(HwInfoParser.SensorSmallData, HwInfoParser.InferFromUnit("MB"));
    }

    [Fact]
    public void NetworkRatesInKilobytesPerSecondAreConvertedToBytesPerSecond()
    {
        Assert.Equal(1024, HwInfoParser.ThroughputBytesPerSecondScale("KB/s"));
        Assert.Equal(1024d * 1024, HwInfoParser.ThroughputBytesPerSecondScale("MB/s"));
        Assert.Equal(1, HwInfoParser.ThroughputBytesPerSecondScale("B/s"));

        var snapshot = HwInfoParser.Parse(BuildSnapshot(
            0x2000, 0, "Network: Intel Ethernet",
            [
                (8, 0x1u, "Current DL rate", "KB/s", 100),
                (8, 0x2u, "Current UP rate", "KB/s", 2.5),
            ])).Snapshot!;

        Assert.Equal(HwInfoParser.SensorThroughput, snapshot.Sensors[0].SensorType);
        Assert.Equal(100 * 1024, snapshot.Sensors[0].Value, 1);
        Assert.Equal(2.5f * 1024, snapshot.Sensors[1].Value, 1);
    }

    [Fact]
    public void NonThroughputReadingsAreNotScaledByUnit()
    {
        Assert.Equal(67.5f, HwInfoParser.NormalizeReadingValue(HwInfoParser.SensorTemperature, "°C", 67.5), 3);
        Assert.Equal(22f, HwInfoParser.NormalizeReadingValue(HwInfoParser.SensorLoad, "%", 22), 3);
    }

    [Fact]
    public void HardwareTypeUsesSensorNameNotReadingLabel()
    {
        Assert.Equal(HwInfoParser.HardwareGpuNvidia, HwInfoParser.InferHardwareType("GPU [#0]: NVIDIA GeForce RTX 4090"));
        Assert.Equal(HwInfoParser.HardwareGpuAmd, HwInfoParser.InferHardwareType("GPU [#1]: AMD Radeon RX 7800 XT"));
        Assert.Equal(HwInfoParser.HardwareMemory, HwInfoParser.InferHardwareType("Memory"));
        Assert.Equal(HwInfoParser.HardwareNetwork, HwInfoParser.InferHardwareType("Network: Intel Ethernet"));
        Assert.Equal(HwInfoParser.HardwareCpu, HwInfoParser.InferHardwareType("CPU [#0]: Intel Core i7"));
    }

    [Theory]
    [InlineData(44)]
    [InlineData(48)]
    public void HeaderLayoutAcceptsClassicAndPollingPeriodSizes(int headerBytes)
    {
        var buffer = Header(
            HwInfoParser.SignatureActive,
            sensorCount: 1,
            readingCount: 1,
            headerSize: headerBytes);
        WriteSensor(buffer, 0, 0x1, 0, "CPU");
        WriteReading(buffer, 0, readingType: 7, sensorIndex: 0, readingId: 1, "Load", "%", 10);

        Assert.True(HwInfoParser.TryReadHeader(buffer, out var header));
        Assert.Equal(HwInfoParser.SignatureActive, header.Signature);
        Assert.Equal(headerBytes >= 48 ? 500 : 0, header.PollingPeriod);
        Assert.Equal(HwInfoParseStatus.Ok, HwInfoParser.Parse(buffer).Status);
    }

    private static byte[] BuildSnapshot(
        uint sensorId,
        uint sensorInst,
        string sensorName,
        (int type, uint id, string label, string unit, double value)[] readings)
    {
        var buffer = Header(
            HwInfoParser.SignatureActive,
            sensorCount: 1,
            readingCount: readings.Length);
        WriteSensor(buffer, 0, sensorId, sensorInst, sensorName);
        for (var i = 0; i < readings.Length; i++)
        {
            var r = readings[i];
            WriteReading(buffer, i, r.type, 0, r.id, r.label, r.unit, r.value);
        }

        return buffer;
    }

    private static byte[] Header(
        uint signature,
        int sensorCount,
        int readingCount,
        int headerSize = HwInfoParser.HeaderSizeWithPollingPeriod)
    {
        var sensorOffset = Math.Max(headerSize, HwInfoParser.HeaderSizeWithPollingPeriod);
        var readingOffset = sensorOffset + HwInfoParser.DefaultSensorElementSize * Math.Max(sensorCount, 1);
        var total = readingOffset + HwInfoParser.DefaultReadingElementSize * Math.Max(readingCount, 1);
        var buffer = new byte[total];

        WriteU32(buffer, 0, signature);
        WriteU32(buffer, 4, 2);
        WriteU32(buffer, 8, 1);
        WriteI64(buffer, 12, 0);
        WriteI32(buffer, 20, sensorOffset);
        WriteI32(buffer, 24, HwInfoParser.DefaultSensorElementSize);
        WriteI32(buffer, 28, sensorCount);
        WriteI32(buffer, 32, readingOffset);
        WriteI32(buffer, 36, HwInfoParser.DefaultReadingElementSize);
        WriteI32(buffer, 40, readingCount);
        if (headerSize >= HwInfoParser.HeaderSizeWithPollingPeriod)
            WriteI32(buffer, 44, 500);

        return buffer;
    }

    private static void WriteSensor(byte[] buffer, int index, uint id, uint inst, string name)
    {
        Assert.True(HwInfoParser.TryReadHeader(buffer, out var header));
        var offset = header.OffsetOfSensorSection + header.SizeOfSensorElement * index;
        WriteU32(buffer, offset, id);
        WriteU32(buffer, offset + 4, inst);
        WriteFixed(buffer, offset + 8, name, HwInfoParser.SensorNameLength);
        WriteFixed(buffer, offset + 8 + HwInfoParser.SensorNameLength, name, HwInfoParser.SensorNameLength);
    }

    private static void WriteReading(
        byte[] buffer,
        int index,
        int readingType,
        int sensorIndex,
        uint readingId,
        string label,
        string unit,
        double value)
    {
        Assert.True(HwInfoParser.TryReadHeader(buffer, out var header));
        var offset = header.OffsetOfReadingSection + header.SizeOfReadingElement * index;
        WriteI32(buffer, offset, readingType);
        WriteI32(buffer, offset + 4, sensorIndex);
        WriteU32(buffer, offset + 8, readingId);
        WriteFixed(buffer, offset + 12, label, HwInfoParser.SensorNameLength);
        WriteFixed(buffer, offset + 12 + HwInfoParser.SensorNameLength, label, HwInfoParser.SensorNameLength);
        WriteFixed(buffer, offset + 12 + HwInfoParser.SensorNameLength * 2, unit, HwInfoParser.UnitLength);
        WriteDouble(buffer, offset + 12 + HwInfoParser.SensorNameLength * 2 + HwInfoParser.UnitLength, value);
    }

    private static void WriteU32(byte[] buffer, int offset, uint value) =>
        BitConverter.TryWriteBytes(buffer.AsSpan(offset, 4), value);

    private static void WriteI32(byte[] buffer, int offset, int value) =>
        BitConverter.TryWriteBytes(buffer.AsSpan(offset, 4), value);

    private static void WriteI64(byte[] buffer, int offset, long value) =>
        BitConverter.TryWriteBytes(buffer.AsSpan(offset, 8), value);

    private static void WriteDouble(byte[] buffer, int offset, double value) =>
        BitConverter.TryWriteBytes(buffer.AsSpan(offset, 8), value);

    private static void WriteFixed(byte[] buffer, int offset, string value, int length)
    {
        var bytes = Encoding.Latin1.GetBytes(value);
        var n = Math.Min(bytes.Length, length - 1);
        Array.Copy(bytes, 0, buffer, offset, n);
    }
}

public class HwInfoSourcePolicyTests
{
    [Fact]
    public void AutoUsesHwInfoWhenHealthyAndFallsBackSilentlyIfNeverSeen()
    {
        Assert.True(HwInfoSourcePolicy.WantsHwInfo(SensorSourcePreference.Auto));
        Assert.False(HwInfoSourcePolicy.ShouldReportFallback(
            SensorSourcePreference.Auto, usingHwInfo: false, hwInfoSeenThisSession: false));
        Assert.True(HwInfoSourcePolicy.ShouldReportFallback(
            SensorSourcePreference.Auto, usingHwInfo: false, hwInfoSeenThisSession: true));
    }

    [Fact]
    public void ForcedHwInfoReportsFallbackWhenSharedMemoryIsMissingOrDead()
    {
        Assert.True(HwInfoSourcePolicy.WantsHwInfo(SensorSourcePreference.Hwinfo));
        Assert.True(HwInfoSourcePolicy.ShouldReportFallback(
            SensorSourcePreference.Hwinfo, usingHwInfo: false, hwInfoSeenThisSession: false));
        Assert.False(HwInfoSourcePolicy.ShouldReportFallback(
            SensorSourcePreference.Hwinfo, usingHwInfo: true, hwInfoSeenThisSession: true));
    }

    [Fact]
    public void LhmNeverTouchesHwInfoAndNeverReportsFallback()
    {
        Assert.False(HwInfoSourcePolicy.WantsHwInfo(SensorSourcePreference.Lhm));
        Assert.False(HwInfoSourcePolicy.ShouldReportFallback(
            SensorSourcePreference.Lhm, usingHwInfo: false, hwInfoSeenThisSession: true));
    }
}
