using System.Buffers.Binary;
using System.IO.Pipes;
using System.Text.Json;
using HardwareMonitor.Monitor;
using HardwareMonitor.Sockets;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HardwareMonitor.Tests;

public class MonitorStartupTests
{
    [Fact]
    public void FailedMotherboardProbeDoesNotPreventCpuAndGpuDiscovery()
    {
        var progress = new MonitorProgress();
        var discovered = new List<string>();
        HardwareDiscovery.Run(new (string, Action)[]
        {
            ("Motherboard", () => throw new IOException("Synthetic probe failure")),
            ("CPU", () => discovered.Add("CPU")),
            ("GPU", () => discovered.Add("GPU")),
        }, progress, NullLogger.Instance, CancellationToken.None);
        Assert.Equal(new[] { "CPU", "GPU" }, discovered);
    }

    [Fact]
    public void CancellationAfterAProbePreventsStartingTheNextOne()
    {
        using var cancelled = new CancellationTokenSource();
        var secondCalled = false;
        Assert.Throws<OperationCanceledException>(() => HardwareDiscovery.Run(new (string, Action)[]
        {
            ("First", () => cancelled.Cancel()),
            ("Second", () => secondCalled = true),
        }, new MonitorProgress(), NullLogger.Instance, cancelled.Token));
        Assert.False(secondCalled);
    }

    private static async Task<(short Command, byte[] Payload)> ReadFrame(NamedPipeClientStream client, CancellationToken token)
    {
        var header = new byte[6];
        await client.ReadExactlyAsync(header, token);
        var length = BinaryPrimitives.ReadInt32LittleEndian(header.AsSpan(2));
        Assert.InRange(length, 0, 65536);
        var payload = new byte[length];
        await client.ReadExactlyAsync(payload, token);
        return (BinaryPrimitives.ReadInt16LittleEndian(header), payload);
    }

    [Fact]
    public async Task BlockedHardwareStillAllowsConnectionAndProgressThenLateReadings()
    {
        if (!OperatingSystem.IsWindows()) return; // Real Windows named-pipe transport.
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(15));
        using var blocked = new ManualResetEventSlim();
        using var entered = new ManualResetEventSlim();
        var name = "cleanmeter-test-" + Guid.NewGuid().ToString("N");
        var pipe = new PipeHost(NullLogger.Instance, name);
        var workerDone = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        using var monitor = new MonitorPoller(NullLogger<MonitorPoller>.Instance, pipe, _ =>
        {
            try
            {
                entered.Set();
                // Deliberately synchronous and NOT cancellable: models native
                // discovery that remains in Task Manager without completing.
                blocked.Wait();
                // A synthetic, valid empty topology proves late publication
                // crosses the same pipe; no hardware values are claimed here.
                pipe.SendToAll(new byte[10]);
                return Task.CompletedTask;
            }
            finally { workerDone.SetResult(); }
        }, startPresentMon: false);
        try
        {
            await monitor.StartAsync(deadline.Token).WaitAsync(deadline.Token);
            Assert.True(entered.Wait(TimeSpan.FromSeconds(3)));
            using var client = new NamedPipeClientStream(".", name, PipeDirection.InOut, PipeOptions.Asynchronous);
            await client.ConnectAsync(deadline.Token);
            (short Command, byte[] Payload) frame;
            do { frame = await ReadFrame(client, deadline.Token); } while (frame.Command != 6);
            using var json = JsonDocument.Parse(frame.Payload);
            Assert.Equal("starting", json.RootElement.GetProperty("state").GetString());
            Assert.False(workerDone.Task.IsCompleted);

            // Commands also remain responsive, not just server -> client sends.
            await client.WriteAsync(new byte[] { 1, 0 }, deadline.Token);
            do { frame = await ReadFrame(client, deadline.Token); } while (frame.Command != 3);

            blocked.Set();
            do { frame = await ReadFrame(client, deadline.Token); } while (frame.Command != 0);
            Assert.Equal(8, frame.Payload.Length);
            await workerDone.Task.WaitAsync(deadline.Token);
        }
        finally
        {
            blocked.Set();
            await workerDone.Task.WaitAsync(TimeSpan.FromSeconds(3));
            await monitor.StopAsync(CancellationToken.None).WaitAsync(TimeSpan.FromSeconds(3));
        }
    }

    [Fact]
    public async Task ShutdownDoesNotWaitForOrCleanUpAnActiveNativeCall()
    {
        if (!OperatingSystem.IsWindows()) return;
        using var release = new ManualResetEventSlim();
        using var entered = new ManualResetEventSlim();
        var finished = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var cleanupCalls = 0;
        var pipe = new PipeHost(NullLogger.Instance, "cleanmeter-test-" + Guid.NewGuid().ToString("N"));
        using var monitor = new MonitorPoller(NullLogger<MonitorPoller>.Instance, pipe, _ =>
        {
            try { entered.Set(); release.Wait(); return Task.CompletedTask; }
            finally { Interlocked.Increment(ref cleanupCalls); finished.SetResult(); }
        }, startPresentMon: false);
        try
        {
            await monitor.StartAsync(CancellationToken.None).WaitAsync(TimeSpan.FromSeconds(3));
            Assert.True(entered.Wait(TimeSpan.FromSeconds(3)));
            await monitor.StopAsync(CancellationToken.None).WaitAsync(TimeSpan.FromSeconds(3));
            Assert.Equal(0, Volatile.Read(ref cleanupCalls));
        }
        finally
        {
            release.Set();
            await finished.Task.WaitAsync(TimeSpan.FromSeconds(3));
        }
        Assert.Equal(1, cleanupCalls);
    }

    [Fact]
    public void ProgressReportsStallsWithoutForgettingLateRecovery()
    {
        var progress = new MonitorProgress();
        progress.Begin("Opening motherboard sensors");
        Assert.Equal("starting", progress.Read().State);
        Assert.Equal("delayed", progress.Read(Environment.TickCount64 + 60_000).State);
        progress.Ready();
        Assert.Equal("ready", progress.Read(Environment.TickCount64 + 60_000).State);
        progress.Begin("Reading CPU sensors");
        Assert.Equal("ready", progress.Read().State); // No flicker between normal reads.
        Assert.Equal("delayed", progress.Read(Environment.TickCount64 + 60_000).State);
        progress.Fail();
        Assert.Equal("failed", progress.Read().State);
        Assert.Equal("Reading CPU sensors", progress.Read().Stage);
    }
}
