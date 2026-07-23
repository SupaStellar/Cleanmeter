# Third-Party Notices

Cleanmeter redistributes the third-party components listed below. Each component
remains under its own license; those terms apply to the components, not to
Cleanmeter itself (for Cleanmeter's own terms, see [`LICENSE`](./LICENSE)).

---

## Intel PresentMon

- Source: https://github.com/GameTechDev/PresentMon
- Bundled as: `presentmon.exe`
- License: MIT

```
Copyright (C) 2017-2024 Intel Corporation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## LibreHardwareMonitor

- Source: https://github.com/LibreHardwareMonitor/LibreHardwareMonitor
- Bundled as: `LibreHardwareMonitorLib.dll` (used by the HardwareMonitor sidecar)
- License: Mozilla Public License 2.0 (MPL-2.0) — https://www.mozilla.org/en-US/MPL/2.0/

The source for the MPL-licensed files is available at the URL above. As permitted
by the MPL, these files are distributed in binary form as part of Cleanmeter.

For low-level hardware sensor access, LibreHardwareMonitor uses the **PawnIO**
kernel driver (see below). See [`SECURITY.md`](./SECURITY.md) for details.

---

## PawnIO

- Source: https://pawnio.eu/ and https://github.com/namazso/PawnIO
- Bundled as: `PawnIO_setup.exe` (the signed official installer, version-matched
  to LibreHardwareMonitor v0.9.6; installed at first launch, see `SECURITY.md`)
- License: GNU General Public License v2.0 (GPL-2.0), with the author's linking
  exception permitting combination with independent modules that communicate
  through the driver's device IO-control interface

PawnIO is a separate, self-contained kernel driver. Cleanmeter runs its installer
and communicates with the driver through IO control (via LibreHardwareMonitor);
it is not linked into the Cleanmeter application. The installer is redistributed
verbatim from LibreHardwareMonitor's v0.9.6 resources; its authenticity is
verifiable by Authenticode signature (signed by namazso.eu) and by SHA-256:

```
a3a46226c5e2824f4cdd42be0eecbabfc672c86f7889710f5ab1e6ad385b47a0  PawnIO_setup.exe
```
