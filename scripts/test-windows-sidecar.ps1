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
            if ($readingsSeen) {
                $reader = [IO.BinaryReader]::new([IO.MemoryStream]::new([byte[]]$payload))
                try {
                    $null = $reader.ReadInt32(); $null = $reader.ReadInt32()
                    for ($i = 0; $i -lt $hardware; $i++) {
                        $nameLength = $reader.ReadInt16(); $idLength = $reader.ReadInt16()
                        $null = $reader.ReadBytes($nameLength + $idLength)
                        $null = $reader.ReadInt32()
                    }
                    $memory = @{}
                    for ($i = 0; $i -lt $sensors; $i++) {
                        $nameLength = $reader.ReadInt16(); $idLength = $reader.ReadInt16(); $hardwareLength = $reader.ReadInt16()
                        $null = $reader.ReadBytes($nameLength)
                        $id = [Text.Encoding]::UTF8.GetString($reader.ReadBytes($idLength))
                        $null = $reader.ReadBytes($hardwareLength)
                        $null = $reader.ReadInt32()
                        $value = $reader.ReadSingle()
                        if ($id.StartsWith('/ram/') -or $id.StartsWith('/vram/')) { $memory[$id] = $value }
                    }
                    $expected = @('/ram/load/0', '/ram/data/0', '/ram/data/1', '/vram/load/1', '/vram/data/2', '/vram/data/3')
                    foreach ($id in $expected) {
                        if (-not $memory.ContainsKey($id)) { throw "Missing OS memory sensor $id" }
                        if ([float]::IsNaN($memory[$id]) -or [float]::IsInfinity($memory[$id])) { throw "Invalid value for $id" }
                    }
                    if ($memory['/ram/load/0'] -lt 0 -or $memory['/ram/load/0'] -gt 100) { throw 'RAM load outside percentage range' }
                    if (($memory['/ram/data/0'] + $memory['/ram/data/1']) -le 0) { throw 'No physical memory reported' }
                    $memory | ConvertTo-Json | Set-Content "$evidence/live-memory-values.json"
                } finally { $reader.Dispose() }
            }
        }
    }
    Write-Host 'Published Windows sidecar connected, reported progress, and sent real hardware sensor entries.'
} finally {
    if ($pipe) { $pipe.Dispose() }
    if ($child -and -not $child.HasExited) { Stop-Process -Id $child.Id -Force }
    $timeout.Dispose()
    if (Test-Path "$publish/LogFiles") { Copy-Item "$publish/LogFiles" "$evidence/LogFiles" -Recurse -Force }
}
