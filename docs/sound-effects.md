# Interaction sounds and motion

The app and Storybook share the same control implementations. Motion supports reduced-motion preferences, keyboard interaction, interrupted animations and preserved tab state.

## Sound mapping

| Interaction | Sound |
| --- | --- |
| Section and feature switches | Cuelume 0.2.2 `toggle`, the same cue in both directions |
| Metric, startup and diagnostics checkboxes | Cuelume 0.2.2 `press` |
| Changed selections | Cuelume 0.2.8 `select` |
| Open feedback | Cuelume 0.2.8 `open`, subtle emphasis, half gain |
| Submit feedback or reset settings | `success` or `error` after completion |
| Enable sounds | `toggle` |
| Disable sounds | Silent; cancels active and pending cues |
| Tabs, hover, accordions, tooltips, continuous sliders, telemetry | Silent |

Both libraries use 70% global volume. A grouped switch produces one cue, even when it changes several sensors. Hydration and programmatic updates remain silent. Sound preferences persist across restarts; asynchronous actions cannot replay a cue cancelled by muting.

## Audio implementation

`src/lib/sound-effects.ts` gates explicit user-action cues and coordinates the two pinned library versions. `src/lib/settings-actions.ts` distinguishes switches, checkboxes and selections. Dependency patches retain the sound recipes while preparing audio nodes before reading the playback clock, with a 10 ms scheduling lead. The older engine also cancels active voices, echo tails and pending context resumes when muted.

On Windows, a focused, visible and unmuted settings window maintains audio readiness through `src/lib/audio-session.ts`. It uses a 20 Hz signal at gain 0.0005, ramped over 50 ms. This is a low-level signal rather than mathematical silence. It stops on mute, blur, hide, page exit and hot reload, and does not run in the overlay or ordinary browser preview. Broader listening review across audio outputs remains required.

## Motion

- Tabs: 250 ms indicator and content transition; inactive panels stay mounted and inert.
- Switches: 350 ms bounce adapted to the existing control geometry.
- Checkboxes: 350 ms stroke drawing and 150 ms unchecking.
- Dropdowns and dialogs: 250 ms entry and 150 ms exit; preserve focus and dismissal behavior.
- Accordions: 250 ms expansion and collapse.
- Conditional panels: 300 ms measured-height changes; open height releases to auto.
- Toasts: 350 ms entry and 250 ms exit; repeated messages cancel stale exit timers.
- Tooltips: 80 ms delay, 150 ms entry and 50 ms exit.

Reduced motion disables movement, blur and animation. Shared styles live in `src/app/motion.css` and `src/app/disclosure-motion.css`.

## Local preview and validation

From `tauri-app`, run `npm run dev -- --host 127.0.0.1 --port 1420`. Open `/sound-lab/` to compare both Cuelume versions without changing application settings. The playground optionally enables audio readiness while it is focused.

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run build-storybook`
- `cargo test --lib --manifest-path src-tauri/Cargo.toml`
- Browser checks: `scripts/test-sound-effects.mjs`, `test-checkbox-motion.mjs`, `test-control-motion.mjs`, `test-remaining-motion.mjs` and `test-storybook-motion.mjs`.
- `scripts/test-legacy-audio.mjs` checks active-tail cancellation and no replay after unmute in the sound playground.

Use the scripts' URL environment variables when running on another port. Type checking currently reports five pre-existing diagnostics in overlay styling, Fluent button props, enum syntax and sensor-setting assignment.

## Remaining validation

Final visual/listening review and broader audio-output coverage are required before release. The native overlay stacking change also needs confirmation during normal taskbar use.
