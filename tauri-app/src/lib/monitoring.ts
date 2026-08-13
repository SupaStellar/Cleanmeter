import type { SidecarStatus } from "./types";

/**
 * How long a launch may go without a reading before we call it broken.
 *
 * The old rule was 8 seconds of wall clock, which is not evidence of anything:
 * no reading can exist until the sidecar finishes enumerating hardware, and
 * across 114 logged launches that alone took a median of 1.55s and as much as
 * 13.7s, with the slowest run reaching 19.67s before the app was even
 * connected. 36 of 113 launches were still starting normally when the 8s
 * deadline fired, so a third of the time the app called itself broken while
 * working. At logon, where the disk is busiest, it happened almost every time.
 *
 * This is deliberately far past the slowest thing we have measured. It is the
 * backstop for a sidecar that runs but never speaks; a sidecar that fails
 * outright is reported by the evidence below instead, and immediately.
 *
 * Must stay shorter than FAST_POLL_WINDOW in src-tauri/src/pipe_client.rs, the
 * window in which the backend still polls for the sidecar rapidly. This timer
 * starts later than that one (on webview mount rather than on app start), so if
 * it outlived the window the UI would report a failure while the backend had
 * already dropped to its slow retry.
 */
export const STARTUP_GRACE_MS = 45_000;

/**
 * Sidecar exits before we stop treating a launch as a slow start.
 *
 * Any exit is a real crash: the sidecar cannot exit from a pipe conflict, since
 * two instances can serve the same pipe name and its accept loop retries every
 * error (PipeHost.cs). One is still tolerated because a crash that recovers is
 * invisible anyway, as the first reading resolves the verdict before this
 * matters; two says it is not settling.
 */
export const CRASH_LOOP_EXITS = 2;

export type MonitoringVerdict = "ok" | "starting" | "failed";

/**
 * Decide whether monitoring is working, still coming up, or actually broken.
 *
 * Split out of the banner component so the rule is testable on its own, and so
 * the answer is driven by what the supervisor observed rather than by a timer.
 */
export function monitoringVerdict(input: {
  hasSensorData: boolean;
  sidecar: SidecarStatus;
  graceExpired: boolean;
}): MonitoringVerdict {
  // A reading settles it, whatever happened on the way here.
  if (input.hasSensorData) return "ok";
  // Evidence of real failure, worth saying so without waiting.
  if (input.sidecar.spawnError) return "failed";
  if (input.sidecar.exits >= CRASH_LOOP_EXITS) return "failed";
  // Nothing is wrong that we can see, so it is still starting until the
  // backstop expires.
  if (input.graceExpired) return "failed";
  return "starting";
}
