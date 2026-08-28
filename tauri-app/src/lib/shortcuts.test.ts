import { describe, it, expect } from "vitest";
import { OVERLAY_SHORTCUT_DEFAULT, RECORDING_SHORTCUT_DEFAULT } from "./types";
import {
  acceleratorFromEvent,
  inProgressKeyLabels,
  isModifierEvent,
  findShortcutConflict,
  isSupportedShortcutCode,
  shortcutKeyLabels,
} from "./shortcuts";

/** A keydown as the capture handler sees it. */
function press(
  code: string,
  mods: Partial<{ ctrl: boolean; alt: boolean; shift: boolean; meta: boolean }> = {},
) {
  return {
    code,
    ctrlKey: mods.ctrl ?? false,
    altKey: mods.alt ?? false,
    shiftKey: mods.shift ?? false,
    metaKey: mods.meta ?? false,
  };
}

describe("acceleratorFromEvent", () => {
  it("emits the accelerators the app already ships, unchanged", () => {
    // Both defaults are combos lib.rs hardcoded before they were settings.
    // Pressing either has to round-trip to that exact string, or an upgrade
    // would think the user had rebound something they never touched — and
    // the Rust side's "has this changed?" compare would re-register on every
    // save.
    expect(acceleratorFromEvent(press("F11", { alt: true }))).toBe("Alt+F11");
    expect(acceleratorFromEvent(press("F11", { alt: true }))).toBe(RECORDING_SHORTCUT_DEFAULT);
    expect(acceleratorFromEvent(press("F10", { ctrl: true, alt: true }))).toBe("Ctrl+Alt+F10");
    expect(acceleratorFromEvent(press("F10", { ctrl: true, alt: true }))).toBe(
      OVERLAY_SHORTCUT_DEFAULT,
    );
  });

  it("orders modifiers Ctrl, Alt, Shift, Super whatever order they went down in", () => {
    // Two spellings of one shortcut in settings.json would let the Rust
    // side's "has this changed?" compare miss a real change, and would show
    // the same binding two different ways in the field.
    const all = { ctrl: true, alt: true, shift: true, meta: true };
    expect(acceleratorFromEvent(press("KeyR", all))).toBe("Ctrl+Alt+Shift+Super+KeyR");
    expect(acceleratorFromEvent(press("KeyR", { shift: true, ctrl: true }))).toBe(
      "Ctrl+Shift+KeyR",
    );
  });

  it("binds a bare key with no modifiers", () => {
    expect(acceleratorFromEvent(press("F9"))).toBe("F9");
  });

  it("refuses a modifier on its own", () => {
    // Holding Shift is a press in progress, not a shortcut. Returning
    // "Shift" here would register a shortcut that swallows the Shift key
    // globally.
    expect(acceleratorFromEvent(press("ShiftLeft", { shift: true }))).toBeNull();
    expect(acceleratorFromEvent(press("ControlRight", { ctrl: true }))).toBeNull();
    expect(acceleratorFromEvent(press("MetaLeft", { meta: true }))).toBeNull();
  });

  it("refuses keys global-hotkey cannot parse", () => {
    // These are real KeyboardEvent.code values with no entry in
    // global-hotkey's parse_key table. Letting one through stores an
    // accelerator that fails to register at startup, silently — the field
    // would show a binding that does nothing.
    expect(acceleratorFromEvent(press("IntlBackslash", { ctrl: true }))).toBeNull();
    expect(acceleratorFromEvent(press("F25", { ctrl: true }))).toBeNull();
    expect(acceleratorFromEvent(press("ContextMenu"))).toBeNull();
    expect(acceleratorFromEvent(press("AudioVolumeUp"))).toBeNull();
  });
});

describe("isSupportedShortcutCode", () => {
  it("accepts the edges of each family global-hotkey supports", () => {
    for (const code of ["KeyA", "KeyZ", "Digit0", "Digit9", "F1", "F24", "Numpad0", "NumpadEnter"]) {
      expect(isSupportedShortcutCode(code)).toBe(true);
    }
  });

  it("stops at the edges rather than pattern-matching past them", () => {
    // F24 is the last function key in the table and Numpad9 the last digit,
    // so a regex like /^F\d+$/ would admit F25 and register nothing.
    for (const code of ["F25", "F0", "Numpad10", "KeyÄ"]) {
      expect(isSupportedShortcutCode(code)).toBe(false);
    }
  });
});

describe("isModifierEvent", () => {
  it("covers both sides of every modifier", () => {
    for (const code of [
      "ControlLeft",
      "ControlRight",
      "AltLeft",
      "AltRight",
      "ShiftLeft",
      "ShiftRight",
      "MetaLeft",
      "MetaRight",
    ]) {
      expect(isModifierEvent({ code })).toBe(true);
    }
    expect(isModifierEvent({ code: "KeyA" })).toBe(false);
  });
});

describe("inProgressKeyLabels", () => {
  it("shows the modifiers alone before the main key lands", () => {
    // This is the difference between the "Press keys..." board and the
    // capturing board: the field must show "Shift" the moment Shift goes
    // down, not wait for the whole combo.
    expect(inProgressKeyLabels(press("ShiftLeft", { shift: true }))).toEqual(["Shift"]);
    expect(inProgressKeyLabels(press("AltLeft", { alt: true, ctrl: true }))).toEqual([
      "Ctrl",
      "Alt",
    ]);
  });

  it("adds the main key once it arrives", () => {
    expect(inProgressKeyLabels(press("F9", { shift: true }))).toEqual(["Shift", "F9"]);
  });

  it("drops an unbindable main key rather than showing a cap that cannot commit", () => {
    expect(inProgressKeyLabels(press("IntlBackslash", { ctrl: true }))).toEqual(["Ctrl"]);
  });
});

describe("shortcutKeyLabels", () => {
  it("renders codes as the key legends a keyboard actually prints", () => {
    expect(shortcutKeyLabels("Ctrl+Shift+KeyR")).toEqual(["Ctrl", "Shift", "R"]);
    expect(shortcutKeyLabels("Alt+Digit1")).toEqual(["Alt", "1"]);
    expect(shortcutKeyLabels("Ctrl+Backquote")).toEqual(["Ctrl", "`"]);
    expect(shortcutKeyLabels("Ctrl+ArrowUp")).toEqual(["Ctrl", "Up"]);
    expect(shortcutKeyLabels("Ctrl+Numpad7")).toEqual(["Ctrl", "Num 7"]);
    expect(shortcutKeyLabels("Escape")).toEqual(["Esc"]);
  });

  it("leaves F-keys alone — they are already their own legend", () => {
    expect(shortcutKeyLabels("Alt+F11")).toEqual(["Alt", "F11"]);
    // What the Settings Shortcuts card renders (Figma 2792:5846).
    expect(shortcutKeyLabels(OVERLAY_SHORTCUT_DEFAULT)).toEqual(["Ctrl", "Alt", "F10"]);
  });

  it("returns nothing for an unbound shortcut, so the field falls to Add shortcut", () => {
    expect(shortcutKeyLabels("")).toEqual([]);
  });

  it("round-trips a captured press back to the keys that were pressed", () => {
    const accel = acceleratorFromEvent(press("KeyK", { ctrl: true, shift: true }));
    expect(accel).toBe("Ctrl+Shift+KeyK");
    expect(shortcutKeyLabels(accel!)).toEqual(["Ctrl", "Shift", "K"]);
  });
});

describe("findShortcutConflict", () => {
  it("names the binding a combo is already taken by", () => {
    expect(
      findShortcutConflict("Alt+F11", { "Show/hide overlay": "Alt+F11" }),
    ).toBe("Show/hide overlay");
  });

  it("passes a combo nothing else holds", () => {
    expect(
      findShortcutConflict("Alt+F10", { "Show/hide overlay": "Ctrl+Alt+F10" }),
    ).toBeNull();
  });

  it("does not treat two unbound fields as a collision", () => {
    // "" is the unbound field, not a binding. Without the guard, clearing one
    // shortcut would make every other cleared shortcut report a conflict.
    expect(findShortcutConflict("", { "Show/hide overlay": "" })).toBeNull();
    expect(findShortcutConflict("", { "Show/hide overlay": "Alt+F11" })).toBeNull();
    expect(findShortcutConflict("Alt+F11", { "Show/hide overlay": "" })).toBeNull();
  });

  it("compares the stored spelling, which is why modifier order is canonical", () => {
    // acceleratorFromEvent always emits Ctrl,Alt,Shift,Super order, so these
    // two strings can never both occur — but if that ordering ever broke,
    // this is the check that would start missing real collisions.
    const stored = acceleratorFromEvent(press("KeyR", { alt: true, ctrl: true }))!;
    expect(findShortcutConflict(stored, { Recording: "Ctrl+Alt+KeyR" })).toBe("Recording");
  });
});

describe("the shipped defaults", () => {
  const DEFAULTS = {
    "Show/hide overlay": OVERLAY_SHORTCUT_DEFAULT,
    "Start/stop FPS lows recording": RECORDING_SHORTCUT_DEFAULT,
  };

  it("ships no two actions on one combo", () => {
    // The shortcut fields refuse a conflicting capture and raise the toast,
    // so a conflict baked into the DEFAULTS is the one the user could never
    // have been warned of — nothing would fire the toast, and whichever
    // action registered second would silently never run.
    for (const [name, accelerator] of Object.entries(DEFAULTS)) {
      const others = Object.fromEntries(
        Object.entries(DEFAULTS).filter(([other]) => other !== name),
      );
      expect(findShortcutConflict(accelerator, others)).toBeNull();
    }
  });

  it("spells every default the way a capture would", () => {
    // Modifiers in MODIFIER_ORDER, key as a W3C code. A default spelled
    // "Shift+Alt+F11" would be the same combo as a captured "Alt+Shift+F11"
    // and compare unequal to it — the conflict check would miss the clash,
    // and the field would show a restore button that never goes idle.
    for (const accelerator of Object.values(DEFAULTS)) {
      const parts = accelerator.split("+");
      const key = parts[parts.length - 1];
      const mods = parts.slice(0, -1);
      expect(isSupportedShortcutCode(key)).toBe(true);
      expect(
        acceleratorFromEvent(
          press(key, {
            ctrl: mods.includes("Ctrl"),
            alt: mods.includes("Alt"),
            shift: mods.includes("Shift"),
            meta: mods.includes("Super"),
          }),
        ),
      ).toBe(accelerator);
    }
  });
});
