// Suppress WebView2's default browser context menu (Back / Refresh / Save as /
// Print / More tools / Send tab to your devices) so right-click does nothing in
// the app. Nothing in the UI relies on a right-click menu; the native one just
// leaked Edge chrome into the overlay and settings windows.
//
// Capture phase so no component-level handler can bypass it.
window.addEventListener(
  "contextmenu",
  (e) => e.preventDefault(),
  { capture: true },
);
