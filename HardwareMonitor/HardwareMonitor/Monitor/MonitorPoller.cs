#pragma warning disable CS8601 // Possible null

using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using HardwareMonitor.PresentMon;
using HardwareMonitor.SharedMemory;
using HardwareMonitor.Sockets;
using LibreHardwareMonitor.Hardware;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HardwareMonitor.Monitor;

public class MonitorPoller(
    IHostApplicationLifetime hostApplicationLifetime,
    ILogger<MonitorPoller> logger
) : BackgroundService
{
    private readonly Computer _computer = new()
    {
        IsCpuEnabled = true,
        IsGpuEnabled = true,
        IsMemoryEnabled = true,
        IsMotherboardEnabled = true,
        IsControllerEnabled = true,
        IsNetworkEnabled = true,
        IsPsuEnabled = true,
        IsBatteryEnabled = true,
        IsStorageEnabled = true,
    };

    private PipeHost _socketHost = new(logger);
    private readonly PresentMonPoller _presentMonPoller = new(logger);

    private short _pollingRate = 500;
    private const short MinimalPollingRate = 33;

    // How many times a change to the active sensor set is worth logging.
    private const int SensorSetChangeLogLimit = 5;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Starting monitor");

        // The LibreHardwareMonitor kernel driver (WinRing0) can be quarantined
        // or blocked — Windows Defender flags it as
        // "VulnerableDriver:WinNT/Winring0", and HVCI / Smart App Control can
        // refuse to load it. If Open() throws, swallow it so the sidecar keeps
        // running: FPS (PresentMon) and any sensors that don't need ring0 stay
        // alive instead of crashing the process into the supervisor's respawn
        // loop. Only low-level readings (CPU temperature/power via MSRs) are
        // lost. See SECURITY.md.
        try
        {
            _computer.Open();
            _computer.Accept(new UpdateVisitor());
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "LibreHardwareMonitor failed to initialize — the kernel driver may be " +
                "blocked or quarantined (Windows Defender 'VulnerableDriver:WinNT/Winring0'). " +
                "Continuing with FPS and any sensors that initialized; low-level CPU sensors " +
                "may be unavailable.");
        }

        // Log discovered hardware and sensor counts for diagnostics
        int hwCount = 0, sensorCount = 0;
        foreach (var hw in _computer.Hardware)
        {
            hwCount++;
            sensorCount += hw.Sensors.Length;
            logger.LogInformation("Hardware: {Name} ({Type}) - {Count} sensors", hw.Name, hw.HardwareType, hw.Sensors.Length);
            foreach (var sub in hw.SubHardware)
            {
                hwCount++;
                sensorCount += sub.Sensors.Length;
                logger.LogInformation("  SubHardware: {Name} - {Count} sensors", sub.Name, sub.Sensors.Length);
            }
        }
        logger.LogInformation("Total hardware: {HW}, sensors: {Sensors}", hwCount, sensorCount);

        // Log first few sensor values to check if readings are non-zero
        int logged = 0;
        foreach (var hw in _computer.Hardware)
        {
            foreach (var s in hw.Sensors)
            {
                if (logged++ < 10)
                    logger.LogInformation("  Sample sensor: {HW} / {Name} ({Type}) = {Value}", hw.Name, s.Name, s.SensorType, s.Value);
            }
            if (logged >= 10) break;
        }

        // Deliberately not awaited: Start runs for the lifetime of the sidecar.
        // It returns a Task (rather than being async void) so a failure inside it
        // can no longer reach the thread pool unhandled and kill the process; it
        // logs and leaves sensors running instead.
        _ = _presentMonPoller.Start(stoppingToken);
        _presentMonPoller.OnUpdateApps += SendPresentMonAppsToClients;
        _socketHost.StartServer();
        _socketHost.OnClientData += OnClientData;
        _socketHost.OnClientConnected += OnClientConnected;

        var sharedMemoryData = QueryHardwareData();
        var knownSensorCount = CountActiveSensors();
        var sensorSetChanges = 0;

        using var memoryStream = new MemoryStream();
        using var writer = new BinaryWriter(memoryStream);
        var accumulator = 0;

        WriteDataToStream(writer, sharedMemoryData);

        while (!stoppingToken.IsCancellationRequested)
        {
            if (!_socketHost.HasConnections())
            {
                //logger.LogInformation("No clients connected, waiting for connections...");
                await Task.Delay(1000, stoppingToken);
                continue;
            }

            foreach (var hardware in sharedMemoryData.Hardwares)
            {
                try
                {
                    hardware.Update();
                }
                catch
                {
                    hardware.StopUpdates();
                    logger.LogError("Stopping updates of {HardwareName} - {HardwareIdentifier}", hardware.Name, hardware.Identifier);
                }
            }

            // LibreHardwareMonitor only exposes a sensor once it has produced a
            // reading (Hardware.Sensors returns the activated set). AMD GPUs read
            // temperature, power, core load and memory load through ADL's PMLog
            // sampling session, which has no sample yet on the first Update(),
            // so those sensors activate a poll or two later: after the snapshot
            // above was taken, and so were never sent to the app. Re-map the
            // sensor list when that set changes so late arrivals still land.
            //
            // Hardware is re-mapped alongside it so a sensor is never sent
            // referencing hardware the client has no entry for; MapHardwares
            // reuses existing entries, so a StopUpdates() suspension above
            // survives. On GPUs that activate everything up front (e.g. NVIDIA
            // via NvAPI) the count never moves and this whole block is a no-op.
            var activeSensorCount = CountActiveSensors();
            if (activeSensorCount != knownSensorCount)
            {
                // Capped: a sensor that flaps in and out would otherwise write a
                // line every poll (CPU core temperatures deactivate themselves
                // when a read fails). Only the logging is capped, never the
                // re-map, so the data stays correct either way.
                if (sensorSetChanges++ < SensorSetChangeLogLimit)
                {
                    logger.LogInformation(
                        "Active sensor set changed ({Previous} -> {Current}); refreshing sensor list",
                        knownSensorCount, activeSensorCount);
                }

                knownSensorCount = activeSensorCount;
                MapHardwareData(sharedMemoryData);
            }

            WriteDataToStream(writer, sharedMemoryData);

            if (_socketHost.HasConnections())
            {
                _socketHost.SendToAll(memoryStream.ToArray());
            } else
            {
                //logger.LogInformation("No clients connected, not sending data");
            }

            if (accumulator >= 1000)
            {
                GC.Collect();
                accumulator = 0;
            }

            // Advance by the interval actually being waited, not a hardcoded
            // 500. The accumulator is meant to make this a once-a-second
            // collection; with a fixed 500 it instead tracked poll count, so at
            // the 33ms floor it forced a full GC roughly every 66ms, about 15x
            // too often, and only matched its intent at the default rate.
            accumulator += _pollingRate;
            await Task.Delay(_pollingRate, stoppingToken);
        }

        Stop();
        hostApplicationLifetime.StopApplication();
    }

    private static void WriteDataToStream(BinaryWriter writer, SharedMemoryData sharedMemoryData)
    {
        writer.Seek(0, SeekOrigin.Begin);
        writer.Write((short)MonitorPacketCommand.Data);
        writer.Write(sharedMemoryData.Hardwares.Count);
        writer.Write(sharedMemoryData.Sensors.Count);

        foreach (var hardware in sharedMemoryData.Hardwares)
        {
            writer.Write((short)hardware.Name.Length);
            writer.Write((short)hardware.Identifier.Length);
            writer.Write(Encoding.UTF8.GetBytes(hardware.Name));
            writer.Write(Encoding.UTF8.GetBytes(hardware.Identifier));
            writer.Write((int)hardware.HardwareType);
        }

        foreach (var sensor in sharedMemoryData.Sensors)
        {
            var value = sensor.HardwareSensor.Value ?? 0f;
            var floatValue = (IsNaN(value) ? 0f : value).ToString(CultureInfo.InvariantCulture);
            sensor.Value = float.Parse(floatValue, CultureInfo.InvariantCulture);

            writer.Write((short)sensor.Name.Length);
            writer.Write((short)sensor.Identifier.Length);
            writer.Write((short)sensor.HardwareIdentifier.Length);
            writer.Write(Encoding.UTF8.GetBytes(sensor.Name));
            writer.Write(Encoding.UTF8.GetBytes(sensor.Identifier));
            writer.Write(Encoding.UTF8.GetBytes(sensor.HardwareIdentifier));
            writer.Write((int)sensor.SensorType);
            writer.Write((float)sensor.Value);
        }
    }

    private void OnClientConnected()
    {
        SendPresentMonAppsToClients();
    }

    private void OnClientData(byte[] data)
    {
        var cmd = (MonitorPacketCommand)BitConverter.ToInt16(data, 0);
        logger.LogInformation("Received command from client: {Command}", cmd);
        switch (cmd)
        {
            case MonitorPacketCommand.RefreshPresentMonApps:
                SendPresentMonAppsToClients();
                break;
            case MonitorPacketCommand.SelectPresentMonApp:
                SelectPresentMonApp(data);
                break;
            case MonitorPacketCommand.SelectPollingRate:
                SelectPollingRate(data);
                break;

            // server -> client cases 
            case MonitorPacketCommand.Data:
            case MonitorPacketCommand.PresentMonApps:
                break;
            default:
                throw new ArgumentOutOfRangeException();
        }
    }

    private void SelectPollingRate(byte[] data)
    {
        // start at 2 because the first 2 were the command
        var pollingRate = BitConverter.ToInt16(data, 2);
        _pollingRate = Math.Max(pollingRate, MinimalPollingRate);
        logger.LogInformation("Selected polling rate of {PollingRate}", _pollingRate);
    }

    private void SelectPresentMonApp(byte[] data)
    {
        // start at 2 because the first 2 were the command
        var size = BitConverter.ToInt16(data, 2);
        var appName = Encoding.UTF8.GetString(data, 4, size);
        _presentMonPoller.SetSelectedApp(appName);
    }

    private void SendPresentMonAppsToClients()
    {
        using var memoryStream = new MemoryStream();
        using var writer = new BinaryWriter(memoryStream);

        // Take a snapshot under PresentMonPoller's _stateLock: reading its app
        // dictionary directly would race with ParseData's write on the
        // PresentMon callback thread. The snapshot also drops apps that have
        // not presented a frame recently, so this list is what is currently
        // monitorable rather than everything ever seen.
        var apps = _presentMonPoller.SnapshotCurrentApps();
        writer.Write((short)MonitorPacketCommand.PresentMonApps);
        writer.Write((short)apps.Length);
        foreach (var app in apps)
        {
            writer.Write(GetBytes(app, SharedMemoryConsts.NameSize));
        }

        if (_socketHost.HasConnections())
        {
            _socketHost.SendToAll(memoryStream.ToArray());
        }
    }

    private SharedMemoryData QueryHardwareData()
    {
        var sharedMemoryData = new SharedMemoryData();

        MapHardwareData(sharedMemoryData);

        return sharedMemoryData;
    }

    /// <summary>
    /// Re-maps hardware and sensors from a single snapshot of the hardware
    /// tree. Taking one snapshot for both is what guarantees the two lists
    /// agree: Computer.Hardware is rebuilt on every access, so mapping them
    /// from separate reads could emit a sensor whose hardware is missing.
    /// </summary>
    private void MapHardwareData(SharedMemoryData sharedMemoryData)
    {
        var hardwares = _computer.Hardware;

        MapHardwares(sharedMemoryData, hardwares);
        MapSensors(sharedMemoryData, hardwares);
    }

    /// <summary>
    /// Rebuilds the hardware list. Entries already present are reused rather
    /// than recreated, so a hardware suspended by StopUpdates() after throwing
    /// stays suspended instead of being resurrected on the next re-map.
    /// </summary>
    private void MapHardwares(SharedMemoryData sharedMemoryData, IList<IHardware> hardwares)
    {
        var known = new Dictionary<string, SharedMemoryHardware>();
        foreach (var hardware in sharedMemoryData.Hardwares)
        {
            known[hardware.Identifier] = hardware;
        }

        var hardwareList = new List<SharedMemoryHardware>();

        void Add(IHardware hardware)
        {
            hardwareList.Add(known.TryGetValue(hardware.Identifier.ToString(), out var existing)
                ? existing
                : MapHardware(hardware));
        }

        foreach (var hardware in hardwares)
        {
            Add(hardware);
            foreach (var subHardware in hardware.SubHardware)
            {
                Add(subHardware);
            }
        }

        sharedMemoryData.Hardwares = hardwareList;
    }

    /// <summary>
    /// Rebuilds the sensor list from whatever LibreHardwareMonitor currently
    /// reports as active. Safe to call repeatedly: sensors are addressed by
    /// identifier on the client, so a longer list only adds readings.
    /// </summary>
    private void MapSensors(SharedMemoryData sharedMemoryData, IList<IHardware> hardwares)
    {
        var sensorList = new List<SharedMemorySensor>();

        foreach (var hardware in hardwares)
        {
            foreach (var sensor in hardware.Sensors)
            {
                sensor.ValuesTimeWindow = TimeSpan.Zero;
                sensorList.Add(MapSensor(sensor));
            }

            foreach (var subHardware in hardware.SubHardware)
            {
                foreach (var sensor in subHardware.Sensors)
                {
                    sensor.ValuesTimeWindow = TimeSpan.Zero;
                    sensorList.Add(MapSensor(sensor));
                }
            }
        }

        sensorList.Add(MapSensor(_presentMonPoller.Displayed));
        sensorList.Add(MapSensor(_presentMonPoller.Presented));
        sensorList.Add(MapSensor(_presentMonPoller.Frametime));

        sharedMemoryData.Sensors = sensorList;
    }

    /// <summary>
    /// Number of sensors LibreHardwareMonitor currently reports as active. Used
    /// only to detect that the set changed, so the sensor list can be re-mapped.
    /// </summary>
    private int CountActiveSensors()
    {
        var count = 0;

        foreach (var hardware in _computer.Hardware)
        {
            count += hardware.Sensors.Length;
            foreach (var subHardware in hardware.SubHardware)
            {
                count += subHardware.Sensors.Length;
            }
        }

        return count;
    }

    private void Stop()
    {
        _computer.Close();
        _presentMonPoller.Stop();
        _socketHost.Close();
        _socketHost.OnClientData -= OnClientData;
    }

    private static SharedMemoryHardware MapHardware(IHardware hardware) => new()
    {
        Name = RemoveSpecialCharacters(hardware.Name),
        Identifier = hardware.Identifier.ToString(),
        HardwareType = hardware.HardwareType,
        Hardware = hardware
    };

    private static SharedMemorySensor MapSensor(ISensor sensor) => new()
    {
        Name = RemoveSpecialCharacters(sensor.Name),
        Identifier = sensor.Identifier.ToString(),
        SensorType = sensor.SensorType,
        Value = float.IsNaN(sensor.Value ?? 0f) ? 0f : (sensor.Value ?? 0f),
        HardwareIdentifier = sensor.Hardware.Identifier.ToString(),
        HardwareSensor = sensor
    };

    private static byte[] GetBytes(string str, int length)
    {
        return Encoding.UTF8.GetBytes(str.Length > length ? str[..length] : str.PadRight(length, '\0'));
    }

    public static string RemoveSpecialCharacters(string str)
    {
        return Regex.Replace(str, "[^a-zA-Z0-9_ .]+", "_", RegexOptions.Compiled);
    }

    public static unsafe bool IsNaN(float f)
    {
        int binary = *(int*)(&f);
        return ((binary & 0x7F800000) == 0x7F800000) && ((binary & 0x007FFFFF) != 0);
    }
}