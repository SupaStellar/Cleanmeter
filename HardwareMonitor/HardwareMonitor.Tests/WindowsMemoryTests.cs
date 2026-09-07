using HardwareMonitor.Monitor;
using LibreHardwareMonitor.Hardware;
using Xunit;

namespace HardwareMonitor.Tests;

public class WindowsMemoryTests
{
    private const ulong GiB = 1024UL * 1024 * 1024;

    [Fact]
    public void PhysicalAndCommittedUsageKeepExistingSensorIdsAndUnits()
    {
        var sample = new WindowsMemoryHardware.Snapshot(32 * GiB, 12 * GiB, 64 * GiB, 40 * GiB);
        var physical = new WindowsMemoryHardware(read: () => sample);
        var committed = new WindowsMemoryHardware(virtualMemory: true, read: () => sample);
        physical.Update();
        committed.Update();
        var sensors = physical.Sensors.Concat(committed.Sensors).ToDictionary(s => s.Identifier.ToString());
        Assert.Equal(20f, sensors["/ram/data/0"].Value);
        Assert.Equal(12f, sensors["/ram/data/1"].Value);
        Assert.Equal(62.5f, sensors["/ram/load/0"].Value);
        Assert.Equal(24f, sensors["/vram/data/2"].Value);
        Assert.Equal(40f, sensors["/vram/data/3"].Value);
        Assert.Equal(37.5f, sensors["/vram/load/1"].Value);
        Assert.All(sensors.Values, s => Assert.Equal(HardwareType.Memory, s.Hardware.HardwareType));

        sample = sample with { AvailablePhysical = 24 * GiB };
        physical.Update();
        Assert.Equal(25f, sensors["/ram/load/0"].Value);
        Assert.Equal(8f, sensors["/ram/data/0"].Value);
    }

    [Fact]
    public void InvalidZeroTotalDoesNotProduceNaNOrInfinity()
    {
        var memory = new WindowsMemoryHardware(read: () => default);
        memory.Update();
        Assert.All(memory.Sensors, sensor => Assert.Null(sensor.Value));
    }

    [Fact]
    public void InconsistentAvailabilityDoesNotUnderflowUnsignedCounters()
    {
        var memory = new WindowsMemoryHardware(read: () => new(32 * GiB, 33 * GiB, 0, 0));
        memory.Update();
        Assert.Equal(0f, memory.Sensors.Single(s => s.SensorType == SensorType.Load).Value);
        Assert.Equal(0f, memory.Sensors.Single(s => s.Identifier.ToString() == "/ram/data/0").Value);
    }

    [Fact]
    public void RealWindowsApiProvidesMemoryWithoutAnyHardwareDiscovery()
    {
        if (!OperatingSystem.IsWindows()) return;
        var sample = WindowsMemoryHardware.ReadWindows();
        Assert.True(sample.TotalPhysical > 0);
        Assert.InRange(sample.AvailablePhysical, 0UL, sample.TotalPhysical);
        var hardware = new WindowsMemoryHardware();
        hardware.Update();
        var load = hardware.Sensors.Single(s => s.SensorType == SensorType.Load).Value;
        Assert.NotNull(load);
        Assert.InRange(load.Value, 0f, 100f);
    }
}
