import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import type * as React from "react";
import { Keycap } from "@/app/components/Keycap";
import { cn } from "@/lib/utils";
import {
  acceleratorFromEvent,
  findShortcutConflict,
  HOTKEY_IN_USE_MESSAGE,
  inProgressKeyLabels,
  shortcutKeyLabels,
} from "@/lib/shortcuts";
import { setShortcutCapturing } from "@/lib/tauri";
import { useToastStore } from "@/stores/toast-store";
import { DeleteIcon, RestoreIcon } from "./shortcut-icons";

/**
 * The shortcut binder from Figma 2792:4130 (Stats) and 2792:5840 (Settings) — a label on the left, and on the
 * right a 4-gap pair of an icon button and a field.
 *
 * The frame draws four states across the four boards, and they differ only in
 * that pair:
 *
 *   bound      2792:4089 + 2792:4118  trash  · outlined field of keycaps
 *   unbound    2792:4299 + 2792:4303  restore · dashed field, "Add shortcut"
 *   listening  2792:4742 + 2792:4746  restore · Blue/600 "Press keys..."
 *   capturing  2792:5068 + 2792:5072  restore · Blue/600 keycaps, live
 *
 * So the icon is not decoration and not a single control: trash appears
 * exactly when there is a binding to clear, restore exactly when there is not
 * one and the default can be put back. The two later states also gain the
 * revolving gradient stroke, which .cm-shortcut-listening draws entirely in
 * CSS — see globals.css.
 *
 * Capture commits on key-UP, not on the main key's key-down. Committing on
 * key-down would skip straight from "Press keys..." to the bound state and
 * the capturing board would never render; releasing is also when the user has
 * actually finished choosing, since holding Shift and then adding F9 is one
 * gesture.
 */
export function ShortcutField({
  label,
  accelerator,
  defaultAccelerator,
  onChange,
  conflictsWith,
  unavailable = false,
  className,
}: {
  label: string;
  /** The bound accelerator, or "" for unbound. */
  accelerator: string;
  /** What the restore button puts back. */
  defaultAccelerator: string;
  onChange: (accelerator: string) => void;
  /**
   * The app's other bindings, keyed by the name each is shown under. A
   * capture that lands on one of these is refused rather than stored — see
   * findShortcutConflict for why two actions cannot share an accelerator.
   */
  conflictsWith?: Record<string, string>;
  /**
   * True when the OS refused to register the bound accelerator, because some
   * other application already owns it. Comes from the `shortcut-status` event.
   */
  unavailable?: boolean;
  /** Row spacing. Figma uses gap 16 inside the Stats sub-card (2792:4025)
   *  and gap 20 in the Settings Shortcuts card (2792:5854). */
  className?: string;
}) {
  const showToast = useToastStore((s) => s.showToast);
  const [listening, setListening] = useState(false);
  // The combo being held right now, as keycap labels. Empty while listening
  // but untouched — that is the "Press keys..." board.
  const [pending, setPending] = useState<string[]>([]);
  // Held in a ref as well as state: the keyup handler needs the last complete
  // accelerator, and reading it from state there would close over the value
  // from the render the listener was attached in.
  const pendingAccelerator = useRef<string | null>(null);
  const fieldRef = useRef<HTMLElement>(null);
  // onChange is an inline arrow at both call sites, so a new identity every
  // render. Held in a ref so the capture effect below depends on `listening`
  // alone and does not tear its window listeners down and put them back on
  // every unrelated re-render — this card re-renders on each sensor tick.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const conflictsRef = useRef(conflictsWith);
  useEffect(() => {
    conflictsRef.current = conflictsWith;
  }, [conflictsWith]);

  const stopListening = useCallback(() => {
    setListening(false);
    setPending([]);
    pendingAccelerator.current = null;
  }, []);

  useEffect(() => {
    if (!listening) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Escape abandons the capture rather than binding itself — otherwise
      // the only way out of the listening state would be to bind something.
      if (e.code === "Escape" && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
        e.preventDefault();
        stopListening();
        return;
      }
      // Swallow everything else while listening: Tab would move focus out of
      // the field mid-capture, Space/Enter would re-fire the button, and any
      // of them is a legitimate thing to bind.
      e.preventDefault();
      e.stopPropagation();
      setPending(inProgressKeyLabels(e));
      const accel = acceleratorFromEvent(e);
      if (accel) pendingAccelerator.current = accel;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      const captured = pendingAccelerator.current;
      if (!captured) {
        // Released without ever completing a combo (modifiers only). Drop
        // back to the bare listening board rather than binding nothing.
        setPending(inProgressKeyLabels(e));
        return;
      }
      if (findShortcutConflict(captured, conflictsRef.current ?? {})) {
        // Refused, not stored. The field keeps the binding it had and the
        // toast says why, so the combo they pressed is visibly rejected
        // instead of silently taking a key off the other row.
        //
        // A toast (Figma 2819:9753). The other way a binding is refused —
        // another application owning the combo — raises the SAME toast, from
        // App.tsx where that status arrives.
        stopListening();
        fieldRef.current?.blur();
        showToast(HOTKEY_IN_USE_MESSAGE);
        return;
      }
      stopListening();
      // Hand focus back before committing. Clicking the field and then
      // pressing a key promotes the button to :focus-visible, so without this
      // the bound board renders wrapped in the app's focus ring — a heavy
      // black outline the frame does not have, sitting there until the next
      // click lands somewhere else. Tabbing to the field still rings it; only
      // a completed capture drops it.
      fieldRef.current?.blur();
      onChangeRef.current(captured);
    };

    // Capture phase so this runs before anything else on the page — the
    // settings window has its own key handling and a global shortcut being
    // typed must not also trigger it.
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
  }, [listening, stopListening, showToast]);

  // Hand our own global shortcuts back to the OS while listening, so a combo
  // Cleanmeter already holds can be pressed into the field instead of just
  // firing its action. Runs on the listening edge and reverses on cleanup, so
  // an abandoned capture (Escape, a click away, the tab unmounting) still
  // restores them.
  useEffect(() => {
    if (!listening) return;
    void setShortcutCapturing(true);
    return () => {
      void setShortcutCapturing(false);
    };
  }, [listening]);

  // Clicking elsewhere abandons the capture, matching Escape.
  useEffect(() => {
    if (!listening) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!fieldRef.current?.contains(e.target as Node)) stopListening();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [listening, stopListening]);

  const isBound = accelerator !== "";
  const boundKeys = shortcutKeyLabels(accelerator);
  // Which of the two board shapes is on screen. Keycaps and text sit at
  // different heights in the frame, so this drives the padding as well as the
  // content — see the note on the field button.
  //
  // A bound field that is listening keeps showing its keys. Figma only ever
  // draws "Press keys..." on a row that has none (2792:4739 is the row whose
  // previous board was "Add shortcut"), and blanking a binding the moment the
  // field is clicked reads as having deleted it — which is the trash button's
  // job, not the field's.
  const keysOnShow = pending.length > 0 ? pending : isBound ? boundKeys : null;
  const showsKeycaps = keysOnShow !== null;

  return (
    // Not in Figma: the frame draws no board for a combo another application
    // owns. It is carried by the field's own stroke alone — the message for it
    // is the toast, the same one an in-app clash raises. An inline note used to
    // sit here as well and it made one outcome look like two problems.
    <div className="flex flex-col gap-[var(--spacingS)]">
      {/* Figma 2792:4025: radius 8, 16 all round, Bg/Surface Sunken Subtler,
          space-between, centred, gap 16. */}
      <div className={cn("flex items-center justify-between gap-[var(--spacingM)]", className)}>
      <span className="text-[14px] font-medium leading-[16px] text-[var(--textHeading)]">
        {label}
      </span>

      <div className="flex shrink-0 items-center gap-[var(--spacingXxxs)]">
        {/* 2792:4089 — 40x40, pad 6/10/8/10, radius 8. Its fill and stroke
            are both switched off in the frame, so the button is bare until
            it is interacted with. */}
        <button
          type="button"
          onClick={() => {
            stopListening();
            fieldRef.current?.blur();
            onChangeRef.current(isBound ? "" : defaultAccelerator);
          }}
          disabled={!isBound && accelerator === defaultAccelerator}
          className={cn(
            // 2792:4089: 40x40, pad 6/10/8/10. Centring the 20px glyph in the
            // resulting 26px content box puts it at y=9 — a pixel above the
            // true middle, which is where the frame has it.
            "flex h-[40px] items-center justify-center rounded-[var(--cornerL)] text-[var(--iconBolderActive)]",
            "px-[10px] pb-[8px] pt-[6px]",
            "transition-colors hover:bg-[var(--bgSurfaceSunkenSubtle)] disabled:pointer-events-none disabled:opacity-40",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          )}
          aria-label={isBound ? `Clear the ${label} shortcut` : `Restore the default ${label} shortcut`}
        >
          {isBound ? <DeleteIcon /> : <RestoreIcon />}
        </button>

        {/* 2792:4118 / 4303 / 4746 / 5072 — HUG x 40, 12 either side.
            The vertical padding is NOT the same on both boards and the
            difference is deliberate. Measured in the frame:

              keycaps  pad 6/8  →  20px row at y=9,  11 below
              text     pad 8/8  →  16px text at y=12, 12 below

            The text is centred; the keycaps are a pixel high. That pixel is
            the optical correction for the cap's own `0 2px 0` depth shadow —
            the cap box runs 9→29 and its shadow to 31, so 9 above and 9
            below, which centres what the eye actually sees. Centring the box
            instead (the obvious `items-center` with even padding) leaves the
            caps visibly low, because the shadow hangs past the bottom. */}
        <FieldBox
          ref={fieldRef}
          // A bound field is display, not a control: the only thing that acts
          // on it is the trash. Clicking the keys used to arm a capture, which
          // put the revolving gradient on a field the user was not editing and
          // read as the binding being taken away. Rebinding is now clear-then-
          // set, which is also the only order in which the two boards Figma
          // draws make sense.
          interactive={!isBound}
          onClick={() => {
            if (listening) {
              stopListening();
              return;
            }
            setListening(true);
            setPending([]);
            pendingAccelerator.current = null;
          }}
          className={cn(
            "flex h-[40px] items-center gap-[var(--spacingXs)] rounded-[var(--cornerL)] px-[var(--spacingS)]",
            showsKeycaps ? "pb-[8px] pt-[6px]" : "py-[8px]",
            "focus-visible:outline-none",
            // The focus ring is suppressed while listening, and only while
            // listening. Clicking the field then pressing a key promotes it
            // to :focus-visible, so the ring lands on top of the revolving
            // gradient and buries it — and it is redundant there anyway: the
            // gradient says "this control has the keyboard" louder than a
            // ring does, which is the whole reason the frame draws one.
            !listening &&
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            listening
              ? // The base Border/Bold stroke, which the frame keeps UNDER the
                // gradient rather than replacing (2819:9531 carries both
                // strokes). .cm-shortcut-listening lays the revolving Blue/600
                // gradient over it.
                "cm-shortcut-listening border border-[var(--borderBold)]"
              : unavailable
                ? // Cleanmeter's logo yellow (--yellow300, #FEC84B) over
                  // Bg/Warning Subtler. NOT --borderWarning (#DC6803): that is
                  // the token set's semantic warning border, and it is a dark
                  // orange that reads as an error next to these keycaps rather
                  // than as "this one is not available". Figma draws no board
                  // for this state, so neither choice is spec — if the
                  // semantic token is wanted here, it is a visible change and
                  // a deliberate one.
                  "border border-[var(--yellow300)] bg-[var(--bgWarningSubtler)]"
                : isBound
                  ? "border border-[var(--borderSubtle)]"
                  : // 2792:4303 is dashPattern [4,4]. CSS `border-style:
                    // dashed` cannot express that — the browser picks its own
                    // dash length off the border width — so the stroke is
                    // drawn as an SVG rect below and the border here only
                    // holds the 1px of inset geometry that Figma's INSIDE
                    // stroke align takes.
                    "relative border border-transparent",
          )}
          aria-label={
            isBound
              ? undefined
              : `${label}: no shortcut. Press to bind one.`
          }
        >
          {!isBound && !listening && !unavailable && <DashedRing />}
          {keysOnShow ? (
            // Keys, in one of three situations: bound and idle (2792:4118),
            // bound and listening — where they simply stay put — and mid
            // capture (2792:5072), which is the only one that recolours them.
            // Blue/600 lands on the cap TEXT alone: 2792:5129's box keeps
            // Border/Bolder and its white fill, unchanged from the bound
            // board.
            <Keycap
              variant="light"
              keys={keysOnShow}
              className={
                pending.length > 0 ? "text-[var(--cm-shortcut-blue)]" : undefined
              }
            />
          ) : listening ? (
            // Listening with nothing to show (2792:4747): Inter Medium 14/16,
            // Blue/600. Only reachable from the unbound board.
            <span className="text-[14px] font-medium leading-[16px] text-[var(--cm-shortcut-blue)]">
              Press keys...
            </span>
          ) : (
            // Unbound (2792:4569): Inter Medium 14/16, Text/Heading.
            <span className="text-[14px] font-medium leading-[16px] text-[var(--textHeading)]">
              Add shortcut
            </span>
          )}
        </FieldBox>
        </div>
      </div>
    </div>
  );
}

/**
 * The dashed outline of the unbound field, Figma 2792:4303: 1px Border/Bolder
 * on the inside edge, radius 8, dash 4 on / 4 off.
 *
 * An SVG rect rather than `border-style: dashed` because that property has no
 * dash length — Chromium derives one from the border width, which at 1px comes
 * out around 3/3 and visibly finer than the frame. Geometry is set in CSS
 * (Chromium supports the SVG2 geometry properties) so the rect tracks a field
 * that hugs its content, while rx stays in user units and does not stretch
 * with it. Inset by half the stroke so the 1px lands inside the box the way an
 * INSIDE stroke does, and rx drops by the same half to stay concentric.
 */
function DashedRing() {
  return (
    <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden>
      <rect
        style={{
          x: "0.5px",
          y: "0.5px",
          width: "calc(100% - 1px)",
          height: "calc(100% - 1px)",
          rx: "7.5px",
        }}
        fill="none"
        stroke="var(--borderBolder)"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
    </svg>
  );
}

/**
 * The field itself: a button while it can be bound, an inert box once it is.
 *
 * Not a `<button disabled>` for the bound case — the keys are readable
 * content, not a dead control, and `disabled` would grey them out and drop
 * them from the tab order and the accessibility tree. Rendering the element
 * that matches what it actually is keeps the `<kbd>`s exposed and simply
 * offers nothing to click.
 */
const FieldBox = forwardRef<
  HTMLElement,
  React.ComponentProps<"button"> & { interactive: boolean }
>(function FieldBox({ interactive, onClick, className, children, ...props }, ref) {
  if (!interactive) {
    // `props` here is the button's leftovers (aria-label is undefined on this
    // branch by construction); spreading it onto a div is safe and keeps the
    // two branches from drifting apart.
    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        className={className}
        {...(props as React.ComponentProps<"div">)}
      >
        {children}
      </div>
    );
  }
  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
      onClick={onClick}
      className={className}
      {...props}
    >
      {children}
    </button>
  );
});
