# Windows startup investigation

The affected PC is reported as Windows 11, i7-14700K, RTX 4080 Super,
32 GB RAM, and ASUS ROG Strix B760-F Gaming WiFi, without overclocking.
Reported outcomes: v2.2.13 works; v2.2.14, v2.2.16, v2.2.17, and a build
containing PR #67 fail. HardwareMonitor remains visible in Task Manager.
The reported console output is "Starting monitor"; the original log is not
available here. Whether any readings appear before the error is still unknown.

## Release binary comparison

Downloaded the actual GitHub release installers for v2.2.13 and v2.2.14 and
extracted their NSIS resources. Parsed the .NET single-file bundle manifests
using the .NET 8 HostModel format and compared the embedded file contents.

- PawnIO_setup.exe is byte-identical (SHA-256
  `a3a46226c5e2824f4cdd42be0eecbabfc672c86f7889710f5ab1e6ad385b47a0`).
- presentmon.exe is byte-identical (SHA-256
  `0ab15984223e84b2aa17be4a5a63b8097f006a74a281968cddc60f85f2149438`).
- Both sidecar bundles contain 220 files; 219 are byte-identical, including
  LibreHardwareMonitorLib.dll, dependency manifests, and runtime configuration.
- Both bundle .NET runtime 8.0.28.
- HardwareMonitor.dll differs in 94 bytes. Metadata inspection using
  System.Reflection.Metadata found identical signatures for all 160 method
  definitions and identical IL, stack sizes, local-signature tokens, and exception
  regions for all 158 method bodies. Build revision strings and module IDs differ.
- The Rust lockfile change in this version window is rustls-webpki
  0.103.9 -> 0.103.13, not a Tauri/WebView2 dependency update.

This does not identify the runtime failure. It does establish that a changed
PawnIO installer, sensor-library DLL, .NET runtime, or C# method body is not the
binary difference in this reported version boundary. Different launch timing,
application behavior, installation state, security decisions, or extraction
state still require runtime evidence; none is established as the cause.

## What the test build addresses

PR #67 handles EOF after a pipe reader disconnects. It does not establish a
connection to a server that has not started, nor recover a native hardware call
that never returns. The new build starts transport first, discovers sensor
categories sequentially, isolates thrown discovery errors, and reports blocked
stages without accessing hardware concurrently. A permanent native hang remains
unresolved until its cause can be identified.

The independent logs distinguish these next outcomes:

- No named-pipe server startup: failure before transport startup.
- Server waiting, client connection errors: investigate connection/launch state.
- Connected, hardware stage delayed: identify the named hardware probe.
- Rust logs a first sensor packet but the UI has no readings: investigate event
  delivery or rendering rather than hardware discovery.

See [test instructions](windows-startup-test.md) for log locations and the
acceptance check. Sensor readings on the affected PC, not a green build or a
connected pipe, determine whether this resolves that user's issue.

## Follow-up: screenshot from startup.2

The affected PC now reports a connected pipe and **Discovering memory sensors
has not finished**. That stage surrounds `Computer.IsMemoryEnabled = true`,
which constructs LibreHardwareMonitor 0.9.6's MemoryGroup. Earlier motherboard
and CPU discovery calls have returned by this point (possibly with logged
exceptions); this screenshot does not establish that all their readings work.

MemoryGroup constructs the ordinary memory counters, then synchronously calls
RAMSPDToolkit's driver loading and DIMM/SMBus discovery before its constructor
returns. The screenshot cannot distinguish driver loading from a later DIMM
probe, but it does identify this constructor as the blocked operation.

Startup.3 avoids that constructor altogether. WindowsMemoryHardware reads
GlobalMemoryStatusEx and publishes the existing physical (`/ram`) and committed
memory (`/vram`) sensor IDs. It removes per-stick temperature/detail probing from
this build; it does not disable RAM usage monitoring or replace PawnIO for other
hardware. The next affected-PC test must confirm that discovery passes this stage
and actual CPU/GPU/RAM readings arrive.

Sources: [LHM MemoryGroup](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor/blob/v0.9.6/LibreHardwareMonitorLib/Hardware/Memory/MemoryGroup.cs),
[Windows GlobalMemoryStatusEx](https://learn.microsoft.com/en-us/windows/win32/api/sysinfoapi/nf-sysinfoapi-globalmemorystatusex).
