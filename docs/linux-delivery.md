# Linux delivery gates

Baseline: Windows v2.2.19 (`ed0bb61`), with the Linux implementation from PR #68
(`abf6e59`) applied without replacing current UI changes.

## 1. Current-main preview

- Resolve the Linux port against current settings, diagnostics, Pixel Shift,
  GPU power validation, sounds, and clock UI.
- Run frontend tests/lint/build, Linux Rust tests and launcher tests.
- Build AppImage, DEB and RPM on Ubuntu 22.04.
- Exercise X11 and native Wayland with an isolated settings directory.
- Compare standalone TypeScript diagnostics to clean main.

## 2. Overlay implementation and local validation

Complete implementation and local validation before requesting Mars's testing.
Hardware testing is a final acceptance step, not a gate on further development.
Test Desktop Mode and Game Mode separately. A passing desktop smoke test does
not establish Game Mode support. Check transparency, visibility over a native
game and a Proton game, focus, controller input, and coexistence with Steam/QAM
and the performance overlay. Record SteamOS version and LCD/OLED model.

Gamescope's external overlay selection must be investigated before adopting an
external-window integration. Do not replace or terminate Steam's mangoapp to
make a test pass. If a separate renderer is needed, keep the shared settings UI
and telemetry contracts and review the architecture before expanding the port.

## 3. Telemetry parity

Add tested Linux CPU/GPU clock providers and supported power providers. Validate
real AMD APU readings on Deck and keep unavailable readings distinct from zero.
Test device identity, reconnects, permissions, stale data and game selection.

## 4. Product parity

Verify current layouts, themes, graphs, settings persistence, reset, Pixel
Shift, shortcuts, startup, diagnostics, feedback and sound on Linux. Probe
Wayland portal support instead of promising universal global shortcuts.

## 5. Frame statistics

Per-frame MangoHud 0.7.2 capture has been validated against a live Vulkan workload.
The Linux implementation now computes Windows-compatible live and recording lows.
Continue checking game restarts, capture-file rotation, long sessions and overhead.

## 6. Packaging and hardware acceptance

Verify clean install, upgrade, uninstall and a portable home-directory launch.
No changes to SteamOS read-only protection. Measure idle and in-game overhead,
suspend/resume, game exits, and long sessions. AppImage compatibility and real
GPU support require hardware evidence. Keep release artifacts unpublished until
explicit publication approval.

## Test environments

- Windows: shared frontend and Windows backend regression checks.
- Ubuntu 22.04 WSL2: Linux builds/tests and WebKit runtime checks. Virtualized
  sensors are not evidence of host Windows or Deck hardware support.
- Xvfb/Weston: headless startup and application integration.
- Do not install additional Linux distributions or a Linux VM. Use the existing, user-approved WSL
  environment for local builds and native runtime checks.
- Mars's Deck: physical sensors, games, controls, Game Mode and performance.

## Remaining delivery gates

Native Wayland layer-shell positioning and portal shortcut integration are
implemented and locally exercised. Unsupported desktops retain a monitor window.
Gamescope Game Mode coexistence with Steam's performance HUD is not implemented
and cannot be signed off from these desktop tests.

MangoHud 0.7.2 retains every captured sample until logging stops. Cleanmeter's
bounded reader and histogram do not bound the producer's memory or CSV growth.
A bounded capture transport is required before long-session parity sign-off.

Signed AppImage release configuration and a serialized Linux draft-release job
are implemented. No signed update was published or end-to-end applied.
Physical Deck sensors, Proton, suspend/resume, controller input and driver
performance remain acceptance checks.
