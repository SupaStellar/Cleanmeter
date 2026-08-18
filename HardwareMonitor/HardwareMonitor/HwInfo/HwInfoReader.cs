using System.Runtime.InteropServices;
using Microsoft.Extensions.Logging;

namespace HardwareMonitor.HwInfo;

public enum HwInfoReadStatus
{
    Success,
    Busy,
    Unavailable,
}

public readonly struct HwInfoReadAttempt
{
    public HwInfoReadStatus Status { get; init; }
    public HwInfoSnapshot? Snapshot { get; init; }

    public static HwInfoReadAttempt Success(HwInfoSnapshot snapshot) => new()
    {
        Status = HwInfoReadStatus.Success,
        Snapshot = snapshot,
    };

    public static HwInfoReadAttempt Busy() => new() { Status = HwInfoReadStatus.Busy };

    public static HwInfoReadAttempt Unavailable() => new() { Status = HwInfoReadStatus.Unavailable };
}

/// <summary>
/// Reads HWiNFO sensor shared memory for one poll, then releases the mapping.
/// The mapping is recreated when the sensor set changes; holding the old handle
/// can crash HWiNFO, so every call opens, copies, and closes.
/// </summary>
public sealed class HwInfoReader(ILogger logger)
{
    public const string MappingName = @"Global\HWiNFO_SENS_SM2";
    public const string MutexName = @"Global\HWiNFO_SM2_MUTEX";
    private const int MutexTimeoutMs = 200;
    private const uint FileMapRead = 0x0004;

    public HwInfoReadAttempt TryRead()
    {
        Mutex? mutex = null;
        var acquired = false;
        try
        {
            try
            {
                mutex = Mutex.OpenExisting(MutexName);
            }
            catch (WaitHandleCannotBeOpenedException)
            {
                return HwInfoReadAttempt.Unavailable();
            }
            catch (UnauthorizedAccessException)
            {
                return HwInfoReadAttempt.Unavailable();
            }

            if (mutex is null)
                return HwInfoReadAttempt.Unavailable();

            try
            {
                acquired = mutex.WaitOne(MutexTimeoutMs);
            }
            catch (AbandonedMutexException)
            {
                acquired = true;
            }

            if (!acquired)
                return HwInfoReadAttempt.Busy();

            var handle = NativeMethods.OpenFileMapping(FileMapRead, false, MappingName);
            if (handle == IntPtr.Zero)
                return HwInfoReadAttempt.Unavailable();

            try
            {
                var view = NativeMethods.MapViewOfFile(handle, FileMapRead, 0, 0, UIntPtr.Zero);
                if (view == IntPtr.Zero)
                    return HwInfoReadAttempt.Unavailable();

                try
                {
                    var bytes = CopyMapping(view);
                    if (bytes.Length == 0)
                        return HwInfoReadAttempt.Unavailable();

                    var parsed = HwInfoParser.Parse(bytes);
                    return parsed.Status == HwInfoParseStatus.Ok && parsed.Snapshot != null
                        ? HwInfoReadAttempt.Success(parsed.Snapshot)
                        : HwInfoReadAttempt.Unavailable();
                }
                finally
                {
                    NativeMethods.UnmapViewOfFile(view);
                }
            }
            finally
            {
                NativeMethods.CloseHandle(handle);
            }
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "HWiNFO shared memory read failed");
            return HwInfoReadAttempt.Unavailable();
        }
        finally
        {
            if (acquired)
            {
                try { mutex?.ReleaseMutex(); }
                catch (ApplicationException) { }
            }

            mutex?.Dispose();
        }
    }

    private static byte[] CopyMapping(IntPtr view)
    {
        var header = new byte[HwInfoParser.HeaderSizeWithPollingPeriod];
        try
        {
            Marshal.Copy(view, header, 0, header.Length);
        }
        catch (AccessViolationException)
        {
            var shortHeader = new byte[HwInfoParser.MinHeaderSize];
            Marshal.Copy(view, shortHeader, 0, shortHeader.Length);
            header = shortHeader;
        }

        if (!HwInfoParser.TryReadHeader(header, out var parsedHeader))
            return [];

        if (parsedHeader.Signature == HwInfoParser.SignatureDead)
            return header;

        if (!HwInfoParser.IsHealthyActiveHeader(parsedHeader))
            return header;

        long sensorEnd = (long)parsedHeader.OffsetOfSensorSection
            + (long)parsedHeader.SizeOfSensorElement * parsedHeader.NumSensorElements;
        long readingEnd = (long)parsedHeader.OffsetOfReadingSection
            + (long)parsedHeader.SizeOfReadingElement * parsedHeader.NumReadingElements;
        var total = (int)Math.Max(sensorEnd, readingEnd);
        if (total <= 0 || total > HwInfoParser.MaxSharedMemoryBytes)
            return [];

        var bytes = new byte[total];
        Marshal.Copy(view, bytes, 0, total);
        return bytes;
    }

    private static class NativeMethods
    {
        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        public static extern IntPtr OpenFileMapping(uint dwDesiredAccess, bool bInheritHandle, string lpName);

        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern IntPtr MapViewOfFile(
            IntPtr hFileMappingObject,
            uint dwDesiredAccess,
            uint dwFileOffsetHigh,
            uint dwFileOffsetLow,
            UIntPtr dwNumberOfBytesToMap);

        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool UnmapViewOfFile(IntPtr lpBaseAddress);

        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool CloseHandle(IntPtr hObject);
    }
}
