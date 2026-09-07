# Overlay customization

Style now contains a live preview and DialKit controls. No account, license
check or payment is required. The existing appearance stays active on upgrade
until a user enables customization or edits an appearance control.

- Independent font family, label/unit color, stat color, size and weight.
- Inner/outer background colors, opacity, images, radius and X/Y padding.
- Six built-in themes; up to 20 named local presets, JSON import/export and undo.
- Horizontal/vertical layout, pill ordering and spacing.
- 32 sensor gauges and six frametime trace treatments. Sensor threshold colors
  remain enabled by default; users can choose a fixed accent instead.

Presets contain appearance and typography only. They never change sensor IDs,
selected GPU, shortcuts, polling rate or desktop position. Font choices use
installed system fonts with Inter as the fallback. PNG/JPEG/WebP uploads are
converted to small embedded raster images, so moving the original file does
not break the overlay. Background opacity does not fade labels or values.

The editor is loaded after the first visit to Style; DialKit and Motion are
excluded from the overlay entry. Its stylesheet is bundled locally without
Google Fonts requests (see THIRD_PARTY_NOTICES.md). Gauges use static SVG,
updated on sensor samples, without animation timers. Appearance normalization
is memoized independently of sensor updates.

## Community service

The companion feedback-portal PR adds `/api/presets` and a protected review UI.
Native builds use the existing `FEEDBACK_PORTAL_URL` build variable. Review
credentials stay on the portal and must never be added to the app. Only
approved presets are visible. Submitting requires an explicit consent checkbox;
local editing and local presets never upload anything. The gallery handles an
unconfigured/offline service with an error and retry, rather than fake results.
Deploy the companion portal migration and configure `PRESET_REVIEW_KEY` before
shipping the community gallery. Browser development can use
`VITE_COMMUNITY_URL=http://localhost:<portal-port>`.

## Validation

`npm test`, `npm run lint`, `npm run build`. With Vite on port 1445, run
`node scripts/check-customization.mjs` (installed Chrome/Playwright required).
The browser check exercises real controls and the live renderer: themes,
ordering, 32 gauges, keyboard input, image conversion, persistence, export,
unsafe import rejection and undo. Windows PR checks compile the native bridge
and verify the appearance field survives Rust settings serialization.

For Windows review, test save/relaunch, native JSON export, importing an exported
image preset, multi-monitor position/clamping, and a real game overlay. The
browser fixture does not verify hardware readings or Windows rendering.
