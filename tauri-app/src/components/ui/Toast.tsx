import { useEffect, useRef, useState } from "react";
import { useToastStore } from "@/stores/toast-store";
import { ErrorIcon } from "./shortcut-icons";

/**
 * The settings window's transient error toast, Figma 2819:9753.
 *
 * Measured off the frame: HUG pill at radius 100 on Bg/Brand, padding 6 left
 * and 6/6 vertical against 20 on the right (the badge supplies the optical
 * inset on its side, so the text is the end that needs the room), gap 12. The
 * Bg/Brand fill inverts with the theme for free — #0C111D in light, #FAFAFA
 * in dark — with Text/Inverse tracking it the other way. The 40x40 Yellow/950
 * badge holds the 20px `error` glyph in Bg/Warning Active.
 *
 * Position is the frame's too: x 175 in a 651-wide window is dead centre, at
 * y 76 down from the window's top edge.
 *
 * ## Motion
 *
 *   Beats:   fades up 16px above its mark -> settles onto it -> holds ->
 *            fades out rising the same 16px
 *   Trigger: a shortcut capture refused because the combo is already bound.
 *            An event, not a state, which is what makes a toast the right
 *            shape for it rather than a line of text under the field.
 *   Timing:  in 300ms (fade 260ms), hold 4000ms, out 220ms (fade 180ms)
 *   Feel:    in  = critically-damped spring sampled to linear(), zero
 *                  overshoot: covers most of the drop early, then settles
 *                  onto its mark instead of stopping dead
 *            out = cubic-bezier(0.32, 0.72, 0, 1), which builds speed so it
 *                  leaves rather than creeping
 *
 * The fade is the entrance here, not a coat on one. An earlier version parked
 * the pill 104px up behind the title bar and slid it out, treating the opaque
 * bar as a mask — but a mask cuts, it does not soften, and the pill arrived at
 * the bar's edge already 84% opaque with a hard flat top where the chrome had
 * clipped it. It now stays clear of the bar entirely. See .cm-toast in
 * globals.css for the geometry.
 *
 * Occasional-tier by frequency: you only see this when a binding is refused,
 * so it earns a standard entrance rather than the near-imperceptible
 * treatment a many-times-a-day control would get.
 *
 * CSS transitions, NOT keyframes — see .cm-toast in globals.css.
 */
/** Time the toast stays fully up, between the entrance and the exit. */
const HOLD_MS = 4000;
/** Must be at or over the exit duration in .cm-toast[data-state="closed"]. */
const EXIT_MS = 240;

export function Toast() {
  const message = useToastStore((s) => s.message);
  const token = useToastStore((s) => s.token);
  const clearToast = useToastStore((s) => s.clearToast);
  const [open, setOpen] = useState(false);
  // Held in a ref rather than as a second piece of state so the whole cycle
  // stays in one effect: state that lives in a ref cannot be a dependency,
  // which is what keeps the effect from re-running mid-flight.
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The whole cycle, keyed on `token` rather than `message`: the message is
  // the same string every time, so a second refusal would otherwise look like
  // "nothing changed" and the first toast's hold would carry on and close the
  // second one early.
  //
  // Every setState here is inside a deferred callback. That is not just to
  // satisfy react-hooks/set-state-in-effect — a synchronous setOpen(true)
  // would land in the same paint as the mount, so the browser would never see
  // the closed frame and there would be nothing to transition FROM.
  useEffect(() => {
    if (!message) return;
    // Two frames, not one: requestAnimationFrame runs BEFORE the paint it is
    // scheduled against, so a single one still shares the mount's paint. The
    // nested one is the first callback after the closed board is on screen.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setOpen(true));
    });
    const hold = setTimeout(() => {
      setOpen(false);
      // Stay mounted for the exit, then drop. Not `transitionend`: the toast
      // animates two properties so it fires twice, and under
      // prefers-reduced-motion transform is `none` and never changes at all.
      exitTimer.current = setTimeout(clearToast, EXIT_MS);
    }, HOLD_MS);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(hold);
      if (exitTimer.current) {
        clearTimeout(exitTimer.current);
        exitTimer.current = null;
      }
    };
  }, [message, token, clearToast]);

  return (
    <>
      {/* The live region is mounted for the life of the window, empty, and the
          message is inserted into it. Several screen readers announce only
          mutations inside a region that already existed, and the visual pill
          below enters the DOM in the same commit as its text, so an
          announcement hung on the pill itself can simply be dropped.

          Visually inert (sr-only clips it to 1px), so the pill's geometry and
          motion are untouched; the pill is aria-hidden because this region is
          what speaks, and both would say it twice. */}
      <div role="status" aria-live="polite" className="sr-only">
        {message ?? ""}
      </div>
      {message && <ToastPill message={message} open={open} />}
    </>
  );
}

function ToastPill({ message, open }: { message: string; open: boolean }) {
  return (
    // The positioner carries the centring translate and the toast carries the
    // animated one. Both on one element would mean re-declaring the -50%
    // inside every transform state, and any state that forgot it would snap
    // the toast half its width to the right mid-animation.
    // Wedged between the two: ABOVE the tab buttons, which are `relative
    // z-10` and would otherwise print straight through the pill (they share
    // this stacking context and come later in the DOM, so equal z-indices
    // hand it to them), and BELOW the title bar at z-30. The pill no longer
    // travels anywhere near the bar, so that lower bound is only insurance
    // for a two-line message growing upward.
    <div className="pointer-events-none absolute left-1/2 top-[76px] z-20 -translate-x-1/2">
      <div
        data-state={open ? "open" : "closed"}
        // Announced by the mounted live region above, not from here. It uses
        // role=status rather than role=alert deliberately: alert interrupts a
        // screen reader mid-sentence, and a refused keybinding does not
        // warrant that.
        aria-hidden="true"
        className={
          "cm-toast flex items-center gap-[var(--spacingS)] rounded-[var(--cornerRound)] " +
          "bg-[var(--bgBrand)] py-[var(--spacingXxs)] pl-[var(--spacingXxs)] pr-[var(--spacingL)] " +
          // Not in the frame, which draws one message and hugs it. The window
          // is 651 wide with 24 of padding, so a longer string than the
          // frame's would run off both edges without this.
          "max-w-[calc(651px-var(--spacingXl)*2)] shadow-large"
        }
      >
        <span className="flex size-[40px] shrink-0 items-center justify-center rounded-[var(--cornerRound)] bg-[var(--yellow950)]">
          <ErrorIcon className="size-[20px] text-[var(--bgWarningActive)]" />
        </span>
        {/* leading-[17px] is Figma's AUTO line height for Inter 14 — the text
            node measures 17 high on one line (2819:9759). */}
        <span className="text-[14px] font-medium leading-[17px] text-[var(--textInverse)]">
          {message}
        </span>
      </div>
    </div>
  );
}
