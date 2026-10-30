# Steam Deck preview test

This is a current-main Linux preview, not a parity release. Start in Desktop
Mode. Game Mode overlay compatibility is an explicit experiment and may fail.
No root password, package-manager changes, or read-only filesystem changes
should be needed to launch the portable application.

## Start

1. Extract the test kit into a directory under your home folder.
2. In that directory, run `sha256sum -c SHA256SUMS`.
3. Make the included AppImage executable (`chmod +x ./*.AppImage`).
4. Launch the AppImage. If FUSE is unavailable, use
   `./Cleanmeter_2.2.19_amd64.AppImage --appimage-extract-and-run`.
5. If launch fails, capture its terminal output. Do not install system packages
   or disable SteamOS read-only protection to work around it.

## Desktop Mode

- Record Deck model (LCD/OLED), SteamOS version and desktop session type.
- Check settings fit the 1280x800 display; scroll all tabs and test touch input.
- Check CPU/RAM/network readings change under load; compare against a trusted
  monitor. WSL results do not validate Deck hardware readings.
- Check GPU identification, load, temperature, memory and available power.
  Unsupported readings must not appear as credible zero values.
- Toggle the overlay, change its layout/position, and check it does not steal
  game input. Check theme, graph toggles, persistence and restart.
- FPS requires a compatible MangoHud installation (0.7+). Record
  `mangohud --version`; if unavailable, report it rather than changing SteamOS.
- With compatible MangoHud, keep Cleanmeter open and try this Steam launch
  option using the actual absolute path to the AppImage:
  `"/home/deck/path/Cleanmeter_2.2.19_amd64.AppImage" --run %command%`.
- Test one native Vulkan game and one Proton game. Check selection, switching,
  exit/relaunch and stale values. Remove the launch option after testing.

## Game Mode experiment

Record whether the app launches, whether the overlay is visible above a game,
whether game/controller input remains usable, and whether Steam/QAM and the
built-in performance HUD still work. Do not terminate mangoapp or replace
Steam components. An app opening as a separate full-screen window is a failure
of the in-game overlay requirement, not a successful overlay test.

## Stability and overhead

Use the same game scene/settings with Cleanmeter off and on. Record FPS,
frametime behavior, CPU/memory usage and battery power where available. Test
suspend/resume and a 30-minute session. Note crashes or stale readings.

## Diagnostic snapshot

Run the AppImage with `--diagnose > cleanmeter-diagnostics.json`. This is a
read-only hardware and sampled FPS snapshot. Review it before sharing: it can
include hardware identifiers and game names. Include screenshots and exact
reproduction steps. Do not include Steam credentials or unrelated logs.

## Known gaps

Native Wayland supports layer-shell positioning and desktop portal shortcuts
where available; other desktops use a monitor window. Game Mode is unvalidated.
CPU/GPU clocks, supported CPU power, per-frame percentile lows and recording are
implemented and locally tested; Deck sensor coverage and long-session overhead
remain unverified. Signed AppImage updater configuration is prepared, but no Linux update has
been published or applied end to end. MangoHud per-frame capture memory grows
throughout a session; this remains an implementation gap.

## Remove

Quit Cleanmeter, disable its autostart setting if enabled, remove any Steam
launch option you added, then delete the extracted kit. Retain settings if you
intend to test a later build.
