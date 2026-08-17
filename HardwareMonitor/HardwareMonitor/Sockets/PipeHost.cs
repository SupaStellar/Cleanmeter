using System.IO.Pipes;
using Microsoft.Extensions.Logging;
// ReSharper disable FieldCanBeMadeReadOnly.Local
#pragma warning disable CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider adding the 'required' modifier or declaring as nullable.

namespace HardwareMonitor.Sockets;

public class PipeHost(ILogger logger)
{
    private readonly string _pipeName = "HardwareMonitor_31337";
    private List<NamedPipeServerStream> _clients = [];
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

                lock (_clients)
                {
                    _clients.Add(pipeServer);
                }

                OnClientConnected?.Invoke();

                // Handle this client in a separate task
                _ = Task.Run(() => HandleClientAsync(pipeServer), _cancellationTokenSource.Token);
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

    private async Task HandleClientAsync(NamedPipeServerStream pipeServer)
    {
        var buffer = new byte[2048];

        try
        {
            while (pipeServer.IsConnected && !_cancellationTokenSource.Token.IsCancellationRequested)
            {
                int bytesRead = await pipeServer.ReadAsync(buffer, 0, buffer.Length, _cancellationTokenSource.Token);

                if (bytesRead > 0)
                {
                    var data = new byte[bytesRead];
                    Array.Copy(buffer, data, bytesRead);
                    OnClientData?.Invoke(data);
                }
                else
                {
                    // Client disconnected
                    break;
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogInformation("Client disconnected: {Exception}", ex.Message);
        }
        finally
        {
            logger.LogInformation("Removing client connection");

            lock (_clients)
            {
                _clients.Remove(pipeServer);
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
                    client.Dispose();
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
            return _clients.Any(c => c.IsConnected);
        }
    }

    public async Task SendToAllAsync(byte[] data)
    {
        var dataWithSize = data.ToList();
        dataWithSize.InsertRange(2, BitConverter.GetBytes(dataWithSize.Count - 2));
        var finalData = dataWithSize.ToArray();

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
            List<NamedPipeServerStream> clientsCopy;
            lock (_clients)
            {
                clientsCopy = _clients.ToList();
            }

            foreach (var client in clientsCopy)
            {
                try
                {
                    if (client.IsConnected)
                    {
                        await client.WriteAsync(finalData, 0, finalData.Length, _cancellationTokenSource.Token);
                        await client.FlushAsync(_cancellationTokenSource.Token);
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
                        client.Dispose();
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