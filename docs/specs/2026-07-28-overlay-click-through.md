# Overlay click-through

Status: proposed, not implemented
Date: 2026-07-28
Base: `main` @ `0937e36`

## Problem

The overlay window hit-tests on every pixel it occupies, so clicks landing on
the HUD never reach the game or desktop underneath. This is a regression from
the pre-Tauri Kotlin build, which shipped click-through on by default.

The Rust plumbing already exists and is correct
(`commands.rs:144` -> `set_ignore_cursor_events`), but every call site
computes a condition that can never be true:

- `settings-store.ts:298` and `:318` evaluate
  `!useCustomPosition && isPositionLocked`
- `useCustomPosition` defaults to `true` (`lib/types.ts:168`)
- `isPositionLocked` defaults to `false` (`lib/types.ts:176`) and is
  force-cleared whenever `useCustomPosition` is on
  (`settings-store.ts:248` and `:311`)
- no UI ever writes `isPositionLocked`; `PositionGrid.tsx` renders only the
  "Use custom position" switch and the six preset tiles

So `set_ignore_cursor_events(true)` is unreachable. `af5b8c3` (PR #10) wired it
off deliberately, to fix a stale `isPositionLocked: true` that left the HUD
undraggable with no way to recover. That fix was right; the side effect is that
click-through left the product.

There is also an unrelated defect in the same window: `focusable` is not set on
the overlay, so it defaults to `true` (`tauri-utils-2.8.3/src/config.rs:1744`).
No `WS_EX_NOACTIVATE`, so a left-click on the HUD activates the overlay window
and can knock a borderless-fullscreen game out of focus. The Kotlin build
guarded this with `focusable = !isPositionLocked` (`OverlayWindow.kt:76`); the
Tauri port dropped it.

## Goals

1. The HUD is fully click-through whenever the user is not actively positioning
   it. Clicks pass to the game or desktop underneath.
2. Clicking the HUD never changes which window is active.
3. Drag-to-reposition keeps working, unchanged, with no new mode for the user
   to remember and no state they can get stuck in.
4. Nothing else about the overlay changes.

## Non-goals

- Per-pixel click-through, i.e. the pill interactive while the gaps around it
  pass clicks. Tauri has no `forward` option
  ([#6164](https://github.com/tauri-apps/tauri/issues/6164), open since 2023)
  and the maintainers closed
  [#2090](https://github.com/tauri-apps/tauri/issues/2090) calling transparent-area
  detection "a near impossible task". Out of scope.
- Shaping the window to the pill's `border-radius: 9999` so the four corner
  dead zones disappear. `SetWindowRgn` would clip antialiasing. Out of scope.
- macOS and Linux. This is a Windows-only app.

## Why this design and not a lock toggle

Drag is the only mouse functionality the overlay has. Verified across
`OverlayHud`, `FpsSection`, `CpuSection`, `GpuSection`, `RamSection`,
`NetSection`, `Pill`, `ProgressRing`, `ProgressBar`, `FrametimeGraph`,
`NetGraph`: no buttons, no hover states, no tooltips, and the WebView2 context
menu was already disabled in PR #34. The single mouse handler in the whole
overlay is `onMouseDown` at `OverlayApp.tsx:317`. So if drag survives, no
functionality is harmed.

A manual Locked/Unlocked toggle (the Kotlin approach, `Position.kt:184-229`)
works, but it is a mode the user can leave in the wrong state. A stale
`isPositionLocked: true` is exactly what PR #10 had to dig out. Deriving the
state instead of storing it removes that class of bug entirely.

Gating on "Settings window is visible" is not enough: with two monitors,
Settings parked open on the second screen while gaming on the first would leave
the HUD interactive and eating clicks during gameplay. Focus is the state that
actually tracks "I am positioning this right now".

## Design

### The gate

One derived boolean, owned by Rust, never persisted:

```
overlay_interactive == settings window is visible
                       AND the foreground window belongs to this process
```

The second half is process-wide, not "the settings window is focused", and that
distinction is the crux of the design. Clicking the HUD makes the **overlay** the
foreground window, which defocuses the settings window. `WS_EX_NOACTIVATE` does not
prevent this: WebView2's child HWND answers `WM_MOUSEACTIVATE` with `MA_ACTIVATE`.
Measured directly (see Results): mouse-down on the pill produced
`fg=cleanmeter[Tauri Window]<OVERLAY>`.

Keying on settings focus therefore closed the gate on mouse-down and cut the drag
off mid-gesture: the interaction destroyed its own precondition. The drag only
appeared to work at all because WebView2 takes implicit mouse capture on mouse-down,
so the rest of the gesture kept reaching a window that had become click-through, and
the HUD landed somewhere other than where it was dragged.

Asking "is any window of ours in front" covers the settings window and the overlay
alike, so a drag completes. It needs no timer, no button-state polling and no IPC
from the webview, and because it is computed from live state at the moment the gate
would close, it cannot race.

| Situation | Settings focused | Overlay |
|---|---|---|
| App launches normally | yes | interactive, draggable |
| App launches with "Start minimized" | no | click-through |
| User alt-tabs into a game | no | click-through |
| User closes Settings to tray | no | click-through |
| User clicks the tray icon or "Show Settings" | yes | interactive, draggable |
| Second instance launched (focuses existing Settings) | yes | interactive, draggable |

Every one of those transitions already routes through code that either fires
`WindowEvent::Focused` or explicitly calls `show()` + `set_focus()`, so no new
triggers are needed.

### Rust: derive, don't store

Nothing is stored, not even in memory. Two `pub` helpers in `commands.rs`:

```rust
// Applies the ex-style. interactive == false -> WS_EX_TRANSPARENT.
pub fn apply_overlay_interactive(app: &AppHandle, interactive: bool)

// GetForegroundWindow -> GetWindowThreadProcessId == GetCurrentProcessId
#[cfg(windows)]
fn foreground_is_ours() -> bool

// Recomputes the gate from live window state, then applies it.
pub fn sync_overlay_interactive(app: &AppHandle) {
    let settings_shown = /* settings window is_visible() */;
    let interactive = settings_shown && foreground_is_ours();
    apply_overlay_interactive(app, interactive);
}
```

`foreground_is_ours` uses `GetForegroundWindow` + `GetWindowThreadProcessId` from the
`windows` crate; `Win32_UI_WindowsAndMessaging` and `Win32_System_Threading` are
already enabled in `Cargo.toml`, so no new dependency or feature is needed.

Off Windows it is a stub returning `false`, leaving the overlay permanently
click-through. That is deliberate: CI builds a single `windows-latest` matrix entry, so
a second real implementation could never be compiled or tested and would only rot, and
the app is Windows-only in every load-bearing part anyway (requireAdministrator
manifest, PawnIO driver, PresentMon, the HardwareMonitor sidecar). One stub keeps
`sync_overlay_interactive` to a single code path on every platform.

`set_ignore_cursor_events` is safe on a hidden window; it only mutates window
flags (`tao-0.34.6/.../windows/window_state.rs:285`).

An earlier draft of this design held the intent in a managed `AtomicBool`. That
was dropped: testing found a state where the settings window was visible, another
app held foreground, and the gate was still open. A launch where the settings
window is shown but never wins foreground (autostart at logon, or another app
grabbing focus first) would leave the overlay eating clicks until the user's next
focus change. Recomputing from live state makes it self-correcting and removes the
second source of truth at the same time, which is the whole point of deriving rather
than storing.

So there are two paths, and they agree by construction:

- the `Focused` event handler gives an instant response (measured at roughly one
  poll interval, see Results)
- the 500ms heartbeat guarantees convergence even if an event is missed

### Rust: wiring

Extend the existing settings-window handler at `lib.rs:459`:

```rust
tauri::WindowEvent::Focused(_) => {
    sync_overlay_interactive(&app_handle3);
}
```

Recompute rather than trusting the event's boolean. A `Focused(false)` here can mean
"the user switched to their game" (close the gate) or "the user pressed the mouse on
the HUD, which activated the overlay" (keep it open, a drag just started), and only
the process check tells those apart.

The hide-to-tray path needs its own call, because `hide()` is not guaranteed to emit
`Focused(false)`. It must use `apply_overlay_interactive(.., false)` and **not**
`sync_overlay_interactive`.

The reason is reentrancy, not style. `sync_overlay_interactive` reads `is_visible()`, a
`window_getter!` that blocks until the event loop replies, and the `CloseRequested`
handler runs while the loop is already blocked waiting on the `prevent_close` channel
(`CloseRequestApi(Sender<bool>)`). `apply_overlay_interactive` only sends one-way
messages, so it cannot wedge the close. The `Focused` arm has no such channel wait,
which is why the getter is safe there and is used there.

This is reasoned from the runtime's structure, not measured: an attempt to measure it
produced the same result either way, because the synthetic `WM_CLOSE` used to drive the
test does not reproduce a real click on the window's close button. Treat the constraint
as a design rule to preserve, not as a demonstrated failure.

Forcing `false` here does mean one writer that isn't derived. That is the right trade,
and it is safe: the 500ms heartbeat reconciles the value, so a forced write cannot
persist as a wrong state.

```rust
tauri::WindowEvent::CloseRequested { api, .. } => {
    api.prevent_close();
    if let Some(window) = app_handle3.get_webview_window("settings") {
        let _ = window.hide();
    }
    apply_overlay_interactive(&app_handle3, false);
}
```

Recompute in two more places, both cheap no-ops when nothing changed:

- `set_overlay_visible`: after `show()`. The overlay is created hidden and first
  shown on initial sensor data, which can land after the gate was decided, so it
  must never come up interactive while Settings is unfocused.
- the 500ms always-on-top loop in `lib.rs`, alongside `set_always_on_top(true)`.
  `apply_diff` early-returns on an empty diff (`window_state.rs`), so this costs
  nothing and is what makes the gate self-healing.

### Config

`tauri.conf.json`, overlay window block (`:31-45`), add:

```json
"focusable": false
```

tao maps this to `WS_EX_NOACTIVATE` (`window.rs:1145` ->
`window_state.rs:296`).

Measured caveat: this does **not** stop the overlay taking foreground when clicked,
because WebView2's child HWND answers `WM_MOUSEACTIVATE` with `MA_ACTIVATE`. So it is
not what protects a game's focus, and the gate cannot rely on it either (hence the
process-wide foreground check above). What actually protects a game is click-through
itself: while gaming, Settings is hidden, so the gate is closed, so the overlay is
`WS_EX_TRANSPARENT` and cannot be clicked at all. `focusable: false` still earns its
place for programmatic show/hide and for keeping the overlay out of activation
ordering, but it is not load-bearing for either guarantee.

`focus: false` stays as-is. Verified that tao sets `MARKER_DONT_FOCUS` at
creation (`window.rs:1147`) and never clears it from stored state (`apply_diff`
mutates a by-value copy at `window_state.rs:329`), so every `show()` uses
`SW_SHOWNOACTIVATE` and toggling the overlay with Ctrl+Alt+F10 already does not
steal focus.

### Deletions

`isPositionLocked` becomes unreachable and every consumer of it goes:

| File | What |
|---|---|
| `src-tauri/src/types.rs:327` | field `is_position_locked` |
| `src/lib/types.ts:99`, `:176` | interface field and default |
| `src/stores/settings-store.ts:245-250` | load-path heal block |
| `src/stores/settings-store.ts:311-313` | update-path heal block |
| `src/stores/settings-store.ts:298`, `:303`, `:317-319` | the three `setOverlayClickThrough` calls |
| `src/lib/tauri.ts:49-50` | `setOverlayClickThrough` wrapper |
| `src-tauri/src/commands.rs:144-149` | `set_overlay_click_through` command |
| `src-tauri/src/lib.rs:507` | its handler registration |
| `src/OverlayApp.tsx:228` | drop `|| settings.isPositionLocked` from the guard |
| `src/OverlayApp.tsx:308` | `draggable = settings.useCustomPosition` |

`OverlaySettings` has no `deny_unknown_fields` (verified `types.rs:296-300`), so
a leftover `isPositionLocked` key in an existing saved settings file
deserializes fine. No migration needed.

Removing the field from both the Rust struct and the TS interface in the same
change is required, not optional: PR #17 documented that a mismatch makes serde
silently drop fields and the overlay then receives a stripped payload.

## Edge cases

| Case | Behavior | Note |
|---|---|---|
| Drag released past the monitor edge | unchanged | clamp on release, `OverlayApp.tsx:293` |
| Pixel Shift on | unchanged | only calls `set_overlay_position`, never touches cursor events |
| Preset positions (6 tiles) | unchanged | set from Settings, no overlay mouse input |
| Ctrl+Alt+F10 overlay toggle | unchanged | `SW_SHOWNOACTIVATE`, verified above |
| Alt+F11 recording toggle | unchanged | no overlay mouse input |
| Settings open but unfocused, e.g. behind a game | click-through | this is why the gate requires foreground, not mere visibility |
| Overlay hidden | irrelevant | no HWND to hit-test |
| Mouse-down on the HUD activates the overlay | gate stays open | the overlay is one of ours, so `foreground_is_ours()` still holds |
| Drag dragged past the monitor edge | clamps to the monitor | `clampToMonitor`, `OverlayApp.tsx:39-55`; measured as an X delta of -13 instead of -180 when starting at X=13 |
| HUD parked over the taskbar | not draggable | pre-existing, see Out of scope |
| User needs to move the HUD with Settings closed | reopen Settings from tray, one click | acceptable; the tray icon is always there |

## Rejected: a drag guard

An earlier draft planned a `set_overlay_drag_active(bool)` command driven from
`onMouseDown`/`onUp`, with the gate pinned open while a drag was in flight. It was
dropped once the mechanism was measured. It would have added a second source of truth,
required IPC from the webview on the hot path of a gesture, and still raced (the guard
and the focus loss are triggered by the same OS event, so the guard can lose). The
process-wide foreground check achieves the same thing with no state, no IPC and no
ordering assumption, and additionally keeps repeated drags working, which the guard
would not have.

## Verification plan

Every item must be observed, not assumed. Two notes on method, both of which will
otherwise produce results that look like app bugs and are not:

- **Build with the Tauri CLI**, `npx tauri build --no-bundle`, never a bare
  `cargo build --release`. `tauri::is_dev()` is `!cfg!(feature = "custom-protocol")`
  (`tauri-2.10.3/src/lib.rs:315`), a feature the CLI supplies. Without it the binary
  loads the frontend from `devUrl` and shows `ERR_CONNECTION_REFUSED`, so no React
  mounts, no sensor data arrives, and the overlay never sizes or shows. That looks
  exactly like an app bug and is not one.
- **Do not test drag with the pill over the taskbar.** `Shell_TrayWnd` out-ranks the
  overlay in the topmost band, so a click there never reaches the HUD. Park the pill
  in clear space first, and assert the hit-test resolves to the overlay before
  trusting any drag result.

1. HUD still renders while click-through (the `WS_EX_LAYERED` check, and the single
   most likely thing to break).
2. Clicks pass through, verified by hit-test at several points and by a real click
   landing on a window underneath.
3. Drag works with the gate open, position persists, and the resulting delta matches
   the gesture after allowing for `clampToMonitor`.
4. The gate stays open for the whole drag, sampled per step rather than only before
   and after.
5. Gate transitions in both directions, including Settings visible-but-unfocused.
6. Gate closes on hide-to-tray.
7. Start minimized: HUD comes up click-through with Settings never shown.
8. Pixel Shift still nudges while click-through.
9. Ctrl+Alt+F10 hides and shows with the right style on every show.
10. Steady-state soak: leave it click-through for minutes, confirm no style thrash
    from the heartbeat.

Not yet covered: a session in a real borderless-fullscreen game.

## Risks and fallbacks

**R1. `WS_EX_LAYERED` blanks the WebView2 HUD.** Tauri implements click-through
as `WS_EX_TRANSPARENT | WS_EX_LAYERED` (`window_state.rs:285`). This window has
never had `WS_EX_LAYERED`: its transparency comes from
`DwmEnableBlurBehindWindow` with an empty region (`tao .../window.rs:1283-1296`),
not from layering. MSDN states a window given `WS_EX_LAYERED` "will not become
visible until `SetLayeredWindowAttributes` or `UpdateLayeredWindow` has been
called". The Kotlin build set the same two styles successfully
(`WindowsService.kt:56-67`), but on a Skia/AWT window, not WebView2.

Fallback: stop using `set_ignore_cursor_events` and apply only
`WS_EX_TRANSPARENT` ourselves, which is sufficient for hit-test pass-through.
`windows 0.58` with `Win32_UI_WindowsAndMessaging` is already a dependency
(`Cargo.toml:37-46`):

```rust
// GetWindowLongPtrW | SetWindowLongPtrW on GWL_EXSTYLE,
// toggling WS_EX_TRANSPARENT only, on overlay.hwnd()
```

Did not fire. The HUD renders normally with `WS_EX_LAYERED` set, so the fallback was
never needed. Kept here because the reasoning still applies if a future tao or WebView2
bump changes it.

**R2. `focusable: false` stops WebView2 delivering mouse events, breaking
drag.** Did not fire. Drag works with `WS_EX_NOACTIVATE` set, which matches the
expectation that it blocks activation rather than mouse messages, and that wry's
`WS_CHILD` webview HWND (`wry .../webview2/mod.rs:251-264`) inherits the parent's
hit-testing. It turned out not to block activation either, see the note under Config.

**R3. Focus blip on HUD mousedown.** Fired, and it was worse than a blip: mouse-down
activates the overlay outright and the settings window loses focus for the duration.
Resolved by keying the gate on process-wide foreground rather than settings focus (see
The gate). Confirmed fixed: the gate was sampled at all 18 steps of a synthetic drag
and never closed.

## Results

Measured on Windows 11, 2560x1440 single display, against release builds produced by
`npx tauri build --no-bundle`. Raw traces are not committed; the assertions below are
what they showed.

| Check | Result |
|---|---|
| R1: does `WS_EX_LAYERED` blank the HUD | No. Pill renders in every state; screen captures of the pill rect sampled 500-2000 distinct colours where a blank HUD would give 1-3 |
| Click-through engages when Cleanmeter is not in front | Yes. exStyle `0x080C0138` = `TOPMOST\|TRANSPARENT\|LAYERED\|NOACTIVATE` |
| Hit-test passes through | Yes, at 5 points across the pill, all resolving to the app underneath |
| A real click passes through | Yes. Synthetic click at the pill centre; the probe window beneath received `MouseDown`, count 1 |
| HUD is undraggable while click-through | Yes, origin unchanged after a full synthetic drag |
| Gate opens when Cleanmeter comes to front | Yes |
| Gate closes when another app comes to front, Settings still visible | Yes |
| Gate closes on hide-to-tray | Yes, from a real click on the window's close button. A synthetic `WM_CLOSE` does not reproduce it, so automate this one by clicking or not at all |
| Gate survives mouse-down on the HUD | Yes, after the R3 fix. `fg=<OVERLAY> gate=OPEN`, never closed across 18 drag steps |
| Drag works with the gate open | Yes. dy -239 against an intended -240; dx clamped to -13 from an intended -180 because the pill started at X=13 and `clampToMonitor` pinned it to the left edge |
| New position persists to `settings.json` | Yes |
| Repeated drags | Yes, the gate stays open after a drag since the overlay is still in front |
| Ctrl+Alt+F10 hide/show | Visibility flips, styles survive the re-show, foreground stays on the other app |
| Steady state soak | 2.5 min with Settings visible-but-unfocused: gate stayed closed, HUD kept rendering and resizing, no style thrash from the heartbeat |
| Saved settings carrying the removed `isPositionLocked` | Loads fine, and is rewritten without it |
| `cargo check`, `tsc --noEmit`, `eslint` | Clean, no warnings |

Not covered by measurement: a real borderless-fullscreen game. The taskbar stood in for
"another app in front", which exercises the same foreground logic but not a game's own
input grabbing.

## Files touched

```
tauri-app/src-tauri/tauri.conf.json        overlay: focusable: false
tauri-app/src-tauri/src/lib.rs             Focused + CloseRequested wiring,
                                           sync in the 500ms loop,
                                           drop set_overlay_click_through handler
tauri-app/src-tauri/src/commands.rs        apply_/sync_overlay_interactive,
                                           foreground_is_ours,
                                           drop set_overlay_click_through,
                                           sync in set_overlay_visible
tauri-app/src-tauri/src/types.rs           drop is_position_locked
tauri-app/src/lib/types.ts                 drop isPositionLocked + default
tauri-app/src/lib/tauri.ts                 drop setOverlayClickThrough
tauri-app/src/stores/settings-store.ts     drop 2 heal blocks + 3 call sites
tauri-app/src/OverlayApp.tsx               drop isPositionLocked from 2 guards
```

## Out of scope, noted for later

Three pre-existing issues found while testing this. None is caused by this change and
none is fixed by it, but each deserves its own look.

- **The always-on-top heartbeat is a no-op.** `lib.rs:438` re-asserts
  `set_always_on_top(true)` every 500ms, with the stated intent "so games can't push it
  behind". tao's `apply_diff` early-returns when the `ALWAYS_ON_TOP` bit is unchanged
  (`window_state.rs`), so the call never reaches `SetWindowPos` and never re-raises the
  window. It cannot do what its comment claims. This is why `Shell_TrayWnd` sits above
  the overlay. Fixing it means calling `SetWindowPos(HWND_TOPMOST, SWP_NOACTIVATE)`
  directly rather than going through the flag diff.
- **A HUD parked over the taskbar is not draggable**, a direct consequence of the
  above. Measured: with the gate open, a hit-test at the pill centre returned
  `explorer[Shell_TrayWnd]`, so the click never reaches the HUD. The saved position
  `13,1402` on a 1440-tall display sits fully inside the taskbar, so this is reachable
  in normal use.
- The pill's `border-radius: 9999` leaves the four corners of the window rect
  transparent but hit-testable while the gate is open. Cosmetic, and irrelevant while
  click-through.
- The overlay is created 1920x200 (`tauri.conf.json:35-36`) and only shrinks once
  `apply()` measures a non-zero HUD, early-returning on a zero rect
  (`OverlayApp.tsx:123`). Click-through masks it in the state that matters.
