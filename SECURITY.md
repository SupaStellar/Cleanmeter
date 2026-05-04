# Security & Antivirus Notes

## Why Windows Defender (or another AV) may flag CleanMeter

CleanMeter uses [LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor) to read CPU, GPU, RAM, and motherboard sensors. LibreHardwareMonitor relies on a kernel-mode driver called **WinRing0** to access the low-level hardware registers that those sensors live behind.

WinRing0 is **a known-vulnerable driver** ([CVE-2020-14979](https://nvd.nist.gov/vuln/detail/CVE-2020-14979)). Microsoft Defender therefore flags it under names like:

- `VulnerableDriver:WinNT/Winring0`
- `HackTool:Win32/Winring0`
- `Trojan:Win32/Vigorf.A`

**These detections are not false positives.** Microsoft has [explicitly stated](https://support.microsoft.com/en-us/windows/microsoft-defender-antivirus-alert-vulnerabledriver-winnt-winring0-eb057830-d77b-41a2-9a34-015a5d203c42) that the driver is vulnerable in a generic sense — not that CleanMeter or LibreHardwareMonitor is malicious. The same flag affects MSI Afterburner, FanControl, OpenHardwareMonitor, HWiNFO, and many other hardware-monitoring tools that share this driver.

If you do not want this driver on your machine, **do not install CleanMeter**. Hardware-sensor depth and "no kernel driver" are mutually exclusive on Windows today.

## What CleanMeter does about it

- CleanMeter's installer, main executable (`cleanmeter.exe`), background sidecar (`HardwareMonitor.exe`), and bundled `presentmon.exe` are **Authenticode-signed** for tagged release builds. The signature establishes provenance — it does not change Defender's verdict on WinRing0 itself, but it eliminates the "Unknown publisher" SmartScreen prompt and the unrelated heuristic flags that hit unsigned binaries.
- CleanMeter does not bundle a separately-signed kernel driver of its own. The WinRing0 driver lives inside `LibreHardwareMonitorLib`.

## If Defender quarantines CleanMeter

You have three options, in order of safety:

1. **Don't run CleanMeter.** Acceptable answer.
2. **Add a Microsoft Defender exclusion** for the install directory (typically `%LOCALAPPDATA%\Programs\CleanMeter\`). This is the option Microsoft documents for users who choose to keep using affected monitoring tools. Be aware that an exclusion lowers your defenses against other malware that might exploit the same WinRing0 driver via "Bring Your Own Vulnerable Driver" techniques.
3. **Install a different overlay** (e.g. RTSS) that does not require kernel-mode hardware access. You will lose some sensors (per-rail VRM, fan RPM on certain boards, etc.).

## Verifying a release

Once a release ships signed:

```powershell
Get-AuthenticodeSignature "$env:LOCALAPPDATA\Programs\CleanMeter\cleanmeter.exe"
Get-AuthenticodeSignature "$env:LOCALAPPDATA\Programs\CleanMeter\HardwareMonitor.exe"
Get-AuthenticodeSignature "$env:LOCALAPPDATA\Programs\CleanMeter\presentmon.exe"
```

All three should report `Status: Valid` with the same publisher.

## Reporting a real security issue

If you've found something you believe is an actual vulnerability in CleanMeter (i.e. not WinRing0), please contact the maintainers via the project's Discord rather than filing a public GitHub issue. Don't include reproduction steps in a public channel.
