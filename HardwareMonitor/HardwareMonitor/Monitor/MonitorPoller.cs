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

    // How often the device tree is re-checked against LibreHardwareMonitor's
    // GPU list. The check is a device-tree enumeration and a count compare, so
    // it is cheap enough to leave running for the life of the sidecar; only a
    // mismatch costs anything, and a single-GPU machine never has one. Running
    // it forever rather than as a startup burst is what catches a GPU that
    // arrives late, e.g. an external GPU or a driver that finished installing.
    private const int GpuReconcileIntervalMs = 30_000;

    // Rebuilding the GPU groups cannot help a GPU whose vendor SDK will never
    // answer, so the rebuild is capped. Past the cap the GPU is still listed
    // from the device tree, just without readings.
    private const int MaxGpuGroupRebuilds = 5;

    private long _nextGpuReconcileAt;
    private int _gpuGroupRebuilds;

    /// <summary>
    /// GPUs the device tree reports as present that LibreHardwareMonitor has
    /// produced no hardware for. Listed to the app anyway, without sensors, so
    /// the user can still select the GPU they meant.
    /// </summary>
    private IReadOnlyList<DisplayAdapters.DisplayAdapter> _absentGpus = [];

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

        // Before anything is logged or mapped, check LibreHardwareMonitor's
        // GPU list against the device tree. Its GPU groups enumerate once, in
        // their constructors, so a vendor SDK that was not ready here would
        // otherwise leave the GPU missing for the whole session.
        ReconcileGpus();
        _nextGpuReconcileAt = Environment.TickCount64 + GpuReconcileIntervalMs;

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
            // Ahead of the no-clients check on purpose: the GPU list should be
            // right by the time a client connects, not a poll or two after.
            // Wall-clock rather than an accumulator because the two waits below
            // differ (1s with no client, the polling rate with one).
            if (Environment.TickCount64 >= _nextGpuReconcileAt)
            {
                _nextGpuReconcileAt = Environment.TickCount64 + GpuReconcileIntervalMs;

                var reconcile = ReconcileGpus();
                if (reconcile != GpuReconcileResult.Unchanged)
                {
                    // Only a rebuild invalidates the cached IHardware. Doing
                    // this unconditionally would also clear the StopUpdates()
                    // suspension MapHardwares exists to preserve.
                    if (reconcile == GpuReconcileResult.Rebuilt)
                        ForgetGpuHardware(sharedMemoryData);

                    MapHardwareData(sharedMemoryData);
                    knownSensorCount = CountActiveSensors();
                }
            }

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
            case MonitorPacketCommand.SetLowsMode:
                SetLowsMode(data);
                break;

            // server -> client cases 
            case MonitorPacketCommand.Data:
            case MonitorPacketCommand.PresentMonApps:
                break;
            default:
                // Logged and dropped, never thrown. This runs on the pipe read
                // loop, so an exception here takes the pipe down with it and
                // the client sees "pipe is being closed" — observed for real
                // when a newer client sent SetLowsMode (5) to a sidecar
                // built before that command existed. The two ship together, so
                // that pairing should not happen, but a partial update or a
                // failed file replacement is enough to produce it, and losing
                // every reading over one unrecognised packet is a bad trade
                // against ignoring it.
                logger.LogWarning(
                    "Ignoring unknown command {Command} from client; "
                    + "the client is probably newer than this sidecar",
                    (short)cmd);
                break;
        }
    }

    /// <summary>
    /// The u16 payload of a fixed-layout command, or null when the packet is
    /// too short to hold one.
    ///
    /// Every command here indexes offset 2 directly. BitConverter throws on a
    /// truncated buffer, and this runs on the pipe read loop, so the throw
    /// closes the client's pipe and that client stops receiving readings —
    /// the same failure mode an unrecognised command used to cause.
    /// </summary>
    private short? ReadPayload(byte[] data, MonitorPacketCommand cmd)
    {
        // start at 2 because the first 2 were the command
        if (data.Length < 4)
        {
            logger.LogWarning(
                "Dropping truncated {Command} packet: {Length} bytes, need 4",
                cmd, data.Length);
            return null;
        }
        return BitConverter.ToInt16(data, 2);
    }

    private void SetLowsMode(byte[] data)
    {
        if (ReadPayload(data, MonitorPacketCommand.SetLowsMode) is not { } payload) return;
        // The protocol defines exactly 0, 1 and 2, so anything else is a
        // malformed packet rather than a value to coerce. Cast blindly to the
        // enum, an out-of-range payload would land on a LowsMode no switch arm
        // handles, which reads as Frozen at every call site and would silently
        // stop the readings updating. Dropping it costs nothing: the only
        // writer sends 0, 1 or 2.
        if (payload is not (0 or 1 or 2))
        {
            logger.LogWarning(
                "Dropping SetLowsMode with payload {Payload}; expected 0, 1 or 2",
                payload);
            return;
        }
        _presentMonPoller.SetLowsMode((LowsMode)payload);
    }

    private void SelectPollingRate(byte[] data)
    {
        if (ReadPayload(data, MonitorPacketCommand.SelectPollingRate) is not { } pollingRate) return;
        _pollingRate = Math.Max(pollingRate, MinimalPollingRate);
        logger.LogInformation("Selected polling rate of {PollingRate}", _pollingRate);
    }

    private void SelectPresentMonApp(byte[] data)
    {
        if (ReadPayload(data, MonitorPacketCommand.SelectPresentMonApp) is not { } size) return;
        // The length prefix is attacker-adjacent in the sense that matters
        // here: it comes off a pipe, and GetString throws on a range the
        // buffer cannot satisfy. A negative size throws too, which is why
        // this is not just an upper bound.
        if (size < 0 || 4 + size > data.Length)
        {
            logger.LogWarning(
                "Dropping SelectPresentMonApp: declared {Size} name bytes, {Available} available",
                size, Math.Max(data.Length - 4, 0));
            return;
        }
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

    /// <summary>
    /// What a reconcile pass did, which decides how much the caller has to
    /// throw away. The distinction matters: forgetting the cached GPU entries
    /// is mandatory after a rebuild, and harmful without one, because it also
    /// forgets that a GPU was suspended by StopUpdates() after throwing.
    /// </summary>
    private enum GpuReconcileResult
    {
        /// <summary>Nothing to do.</summary>
        Unchanged,

        /// <summary>
        /// The GPUs listed without sensors changed. Existing IHardware
        /// instances are still live; re-map, but keep them.
        /// </summary>
        ListChanged,

        /// <summary>
        /// LibreHardwareMonitor's GPU groups were re-created, so every GPU
        /// IHardware the cache holds is now a closed instance.
        /// </summary>
        Rebuilt,
    }

    /// <summary>
    /// Check the GPUs the device tree reports against the ones
    /// LibreHardwareMonitor produced, rebuild its GPU groups when it is short,
    /// and remember whatever is still unaccounted for so MapHardwares can list
    /// it without sensors.
    /// </summary>
    private GpuReconcileResult ReconcileGpus()
    {
        IReadOnlyList<DisplayAdapters.DisplayAdapter> adapters;

        try
        {
            adapters = DisplayAdapters.Enumerate();
        }
        catch (Exception ex)
        {
            // A second opinion we cannot obtain is not worth failing over. The
            // GPU list stays whatever LibreHardwareMonitor reported, which is
            // exactly the behaviour before this existed.
            logger.LogWarning(ex, "Could not enumerate display adapters; using LibreHardwareMonitor's GPU list as-is");
            return GpuReconcileResult.Unchanged;
        }

        // No adapters at all means the enumeration told us nothing useful
        // rather than that the machine has no GPU, so nothing is concluded
        // from it. A machine with a GPU that the device tree cannot see is not
        // a case this can improve on.
        if (adapters.Count == 0)
            return GpuReconcileResult.Unchanged;

        var missing = GpuReconciler.Missing(adapters, DetectedGpuTypes());

        if (missing.Count > 0 && _gpuGroupRebuilds < MaxGpuGroupRebuilds)
        {
            _gpuGroupRebuilds++;
            logger.LogInformation(
                "Device tree reports {Present} GPU(s), LibreHardwareMonitor produced {Produced} ({Missing}); rebuilding its GPU groups, attempt {Attempt} of {Max}",
                adapters.Count,
                adapters.Count - missing.Count,
                string.Join(", ", missing.Select(m => m.Name)),
                _gpuGroupRebuilds,
                MaxGpuGroupRebuilds);

            var tornDown = RebuildGpuGroups();
            SetAbsentGpus(GpuReconciler.Missing(adapters, DetectedGpuTypes()));

            // Only report a rebuild when the old groups were actually closed.
            // That is what makes the cached entries stale, and forgetting them
            // when nothing was torn down would needlessly discard the
            // StopUpdates() suspension MapHardwares keeps them for.
            return tornDown ? GpuReconcileResult.Rebuilt : GpuReconcileResult.ListChanged;
        }

        // Compared by identity, not by count. One GPU becoming readable while
        // another stops leaves the count unchanged, and treating that as "no
        // change" would keep listing a placeholder for the wrong GPU.
        if (SameGpus(missing, _absentGpus))
            return GpuReconcileResult.Unchanged;

        SetAbsentGpus(missing);

        // No rebuild happened, so every surviving IHardware is still live. The
        // caller re-maps to pick up the changed placeholder list; it must not
        // forget the existing GPU entries, or a hardware suspended by
        // StopUpdates() after throwing would be resurrected and throw again.
        return GpuReconcileResult.ListChanged;
    }

    private static bool SameGpus(
        IReadOnlyList<DisplayAdapters.DisplayAdapter> a,
        IReadOnlyList<DisplayAdapters.DisplayAdapter> b)
    {
        if (a.Count != b.Count)
            return false;

        for (var i = 0; i < a.Count; i++)
        {
            if (a[i].InstanceId != b[i].InstanceId)
                return false;
        }

        return true;
    }

    /// <summary>
    /// Record the GPUs left without readings and log the change, once per
    /// change rather than once per check, so a permanent shortfall does not
    /// write a line every 30 seconds.
    /// </summary>
    private void SetAbsentGpus(IReadOnlyList<DisplayAdapters.DisplayAdapter> missing)
    {
        if (SameGpus(missing, _absentGpus))
            return;

        _absentGpus = missing;

        if (missing.Count == 0)
        {
            logger.LogInformation("Every GPU the device tree reports now has readings");
            return;
        }

        logger.LogWarning(
            "{Count} GPU(s) present in the device tree have no readings after {Rebuilds} rebuild(s): {Missing}. They are listed for selection but every value reads 0.",
            missing.Count,
            _gpuGroupRebuilds,
            string.Join(", ", missing.Select(m => m.Name)));
    }

    /// <summary>
    /// Re-create LibreHardwareMonitor's three GPU groups. Assigning
    /// IsGpuEnabled is the only handle it offers for this: the setter drops
    /// AmdGpuGroup / NvidiaGroup / IntelGpuGroup and constructs them again,
    /// which re-runs the ADL / NvAPI / IntelGcl enumeration that a constructor
    /// otherwise does exactly once per process.
    /// </summary>
    /// <summary>
    /// Returns whether the existing GPU groups were torn down, which is what
    /// decides if the caller has to forget its cached entries.
    ///
    /// The two halves are separated deliberately. Disabling closes the current
    /// groups, so every cached IHardware becomes a closed instance the moment
    /// that succeeds, whether or not the rebuild after it does. Failing on the
    /// way down leaves everything intact and the cache still valid; failing on
    /// the way back up does not, and pretending otherwise would leave the app
    /// updating closed handles forever.
    /// </summary>
    private bool RebuildGpuGroups()
    {
        try
        {
            _computer.IsGpuEnabled = false;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Could not disable the GPU groups; the GPU list is unchanged");
            return false;
        }

        try
        {
            _computer.IsGpuEnabled = true;
            _computer.Accept(new UpdateVisitor());
        }
        catch (Exception ex)
        {
            // The old groups are already closed, so there is nothing to fall
            // back to. GPUs read 0 until a later attempt succeeds, which is
            // honest; keeping the closed handles would freeze the last values
            // on screen and look live.
            logger.LogError(ex,
                "Rebuilding the GPU groups failed after the old ones were closed; " +
                "GPU readings are unavailable until a later attempt succeeds");
        }

        return true;
    }

    private IEnumerable<HardwareType> DetectedGpuTypes()
    {
        foreach (var hardware in _computer.Hardware)
        {
            if (GpuReconciler.IsGpu(hardware.HardwareType))
                yield return hardware.HardwareType;
        }
    }

    /// <summary>
    /// Drop the cached entries for every GPU so the next re-map recreates them.
    ///
    /// Required after a group rebuild. MapHardwares reuses entries by
    /// identifier, and a rebuilt group hands out new IHardware instances under
    /// the same identifiers (/gpu-nvidia/0 and friends), so reuse would leave
    /// every GPU entry pointing at a closed instance that never updates again.
    /// </summary>
    private static void ForgetGpuHardware(SharedMemoryData data)
    {
        data.Hardwares.RemoveAll(h => GpuReconciler.IsGpu(h.HardwareType));
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

        // GPUs the device tree reports but LibreHardwareMonitor produced
        // nothing for. Listed so the user can still pick the GPU they meant
        // instead of it being absent from the app entirely; they carry no
        // sensors, so every reading on them is 0.
        for (var i = 0; i < _absentGpus.Count; i++)
        {
            var adapter = _absentGpus[i];
            var identifier = GpuReconciler.PlaceholderIdentifier(adapter, i);

            hardwareList.Add(known.TryGetValue(identifier, out var existing)
                ? existing
                : new SharedMemoryHardware
                {
                    // Cleaned like every other name: the wire writes a UTF-16
                    // character count in front of UTF-8 bytes, so a name with
                    // non-ASCII in it would misalign every field after it.
                    Name = RemoveSpecialCharacters(adapter.Name),
                    Identifier = identifier,
                    HardwareType = adapter.Type,
                    Hardware = null,
                });
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
        sensorList.Add(MapSensor(_presentMonPoller.OnePercentLow));
        sensorList.Add(MapSensor(_presentMonPoller.ZeroPointOnePercentLow));

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