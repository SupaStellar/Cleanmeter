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

LibreHardwareMonitor includes the **WinRing0** kernel driver (OpenLibSys.org),
used for low-level hardware sensor access. See
[`SECURITY.md`](./SECURITY.md) for details on why anti-virus software may flag
this driver.
