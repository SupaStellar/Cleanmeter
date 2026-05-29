param([string]$Path)

# Standalone signing helper. Kept out of the inline tauri.conf signCommand
# because the bundler threads that string through the NSIS finalize step, which
# mangled the `$` tokens (`$env:` -> `$$env:`) and broke PowerShell parsing.
# A separate file is never NSIS-processed, so its `$` tokens survive intact.
#
# Signs only when a cert thumbprint is present in the environment; otherwise
# it's a no-op so unsigned dev/preview builds still bundle cleanly.
if ($env:WINDOWS_CERTIFICATE_THUMBPRINT) {
    & signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /sha1 $env:WINDOWS_CERTIFICATE_THUMBPRINT $Path
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
    Write-Host "Skipping signing (no cert): $Path"
}
