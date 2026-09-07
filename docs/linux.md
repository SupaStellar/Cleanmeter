# Cleanmeter for Linux (preview)

The Linux build uses a native Rust monitoring backend. It does not require .NET,
PresentMon, PawnIO, a Windows service, or administrator privileges to run.
Packages target x86-64 desktops: Debian/Ubuntu `.deb`, Fedora-family `.rpm`, and
an AppImage. ARM and Steam Deck Gaming Mode are not validated.

## Install and start

Download the `cleanmeter-linux-x86_64` artifact from a successful **Linux preview**
GitHub Actions run on `feat/linux-support`. These are development packages, not a
published stable release. Extract the artifact, then use the appropriate command
with the actual filename:

```sh
sudo apt install ./Cleanmeter_2.2.17_amd64.deb
# or, on Fedora:
sudo dnf install ./Cleanmeter-2.2.17-1.x86_64.rpm
# or:
chmod +x ./Cleanmeter_2.2.17_amd64.AppImage
./Cleanmeter_2.2.17_amd64.AppImage
```

Package filenames can vary; use the name in your downloaded artifact. AppImages
still need a working desktop and graphics driver. If FUSE is unavailable, use
`--appimage-extract-and-run`. Hardware monitoring starts when Cleanmeter starts.

The app prefers X11/XWayland when available. On native Wayland it uses a normal
monitor window, without absolute overlay positioning or global shortcuts.
Exclusive fullscreen, native Wayland games under an XWayland session, and
Gamescope can obscure external overlay windows. Borderless/windowed mode is the
recommended starting point. This preview does not inject Cleanmeter's UI into games.

Closing Settings minimizes it to the taskbar. Stats has a visibility switch and
a Quit button, so a desktop without tray icons still has controls. Start at login
writes an XDG autostart entry for the current executable; if you move an AppImage,
turn Start at login off and back on to update its path.

## Game FPS and frametime

Install **MangoHud 0.7.0 or newer** through your distribution or the
[upstream project](https://github.com/flightlessmango/MangoHud#installation).
Check with `mangohud --version`. Older distro packages, including 0.6.x, cannot
provide the live CSV output used here. Hardware monitoring works without MangoHud.

For a native game:

```sh
cleanmeter-run /path/to/game [arguments]
```

For Steam installed on the host, set the game's launch options to:

```text
cleanmeter-run %command%
```

With an AppImage, use its absolute path instead:

```text
"/home/you/Applications/Cleanmeter.AppImage" --run %command%
```

`--run` launches the game without starting a second monitor instance; keep the
Cleanmeter app open separately. The DEB/RPM also accept `cleanmeter --run ...`.
Some OpenGL games need `cleanmeter-run --dlsym game`. Proton games need the
appropriate MangoHud libraries inside their Steam runtime. Flatpak Steam, Snap
Steam, anti-cheat games, and Gamescope require separate validation; this preview
does not configure their sandbox permissions or promise compatibility.

The launcher creates private temporary logs under
`$XDG_CACHE_HOME/cleanmeter/fps` (or `~/.cache/cleanmeter/fps`), removes its session
on normal exit, and disables log uploads. It preserves game arguments and exit
codes. An interrupted machine or SIGKILL can leave session files; they can be
removed after the game exits. Keep cache paths free of commas (MangoHud uses them
as configuration separators).

FPS and frametime are sampled every 100 ms by MangoHud, then read at Cleanmeter's
polling rate. Auto chooses the most recently updated game; selecting a game pins
the source. Readings expire after three seconds without a log update. Unsupported
or absent readings show a dash. **1%/0.1% lows and benchmark recording are disabled**
because these logs are sampled telemetry, not reliable per-frame capture.

## Hardware coverage

| Reading | Source and limits |
| --- | --- |
| CPU utilization | `/proc/stat` deltas; first poll establishes a baseline |
| CPU temperature | Recognized `hwmon` CPU drivers; prefers package/Tctl/Tdie |
| CPU power | Not collected in this preview |
| RAM | `/proc/meminfo`, using `MemAvailable` to account for reclaimable cache |
| Network | `/proc/net/dev` byte deltas; excludes loopback; counter resets are discarded |
| AMD GPU | DRM/sysfs busy percentage, VRAM, temperature and power when exposed |
| NVIDIA GPU | Driver's `nvidia-smi`, with a bounded timeout; N/A readings are omitted |
| Intel GPU | Enumerated through DRM; only exposed sysfs sensors are read. Utilization, VRAM, and power are often unavailable |

Optional unreadable sensors stay absent; the app does not change device permissions.
GPU selection remains scoped to one GPU. Linux identifiers differ from Windows,
so manually imported Windows sensor selections may need to be selected again.

## Diagnose and build

Print current hardware and active game samples without opening a GUI:

```sh
cleanmeter --diagnose
# or ./Cleanmeter.AppImage --diagnose
```

This includes hardware names and local interface identifiers; review it before
sharing. It does not send diagnostics anywhere.

On Ubuntu 22.04+ with Rust and Node 22 installed:

```sh
sudo apt install build-essential libwebkit2gtk-4.1-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev libssl-dev patchelf rpm
cd tauri-app
npm ci
npm run lint
npm test
npm run build
python3 src-tauri/linux/test_launcher.py
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib
npm run tauri -- build --bundles deb,rpm,appimage
```

The platform-specific Tauri configurations keep Windows sidecar resources out of
Linux bundles. `.github/workflows/linux.yml` builds all three package formats,
smoke-tests desktop startup, and checks live MangoHud FPS with a software-rendered
Vulkan cube on Ubuntu 24.04. Physical GPU drivers, actual games, Fedora installs,
and native Wayland compositor behavior still need device testing before release.
Linux updates are installed manually through a downloaded package; the Windows
in-app updater is disabled for this preview.
