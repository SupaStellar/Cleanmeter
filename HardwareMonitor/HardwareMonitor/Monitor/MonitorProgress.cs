namespace HardwareMonitor.Monitor;

internal record HardwareStatus(string State, string Stage, long ElapsedMs);

/// <summary>
/// One immutable observation shared by the hardware owner and pipe heartbeat.
/// A delayed status is informational: it never cancels or retries native work.
/// </summary>
internal sealed class MonitorProgress
{
    internal const long DelayWarningMs = 45_000;
    private sealed record Stage(string Name, long Since, bool Ready, bool Failed, bool HasReadings);
    private Stage _stage = new("Starting hardware worker", Environment.TickCount64, false, false, false);

    public void Begin(string name) =>
        Volatile.Write(ref _stage, new Stage(name, Environment.TickCount64, false, false, Volatile.Read(ref _stage).HasReadings));

    public void Ready() =>
        Volatile.Write(ref _stage, new Stage("Hardware readings available", Environment.TickCount64, true, false, true));

    public void Fail()
    {
        var stage = Volatile.Read(ref _stage);
        Volatile.Write(ref _stage, stage with { Failed = true });
    }

    public HardwareStatus Read() => Read(Environment.TickCount64);

    internal HardwareStatus Read(long now)
    {
        var stage = Volatile.Read(ref _stage);
        var elapsed = Math.Max(0, now - stage.Since);
        var state = stage.Failed ? "failed" : stage.Ready ? "ready"
            : elapsed >= DelayWarningMs ? "delayed" : stage.HasReadings ? "ready" : "starting";
        return new HardwareStatus(state, stage.Name, stage.Ready ? 0 : elapsed);
    }
}
