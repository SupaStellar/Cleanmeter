import { create } from "zustand";

/**
 * The one transient message the settings window can show, Figma 2819:9753.
 *
 * A store rather than props because of where the two ends live: the message is
 * raised inside a ShortcutField, buried in a card inside a tab, and the toast
 * renders against the window frame in App.tsx so it can sit centred over the
 * whole window. Threading a callback through SectionCard and every tab to
 * connect those two would touch a dozen components that have nothing to do
 * with it.
 *
 * Single-slot on purpose: there is exactly one toast in the frame and one
 * situation that raises it. A queue would be inventing a design.
 */
interface ToastStore {
  message: string | null;
  /**
   * Bumped on every show, including a show of the same message.
   *
   * The toast's dismiss timer keys off this rather than off `message`, so
   * refusing the same combo twice restarts the countdown instead of letting
   * the first toast's timer close the second one early. Without it, pressing
   * an already-bound combo, then pressing it again a beat later, would flash
   * the toast away almost immediately the second time.
   */
  token: number;
  showToast: (message: string) => void;
  /** Clear the slot once the toast has finished animating out. */
  clearToast: () => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  message: null,
  token: 0,
  showToast: (message) => set((s) => ({ message, token: s.token + 1 })),
  clearToast: () => set({ message: null }),
}));
