/**
 * Global-shortcut accelerators: build them from a keypress, render them as
 * keycap labels, and reject anything the Rust side cannot register.
 *
 * The accelerator format is not ours — it is `global-hotkey`'s
 * `parse_hotkey`, which `tauri-plugin-global-shortcut` calls. That parser
 * splits on "+", folds each token to uppercase, matches CONTROL/CTRL, ALT/
 * OPTION, SHIFT and COMMAND/CMD/SUPER as modifiers, and passes anything else
 * through a fixed key table. That table's canonical spellings are the W3C
 * `KeyboardEvent.code` values ("KeyA", "Digit1", "F9", "ArrowUp"), so a
 * shortcut can be assembled straight out of a DOM event with no translation
 * step — which is why SUPPORTED_CODES below is transcribed from that table
 * rather than invented. A code missing from it parses to
 * HotKeyParseError::UnsupportedKey in Rust, and a shortcut that fails to
 * parse fails to register, silently, at startup. Validating here is what
 * keeps an unregisterable combo out of settings.json in the first place.
 */

/**
 * The one message shown when a combo cannot be bound, whichever way it failed.
 *
 * Two different refusals reach the user — the other action in this app already
 * holds the combo, or another application does and Windows will not give it up
 * — and they are one message on purpose (Saad, 2026-08-28). From where the
 * user is standing they are the same fact: the key they just pressed is taken.
 * Splitting them into a toast and an inline note made the same outcome look
 * like two different problems.
 */
export const HOTKEY_IN_USE_MESSAGE = "Assigned hotkey is already in use";

/** Modifier keys, which can never be the main key of a shortcut. */
const MODIFIER_CODES = new Set([
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "ShiftLeft",
  "ShiftRight",
  "MetaLeft",
  "MetaRight",
]);

/**
 * Every key `global-hotkey` 0.7 can register, by its W3C code.
 *
 * Transcribed from parse_key in global-hotkey/src/hotkey.rs. Deliberately a
 * whitelist and not a regex: the F-keys stop at F24, the punctuation set is
 * fixed, and "IntlBackslash" or "F25" would sail through any pattern loose
 * enough to admit the rest.
 */
const SUPPORTED_CODES = new Set([
  // Letters, digits, numpad
  ...Array.from({ length: 26 }, (_, i) => `Key${String.fromCharCode(65 + i)}`),
  ...Array.from({ length: 10 }, (_, i) => `Digit${i}`),
  ...Array.from({ length: 10 }, (_, i) => `Numpad${i}`),
  ...Array.from({ length: 24 }, (_, i) => `F${i + 1}`),
  // Punctuation
  "Backquote",
  "Backslash",
  "BracketLeft",
  "BracketRight",
  "Comma",
  "Equal",
  "Minus",
  "Period",
  "Quote",
  "Semicolon",
  "Slash",
  // Editing and navigation
  "Backspace",
  "CapsLock",
  "Delete",
  "End",
  "Enter",
  "Home",
  "Insert",
  "PageDown",
  "PageUp",
  "Space",
  "Tab",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  // Locks and system
  "Escape",
  "NumLock",
  "Pause",
  "PrintScreen",
  "ScrollLock",
  // Numpad operators
  "NumpadAdd",
  "NumpadDecimal",
  "NumpadDivide",
  "NumpadEnter",
  "NumpadEqual",
  "NumpadMultiply",
  "NumpadSubtract",
]);

/**
 * Modifier order in a stored accelerator.
 *
 * Fixed so "Ctrl+Alt+F10" and "Alt+Ctrl+F10" cannot both end up in
 * settings.json meaning the same thing — two spellings would make the
 * conflict check below miss a real collision.
 */
const MODIFIER_ORDER = ["Ctrl", "Alt", "Shift", "Super"] as const;

/** Codes whose keycap label is not just the code with its prefix removed. */
const CODE_LABELS: Record<string, string> = {
  Backquote: "`",
  Backslash: "\\",
  BracketLeft: "[",
  BracketRight: "]",
  Comma: ",",
  Equal: "=",
  Minus: "-",
  Period: ".",
  Quote: "'",
  Semicolon: ";",
  Slash: "/",
  Escape: "Esc",
  Delete: "Del",
  Insert: "Ins",
  PageDown: "PgDn",
  PageUp: "PgUp",
  PrintScreen: "PrtSc",
  ScrollLock: "ScrLk",
  CapsLock: "Caps",
  NumLock: "NumLk",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  ArrowUp: "Up",
  NumpadAdd: "Num +",
  NumpadDecimal: "Num .",
  NumpadDivide: "Num /",
  NumpadEnter: "Num Enter",
  NumpadEqual: "Num =",
  NumpadMultiply: "Num *",
  NumpadSubtract: "Num -",
};

/** The keycap label for one accelerator token. */
function tokenLabel(token: string): string {
  if (CODE_LABELS[token]) return CODE_LABELS[token];
  if (/^Key[A-Z]$/.test(token)) return token.slice(3);
  if (/^Digit\d$/.test(token)) return token.slice(5);
  if (/^Numpad\d$/.test(token)) return `Num ${token.slice(6)}`;
  return token;
}

/** Which modifiers an event is holding, in MODIFIER_ORDER. */
function modifiersOf(e: Pick<KeyboardEvent, "ctrlKey" | "altKey" | "shiftKey" | "metaKey">) {
  const held = { Ctrl: e.ctrlKey, Alt: e.altKey, Shift: e.shiftKey, Super: e.metaKey };
  return MODIFIER_ORDER.filter((m) => held[m]);
}

/** True when this keydown is a modifier being held rather than the main key. */
export function isModifierEvent(e: Pick<KeyboardEvent, "code">): boolean {
  return MODIFIER_CODES.has(e.code);
}

/** True when this code can be the main key of a registerable shortcut. */
export function isSupportedShortcutCode(code: string): boolean {
  return SUPPORTED_CODES.has(code);
}

/**
 * The accelerator for a completed keypress, or null while the press is not
 * yet a shortcut — only modifiers down, or a main key the Rust side cannot
 * register.
 */
export function acceleratorFromEvent(
  e: Pick<KeyboardEvent, "code" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey">,
): string | null {
  if (isModifierEvent(e)) return null;
  if (!isSupportedShortcutCode(e.code)) return null;
  return [...modifiersOf(e), e.code].join("+");
}

/**
 * The keycap labels for a press in progress — modifiers alone before the main
 * key arrives, so the field can show "Shift" the moment Shift goes down and
 * "Shift" "F9" once F9 joins it.
 */
export function inProgressKeyLabels(
  e: Pick<KeyboardEvent, "code" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey">,
): string[] {
  const mods = modifiersOf(e);
  if (isModifierEvent(e) || !isSupportedShortcutCode(e.code)) return mods;
  return [...mods, tokenLabel(e.code)];
}

/** The keycap labels for a stored accelerator: "Alt+F11" → ["Alt", "F11"]. */
export function shortcutKeyLabels(accelerator: string): string[] {
  if (!accelerator) return [];
  return accelerator.split("+").map(tokenLabel);
}

/**
 * The name of the other binding `accelerator` collides with, or null.
 *
 * Two actions on one accelerator is not a state the app can honour: Windows
 * delivers a registered hotkey as a single WM_HOTKEY to the process, so the
 * second registration of the same combo either loses to the first or double-
 * fires it — and a toggle that runs twice per press lands back where it
 * started. Catching it here means the field can refuse the binding and say so,
 * rather than storing something that quietly does the wrong thing.
 *
 * `others` is keyed by the name shown to the user, so a caller that wants to
 * name the clash in a message has it. An empty `accelerator` never collides:
 * unbound is not a binding.
 */
export function findShortcutConflict(
  accelerator: string,
  others: Record<string, string>,
): string | null {
  if (!accelerator) return null;
  for (const [name, other] of Object.entries(others)) {
    if (other && other === accelerator) return name;
  }
  return null;
}
