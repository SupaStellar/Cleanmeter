using System.IO.Pipes;
using HardwareMonitor.Monitor;
using Microsoft.Extensions.Logging;
// ReSharper disable FieldCanBeMadeReadOnly.Local
#pragma warning disable CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider adding the 'required' modifier or declaring as nullable.

namespace HardwareMonitor.Sockets;

public class PipeHost(ILogger logger, string pipeName = "HardwareMonitor_31337")
{
    private readonly string _pipeName = pipeName;
    private sealed class Client(NamedPipeServerStream pipe)
    {
        public readonly NamedPipeServerStream Pipe = pipe;
        public volatile bool SupportsCatalog;
        public long CatalogId;
    }

    private readonly List<Client> _clients = [];
    private CancellationTokenSource _cancellationTokenSource = new();
    private Task _serverTask;

    /// Serializes sends. The pipe is PipeTransmissionMode.Byte, so two writers
    /// on one stream interleave into a single jumbled byte run rather than
    /// staying framed. Two callers exist: the sensor poll loop, and the
    /// PresentMon app-list push, which fires on its own timer. Without this the
    /// client reads a length prefix from the middle of another packet and acts
    /// on it, which aborts the app rather than producing a parse error.
    private readonly SemaphoreSlim _sendLock = new(1, 1);

    public Action<byte[]> OnClientData;
    public Action OnClientConnected;

    public void StartServer()
    {
        logger.LogInformation("Starting named pipe server with name: {PipeName}", _pipeName);
        _serverTask = Task.Run(AcceptClientsAsync);
    }

    private async Task AcceptClientsAsync()
    {
        while (!_cancellationTokenSource.Token.IsCancellationRequested)
        {
            try
            {
                var pipeServer = new NamedPipeServerStream(
                    _pipeName,
                    PipeDirection.InOut,
                    NamedPipeServerStream.MaxAllowedServerInstances,
                    PipeTransmissionMode.Byte,
                    PipeOptions.Asynchronous,
                    4096,
                    4096
                );

                logger.LogInformation("Waiting for client connection on pipe: {PipeName}", _pipeName);

                await pipeServer.WaitForConnectionAsync(_cancellationTokenSource.Token);

                logger.LogInformation("Client connected to pipe: {PipeName}", _pipeName);

                var client = new Client(pipeServer);
                lock (_clients)
                {
                    _clients.Add(client);
                }

                OnClientConnected?.Invoke();

                // Handle this client in a separate task
                _ = Task.Run(() => HandleClientAsync(client), _cancellationTokenSource.Token);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error accepting pipe connection");
                await Task.Delay(1000, _cancellationTokenSource.Token);
            }
        }
    }

    private async Task HandleClientAsync(Client client)
    {
        var pipeServer = client.Pipe;
        var token = _cancellationTokenSource.Token;
        var header = new byte[4];

        try
        {
            while (pipeServer.IsConnected && !token.IsCancellationRequested)
            {
                // Commands use a u16 ID, followed by a fixed u16 or a u16
                // length and UTF-8 payload. A byte-mode read may return any
                // fraction or combination of the writes made by the client.
                await pipeServer.ReadExactlyAsync(header.AsMemory(0, 2), token);
                var command = (MonitorPacketCommand)BitConverter.ToInt16(header);
                var headerLength = command is MonitorPacketCommand.SelectPresentMonApp
                    or MonitorPacketCommand.SelectPollingRate or MonitorPacketCommand.SetLowsMode
                    or MonitorPacketCommand.SetMonitoringDemand or MonitorPacketCommand.SelectSensorProtocol
                    or MonitorPacketCommand.SelectActiveSensors ? 4 : 2;
                if (headerLength == 4)
                    await pipeServer.ReadExactlyAsync(header.AsMemory(2, 2), token);

                var payloadLength = command is MonitorPacketCommand.SelectPresentMonApp or MonitorPacketCommand.SelectActiveSensors
                    ? Math.Max(0, (int)BitConverter.ToInt16(header, 2)) : 0;
                var data = new byte[headerLength + payloadLength];
                header.AsSpan(0, headerLength).CopyTo(data);
                if (payloadLength != 0)
                    await pipeServer.ReadExactlyAsync(data.AsMemory(headerLength), token);
                if (command == MonitorPacketCommand.SelectSensorProtocol)
                    client.SupportsCatalog = BitConverter.ToInt16(data, 2) == MonitorProgress.PipeProtocolVersion;
                else
                    OnClientData?.Invoke(data);
            }
        }
        catch (EndOfStreamException) { }
        catch (Exception ex)
        {
            logger.LogInformation("Client disconnected: {Exception}", ex.Message);
        }
        finally
        {
            logger.LogInformation("Removing client connection");

            lock (_clients)
            {
                _clients.Remove(client);
            }

            try
            {
                pipeServer.Dispose();
            }
            catch { }
        }
    }

    public void Close()
    {
        logger.LogInformation("Closing all pipe connections");

        _cancellationTokenSource.Cancel();

        lock (_clients)
        {
            foreach (var client in _clients)
            {
                try
                {
                    client.Pipe.Dispose();
                }
                catch { }
            }
            _clients.Clear();
        }

        try
        {
            _serverTask?.Wait(5000);
        }
        catch { }

        _cancellationTokenSource.Dispose();
        _sendLock.Dispose();
    }

    public bool HasConnections()
    {
        lock (_clients)
        {
            return _clients.Any(c => c.Pipe.IsConnected);
        }
    }

    private static byte[] Frame(byte[] data)
    {
        var framed = new byte[data.Length + sizeof(int)];
        data.AsSpan(0, 2).CopyTo(framed);
        BitConverter.TryWriteBytes(framed.AsSpan(2), data.Length - 2);
        data.AsSpan(2).CopyTo(framed.AsSpan(6));
        return framed;
    }

    public Task SendToAllAsync(byte[] data)
    {
        var frame = Frame(data);
        return SendAsync((client, token) => client.Pipe.WriteAsync(frame, token).AsTask());
    }

    internal Task SendSensorDataAsync(long catalogId, byte[] catalog, byte[] values, Func<byte[]> legacy)
    {
        byte[]? legacyFrame = null;
        byte[]? catalogFrame = null;
        byte[]? valuesFrame = null;
        return SendAsync(async (client, token) =>
        {
            if (!client.SupportsCatalog)
            {
                await client.Pipe.WriteAsync(legacyFrame ??= Frame(legacy()), token);
                return;
            }
            if (client.CatalogId != catalogId)
            {
                await client.Pipe.WriteAsync(catalogFrame ??= Frame(catalog), token);
                client.CatalogId = catalogId;
            }
            await client.Pipe.WriteAsync(valuesFrame ??= Frame(values), token);
        });
    }

    private async Task SendAsync(Func<Client, CancellationToken, Task> write)
    {

        // Hold the lock across write+flush so a whole packet reaches the stream
        // before the next one starts. See _sendLock.
        try
        {
            await _sendLock.WaitAsync(_cancellationTokenSource.Token);
        }
        catch (OperationCanceledException)
        {
            return;
        }
        catch (ObjectDisposedException)
        {
            return;
        }

        try
        {
            List<Client> clientsCopy;
            lock (_clients)
            {
                clientsCopy = _clients.ToList();
            }

            foreach (var client in clientsCopy)
            {
                try
                {
                    if (client.Pipe.IsConnected)
                    {
                        await write(client, _cancellationTokenSource.Token);
                        await client.Pipe.FlushAsync(_cancellationTokenSource.Token);
                    }
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Error sending data to pipe client");

                    // Remove disconnected client
                    lock (_clients)
                    {
                        _clients.Remove(client);
                    }

                    try
                    {
                        client.Pipe.Dispose();
                    }
                    catch { }
                }
            }
        }
        finally
        {
            // Close() disposes the lock, and sends are fire-and-forget, so a
            // send already past WaitAsync can reach this after disposal.
            try
            {
                _sendLock.Release();
            }
            catch (ObjectDisposedException) { }
        }
    }

    // Synchronous version for compatibility
    public void SendToAll(byte[] data)
    {
        _ = Task.Run(() => SendToAllAsync(data));
    }
}