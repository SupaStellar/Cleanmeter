using Microsoft.Extensions.Logging;

namespace HardwareMonitor.Monitor;

internal static class HardwareDiscovery
{
    /// <summary>
    /// Sequential discovery on the hardware owner. Only exceptions are skipped;
    /// a blocked probe stays on this worker and is reported by the heartbeat.
    /// </summary>
    internal static void Run(IEnumerable<(string Name, Action Probe)> probes,
        MonitorProgress progress, ILogger logger, CancellationToken token)
    {
        foreach (var (name, probe) in probes)
        {
            token.ThrowIfCancellationRequested();
            progress.Begin(name);
            var started = Environment.TickCount64;
            logger.LogInformation("Hardware init: {Stage} starting", name);
            try
            {
                probe();
                logger.LogInformation("Hardware init: {Stage} completed in {ElapsedMs}ms",
                    name, Environment.TickCount64 - started);
            }
            catch (OperationCanceledException) when (token.IsCancellationRequested) { throw; }
            catch (Exception ex)
            {
                logger.LogError(ex, "Hardware init: {Stage} failed; continuing with other sensors", name);
            }
        }
        token.ThrowIfCancellationRequested();
    }
}
