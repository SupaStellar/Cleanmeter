# Security & Antivirus Notes

## How Cleanmeter reads low-level hardware sensors

Cleanmeter uses [LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor) to read CPU, GPU, RAM, and motherboard sensors. Some of those readings (CPU temperature and package power via MSRs, motherboard voltages and fan speeds via SuperIO) live behind registers that can only be reached with a kernel-mode driver.

Cleanmeter uses **[PawnIO](https://pawnio.eu/)** (by namazso) for that access, replacing the older WinRing0 driver. PawnIO is:

- **Not flagged by Windows Defender.** It is a purpose-built, signed driver that runs sandboxed, signed modules and exposes only narrow IO-control endpoints to user space, instead of handing raw ring-0 access to any caller the way WinRing0 did. It is not on Microsoft's vulnerable-driver blocklist.
- **Compatible with modern Windows security.** PawnIO is built for and loads with **Memory Integrity (HVCI)** and **Secure Boot** enabled. WinRing0 could not, which is one reason it was blocked on many machines.
- **Shared, signed infrastructure.** Other tools (FanControl, LibreHardwareMonitor, and others) install the same driver, so it may already be present.

### How it gets installed

Cleanmeter runs elevated. On first launch, if the PawnIO driver (Windows service name `PawnIO`) is not already present, Cleanmeter installs it silently using the bundled, signed `PawnIO_setup.exe`. If the driver is already installed, it is reused and nothing changes. The installer is redistributed verbatim from LibreHardwareMonitor and is Authenticode-signed by namazso.eu; see [`THIRD-PARTY-NOTICES.md`](./THIRD-PARTY-NOTICES.md) for its SHA-256.

If driver installation fails, or the driver is blocked, **Cleanmeter keeps running.** The FPS counter (PresentMon) and every sensor that does not need kernel access (GPU load and temperature via vendor APIs, RAM usage, CPU load, storage, network, battery) stay working. Only the low-level readings that require the driver (chiefly CPU temperature and package power, and some motherboard sensors) drop out until the driver is available.

### Known limitation: anti-cheat software

Some kernel-level anti-cheat systems (for example FACEIT) block third-party kernel drivers, including PawnIO. On a machine where such anti-cheat is active, PawnIO may fail to load and the low-level sensors above will be unavailable. Cleanmeter degrades gracefully in that case rather than crashing.

## Historical note: the WinRing0 detection

Earlier Cleanmeter releases used WinRing0, a **known-vulnerable driver** ([CVE-2020-14979](https://nvd.nist.gov/vuln/detail/CVE-2020-14979)) that Microsoft Defender flags under names like `VulnerableDriver:WinNT/Winring0`, `VulnerableDriver:WinNT/Winring0.G`, `HackTool:Win32/Winring0`, and `Trojan:Win32/Vigorf.A`. The same flag affected MSI Afterburner, FanControl, OpenHardwareMonitor, HWiNFO, and many other tools that shared this driver.

**Moving to PawnIO resolves that detection at the source.** If you are upgrading from an older Cleanmeter and previously added a Defender exclusion or allowed the WinRing0 threat, you can remove it after upgrading (Windows Security > Virus & threat protection > Protection history / Allowed threats). WinRing0 itself is no longer installed or used by Cleanmeter.

## What you'll see today (unsigned releases)

Separately from any driver concern, the Cleanmeter binaries themselves are currently shipped unsigned, so one Windows prompt can still appear on first run.

Cleanmeter's CI has **Authenticode signing infrastructure wired up** for the installer, main executable (`cleanmeter.exe`), background sidecar (`HardwareMonitor.exe`), and bundled `presentmon.exe`. The project does not yet have a code-signing certificate funded, so tagged release builds are currently shipped unsigned. Once a certificate is added to the repository's GitHub secrets, every subsequent tag produces signed bundles automatically with no further code changes.

### SmartScreen "Windows protected your PC" (purple popup, on first launch of the installer)

```
Windows protected your PC
Microsoft Defender SmartScreen prevented an unrecognized app from
starting. Running this app might put your PC at risk.

App:        Cleanmeter_X.Y.Z_x64-setup.exe
Publisher:  Unknown publisher
```

**This is reputation-based, not a virus detection.** SmartScreen flags every unsigned `.exe` from a publisher Windows hasn't seen, including perfectly legitimate ones, until the binary either accumulates thousands of clean installs to build reputation organically, or is signed with a code-signing certificate. (An EV certificate clears the prompt immediately; an OV certificate fades as reputation accrues over hundreds of installs.)

To bypass it for the current release: click **More info > Run anyway**. Before you do, verify the file's SHA-256 against the value listed on the GitHub release page:

```powershell
Get-FileHash Cleanmeter_<version>_x64-setup.exe -Algorithm SHA256
```

If the hash matches the release page, the file you have is byte-for-byte identical to what GitHub built from the tagged source.

## Verifying a release

Once a release ships signed:

```powershell
Get-AuthenticodeSignature "$env:LOCALAPPDATA\Programs\Cleanmeter\cleanmeter.exe"
Get-AuthenticodeSignature "$env:LOCALAPPDATA\Programs\Cleanmeter\HardwareMonitor.exe"
Get-AuthenticodeSignature "$env:LOCALAPPDATA\Programs\Cleanmeter\presentmon.exe"
```

All three should report `Status: Valid` with the same publisher.

You can also verify the bundled PawnIO installer at any time:

```powershell
Get-AuthenticodeSignature "$env:LOCALAPPDATA\Programs\Cleanmeter\PawnIO_setup.exe"
```

It should report `Status: Valid`, signed by `namazso.eu`.

## Reporting a real security issue

If you've found something you believe is an actual vulnerability in Cleanmeter, please contact the maintainers via the project's Discord rather than filing a public GitHub issue. Don't include reproduction steps in a public channel.
