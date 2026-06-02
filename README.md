<p align="center">
  <img src="https://github.com/user-attachments/assets/dd41db59-e6d0-4eb8-aff0-c79590401de3" width="100%" alt="Cleanmeter" />
</p>

---

# Cleanmeter

A clean, minimal performance overlay for gamers. Monitor your system stats without the ugly fluorescent numbers.

## Features

- **Real-time overlay** — FPS, CPU, GPU, RAM, and network stats displayed as a clean pill bar on your screen
- **Auto-start monitoring** — sensors connect automatically on launch, overlay shows up instantly
- **Light & dark mode** — overlay adapts to your preference with proper contrast
- **Customizable** — adjust font sizes, opacity, and choose which sensors to display
- **Borderless fullscreen support** — overlay stays on top in borderless windowed games
- **Start with Windows** — optional auto-launch on boot
- **Frametime graph** — live graph that shows frame pacing, flat line = smooth, spikes = stutters
- **Network speed** — download/upload rates with live graph
- **Smart sensor auto-select** — picks the right CPU, GPU, RAM, and network sensors automatically

## Requirements

- Windows 10/11 (x64)
- [.NET 8 Desktop Runtime](https://dotnet.microsoft.com/en-us/download/dotnet/8.0) — required for hardware monitoring

## Install

Download the latest installer from [Releases](https://github.com/SupaStellar/Cleanmeter/releases/latest) and run it. The app requests admin access to read hardware sensors.

## Tech Stack

- **Frontend**: React + TypeScript (Tauri v2)
- **Backend**: Rust (Tauri) + C# (.NET 8, LibreHardwareMonitor, PresentMon)
- **IPC**: Windows named pipes
