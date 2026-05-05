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

- CleanMeter's CI has **Authenticode signing infrastructure wired up** for the installer, main executable (`cleanmeter.exe`), background sidecar (`HardwareMonitor.exe`), and bundled `presentmon.exe`. As of v2.1.3 the project does not yet have a code-signing certificate funded, so tagged release builds are currently shipped unsigned. Once a certificate is added to the repository's GitHub secrets, every subsequent tag will produce signed bundles automatically with no further code changes — the signing path is conditional on the secret being present.
- CleanMeter does not bundle a separately-signed kernel driver of its own. The WinRing0 driver lives inside `LibreHardwareMonitorLib`.

## What you'll see today (unsigned releases)

Until CleanMeter ships signed, two separate Windows prompts can appear and they have different causes.

### 1. SmartScreen "Windows protected your PC" (purple popup, on first launch of the installer)

```
Windows protected your PC
Microsoft Defender SmartScreen prevented an unrecognized app from
starting. Running this app might put your PC at risk.

App:        CleanMeter_X.Y.Z_x64-setup.exe
Publisher:  Unknown publisher
```

**This is reputation-based, not a virus detection.** SmartScreen flags every unsigned `.exe` from a publisher Windows hasn't seen — including perfectly legitimate ones — until the binary either accumulates thousands of clean installs to build reputation organically, or is signed with a code-signing certificate. (An EV certificate clears the prompt immediately; an OV certificate fades as reputation accrues over hundreds of installs.)

To bypass it for the current release: click **More info → Run anyway**. Before you do, verify the file's SHA-256 against the value listed on the GitHub release page:

```powershell
Get-FileHash CleanMeter_2.1.3_x64-setup.exe -Algorithm SHA256
```

If the hash matches the release page, the file you have is byte-for-byte identical to what GitHub built from the tagged source. Sign-off equivalent of an Authenticode signature, just manual.

### 2. `VulnerableDriver:WinNT/Winring0` (Defender quarantine, post-install)

This is the genuine WinRing0 flag covered in the section above. It fires on the LibreHardwareMonitor driver, not on the CleanMeter binaries themselves, and is **independent** of whether CleanMeter is code-signed. Signing the installer would remove the SmartScreen prompt but would not change this flag.

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
