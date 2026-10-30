# Linux local validation — 2026-10-30

Source: `feat/linux-current`, uncommitted changes on Windows v2.2.19 (`ed0bb61`).
Build host: the existing Ubuntu 22.04 WSL environment on the Windows machine.
No additional distribution or VM was installed for these checks.

## Verified

- Frontend: 195 unit tests, ESLint and production Vite build passed.
- Linux Rust: 62 tests passed, one explicitly ignored live-capture test.
- Windows Rust: 64 tests passed, one explicitly ignored live-capture test.
- Launcher: five tests passed.
- Native binary: X11 and headless Weston startup reached monitoring with 11
  available sensors. WSL exposes only a subset of physical hardware.
- Native WebDriver: settings/preferences round trips, autostart on/off, monitor
  enumeration, overlay visibility commands, all four settings tabs, and the
  Alt+F11 live/recording/frozen cycle passed.
- Real MangoHud 0.7.2 plus `vkcube`: both percentile-low sensors arrived with
  positive values in the native webview. This tests the complete launcher,
  capture, calculation, event and webview path, without synthetic telemetry.
- The extracted AppImage passed those same native tests, including live lows,
  with an isolated temporary profile. FUSE mounting itself was not tested.
- AppImage, DEB and RPM packages built successfully. Package SHA-256 hashes are
  supplied beside the local artifacts.
- DEB clean installation in WSL passed the same isolated native tests as a
  normal user, including live Vulkan lows. The test package was then removed;
  its executable was verified absent afterward.

The WebDriver tests use Xvfb, Openbox and xcompmgr, with WebKit compositing
disabled to avoid the WSL software-rendering problem. This is a test-environment
setting, not an application-wide rendering override.

## Still open

- Wayland layer-shell positioning passed on headless Sway. A private portal
  fixture passed shortcut activation, desktop rebinding, session revocation
  and recreation. Real desktop consent UI remains unverified.
- Mixed-scale monitor selection and runtime scale changes passed. Headless Sway
  rejected output disabling; unplug/replug is not covered.
- Gamescope/Steam Deck Game Mode overlay integration is unvalidated and cannot
  be inferred from the desktop tests.
- Actual AMD APU sensors, Proton games, suspend/resume, long-session capture
  overhead and multi-monitor behavior require further coverage. CPU power is
  conditional on readable hwmon/RAPL data; inaccessible data stays absent.
- DEB replacement of the earlier same-version preview, native runtime and
  uninstall passed. RPM payload install/uninstall passed in an isolated RPM
  root with dependency/scripts disabled; this is not Fedora runtime evidence.
- AppImage signed updater configuration and draft release workflow are prepared;
  no signed update was published or applied.
- MangoHud 0.7.2 retains per-frame samples for the whole capture session.
  End-to-end bounded capture is not implemented.
- Five standalone TypeScript diagnostics were previously reproduced on clean
  Windows main; Vite, ESLint and frontend unit checks are separate passing gates.
- Feedback submission was not sent, Slack messages were not sent, and nothing
  was committed, pushed or published.

Reproduce the native checks using `src-tauri/linux/test_native_webdriver.sh` as
described in `linux.md`. These results establish a tested desktop development
build, not complete Linux/Deck parity sign-off.

## Review follow-up validation

- Frozen results now survive game exit/telemetry expiry and source replacement.
  Accumulator and publication regression tests pass; native X11 testing records
  a real Vulkan workload, freezes it, terminates the game and confirms both low
  readings are unchanged after telemetry expires.
- GTK is initialized before selecting the shortcut backend. Native Sway tests
  passed with both `GDK_BACKEND=wayland,x11` and `GDK_BACKEND=x11,wayland` without
  an X11 display, exercising GTK's actual fallback choice.
- Browser checks at 1280, 768 and 375 pixels verified that Pixel Shift is disabled
  with an explanation on the unsupported Wayland fallback, and remains usable
  on X11 and Windows. No horizontal overflow or browser errors were observed.

The earlier AppImage shared for Desktop Mode testing predates these follow-up
fixes. These results do not establish Game Mode or bounded long-session capture.
