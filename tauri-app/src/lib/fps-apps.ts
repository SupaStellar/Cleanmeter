/**
 * Sentinel for "no manual pick": the empty string cannot be a Radix Select
 * value, so Auto needs one of its own. `framerate.targetAppName` stores the
 * empty string for the same state, which is what the C# poller reads as
 * foreground-follow mode.
 */
export const AUTO_OPTION = "__auto__";

/**
 * Decide what the Monitor app dropdown shows.
 *
 * `apps` is not a list of installed applications. It is whatever PresentMon
 * saw presenting frames recently, so it is empty on a desktop with no game
 * running (DWM and the browsers are excluded from the capture), and it can
 * empty itself while the user is looking at Settings, because reaching
 * Settings means leaving the game.
 *
 * The dropdown used to be hidden whenever that list was empty. Auto went with
 * it, and so did any app the user had already picked, which left the one
 * control that could correct a stale selection unreachable exactly when the
 * selection was stale. Nothing here filters: the caller always renders the
 * Select, and this decides its contents.
 *
 * A picked app that is not currently presenting is carried as its own option
 * so the trigger states the truth rather than falling back to the Auto
 * placeholder. When it *is* presenting, the live spelling wins: PresentMon
 * reports the filesystem casing of the exe and the stored value may have been
 * saved from a differently-cased source, and Radix matches option values by
 * exact string.
 */
export function monitorAppOptions(input: { apps: string[]; target: string }): {
  /** Value for the Select, `AUTO_OPTION` when nothing is picked. */
  value: string;
  /** Options to render below Auto, in display order. */
  options: string[];
} {
  const { apps, target } = input;

  if (!target) return { value: AUTO_OPTION, options: apps };

  const live = apps.find((app) => app.toLowerCase() === target.toLowerCase());
  if (live) return { value: live, options: apps };

  return { value: target, options: [target, ...apps] };
}
