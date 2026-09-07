# Windows startup test build

This build (2.2.17-startup.3) includes PR #67's reconnect fix, independent pipe startup,
hardware-stage reporting, and a targeted replacement for stalled memory discovery. It keeps PawnIO. It is a test build, not a release or
a confirmed fix for the reported PC.

Reported configuration: Windows 11, Intel Core i7-14700K, NVIDIA RTX 4080 Super,
32 GB RAM, ASUS ROG Strix B760-F Gaming WiFi; no overclocking reported. The user
reports v2.2.13 works, v2.2.14/.16/.17 fail, and a build containing #67 still fails.
The exact failing native call has not been established.

## Install and test

1. Quit Cleanmeter from its tray menu, then install the included setup executable.
2. Launch Cleanmeter and allow up to a minute for hardware discovery.
3. Check for actual changing CPU, GPU, RAM and FPS readings. A connected pipe
   alone is not a successful sensor test.
4. If readings remain unavailable, the settings banner should name the stage
   that has not finished (or failed). Capture that text.
5. In Task Manager, right-click the **HardwareMonitor.exe** belonging to this
   Cleanmeter installation and select **Open file location**. Open
   `LogFiles/<date>/Log.txt` beside it. Share this log with the stage text.
   It includes process ID and startup milestones. Review it before sharing;
   it can include hardware names and running application names.
6. Also collect `%LOCALAPPDATA%\Cleanmeter\Logs\cleanmeter.log`. This records
   the app version, executable paths, sidecar PID, pipe errors, and whether a
   first sensor packet reached the Rust client. Paths can contain your username.

The installer has no new signing certificate; it is an unsigned development
build if repository signing is not configured. This workflow does not publish a
release or change anyone else's installed version. Do not disable Windows
security settings to test it.

## What changed

The named pipe starts before hardware enumeration. Sensor operations and cleanup
remain on one worker; a delayed native call is never cancelled, retried in
parallel, or closed by another thread. Slow discovery can complete later and
send readings through the already connected pipe. Separate status packets report
the current stage, including stalls during later sensor reads. No dummy sensor
packets are sent to suppress the failure banner.

The affected PC reported a stall at **Discovering memory sensors** in startup.2.
This build leaves LibreHardwareMonitor's MemoryGroup disabled and uses Windows'
GlobalMemoryStatusEx for physical RAM and system committed-memory usage instead.
It preserves the existing sensor IDs and GiB/percentage units. Per-DIMM
identification and RAM-stick temperatures are not collected. CPU/GPU monitoring
and PawnIO stay enabled. Other sensor categories are still discovered separately.

A permanently blocked hardware call still prevents sensor readings. The build
does not claim that starting PresentMon independently makes its FPS readings
reach the overlay before hardware initialization; sensor publication still uses
the hardware worker. Stage reporting is intended to identify the next specific
fix if the ordering change is insufficient.

## Validation and limits

The Windows workflow runs the real named-pipe server with simulated blocked
hardware, checks command and status traffic, releases the blocked operation and
checks late publication. It also checks shutdown during a blocked operation.
A mutation moving pipe startup behind the blocked operation must fail that
regression test. Other checks cover C#, Rust, and frontend code, followed by a
full Windows installer build.

The Windows check also verifies all six OS memory sensor identifiers and finite
values through the published sidecar's real pipe. The simulated stall is a regression test, not a reproduction of this exact
motherboard/driver failure. Real sensor success on the affected PC remains the
acceptance test. The frontend build currently has unrelated existing standalone
TypeScript type-check errors; the repository's lint, unit tests, and Vite build
remain the checked baseline.
