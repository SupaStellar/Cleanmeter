$ErrorActionPreference = 'Stop'
$publish = Resolve-Path 'HardwareMonitor/HardwareMonitor/bin/Release/net8.0/win-x64/publish'
$evidence = New-Item -ItemType Directory -Force evidence
$child = $null
$pipe = $null
$timeout = [Threading.CancellationTokenSource]::new([TimeSpan]::FromSeconds(90))

function Read-Bytes([int]$count) {
    $buffer = [byte[]]::new($count)
    $offset = 0
    while ($offset -lt $count) {
        $read = $pipe.ReadAsync($buffer, $offset, $count - $offset, $timeout.Token).GetAwaiter().GetResult()
        if ($read -eq 0) { throw 'Sidecar closed its pipe before verification completed' }
        $offset += $read
    }
    return ,$buffer
}

try {
    $child = Start-Process (Join-Path $publish 'HardwareMonitor.exe') -PassThru -WorkingDirectory $publish -RedirectStandardOutput "$evidence/sidecar-stdout.log" -RedirectStandardError "$evidence/sidecar-stderr.log"
    $pipe = [IO.Pipes.NamedPipeClientStream]::new('.', 'HardwareMonitor_31337', [IO.Pipes.PipeDirection]::InOut, [IO.Pipes.PipeOptions]::Asynchronous)
    $pipe.ConnectAsync($timeout.Token).GetAwaiter().GetResult()
    $statusSeen = $false
    $readingsSeen = $false
    while (-not ($statusSeen -and $readingsSeen)) {
        $header = Read-Bytes 6
        $command = [BitConverter]::ToInt16($header, 0)
        $length = [BitConverter]::ToInt32($header, 2)
        if ($length -lt 0 -or $length -gt 4194304) { throw "Invalid frame length $length" }
        $payload = Read-Bytes $length
        if ($command -eq 6) {
            $status = [Text.Encoding]::UTF8.GetString($payload)
            $status | Add-Content "$evidence/live-hardware-status.jsonl"
            $statusSeen = $true
        }
        if ($command -eq 0 -and $length -ge 8) {
            $hardware = [BitConverter]::ToInt32($payload, 0)
            $sensors = [BitConverter]::ToInt32($payload, 4)
            "Hardware entries: $hardware; sensors: $sensors" | Add-Content "$evidence/live-sensor-counts.txt"
            # Five PresentMon sensors alone do not demonstrate LHM success.
            $readingsSeen = $hardware -gt 0 -and $sensors -gt 5
        }
    }
    Write-Host 'Published Windows sidecar connected, reported progress, and sent real hardware sensor entries.'
} finally {
    if ($pipe) { $pipe.Dispose() }
    if ($child -and -not $child.HasExited) { Stop-Process -Id $child.Id -Force }
    $timeout.Dispose()
    if (Test-Path "$publish/LogFiles") { Copy-Item "$publish/LogFiles" "$evidence/LogFiles" -Recurse -Force }
}
