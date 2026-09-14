import { formatValue } from "./utils";

/**
 * The widest string each overlay reading can show. With fixed pill size on, a
 * MetricValue reserves exactly this width in the reading's own font, so a pill
 * holds its size as digits change and grows no wider than its widest reading.
 * A reading that ever passes its reserve widens the pill; nothing is clipped.
 */
export const Reserve = {
  /** 0–100 %, 100 °C or 212 °F, sub-kilowatt power. */
  threeDigits: "000",
  /** Average and percentile-low fps. Uncapped menus run at thousands of fps
   *  (the sidecar's FrameLowsWindow is sized for 4,000), and the lows follow. */
  fps: "0000",
  /** Last frametime, shown through formatFrametime, which saturates below 1 s. */
  frametime: "000.0 ms",
  /** formatNetworkRateParts climbs to 1023.9 before it changes unit. */
  netRate: "0000.0",
  netUnit: "MB/s",
  /** RAM and VRAM read "%" until their GB reading arrives. */
  gigabyteUnit: "GB",
} as const;

/**
 * Reserve for a used-GB reading: as many integer digits as the total has when
 * shown to one decimal (a 16 GB machine → "00.0", 128 GB → "000.0"), so the
 * slot is stable for the life of the process. Unknown total → two digits.
 *
 * Never narrower than "000": until the GB reading arrives the same slot shows
 * the load in %, and "100" is wider than the "0.0" a 4 GB card would reserve.
 */
export function gigabyteReserve(totalGB: number): string {
  const shown = Number(formatValue(totalGB, 1));
  const digits = shown > 0 ? String(Math.floor(shown)).length : 2;
  return digits < 2 ? Reserve.threeDigits : "0".repeat(digits) + ".0";
}

/**
 * The sidecar reports the raw present-to-present interval, so the first frame
 * after a loading screen, a pause or an idle desktop app carries the whole gap
 * (1500 ms and up, since it zeroes the reading after 1.5 s without frames).
 * Anything from 1 s up is "under 1 fps", not a frametime, and the sidecar's
 * own percentile lows clamp at 1000 ms for the same reason (FrameLows
 * .MaxFrametimeMs). Saturate here so the reading never outgrows its reserve.
 */
export const MAX_FRAMETIME_MS = 999.9;

export function formatFrametime(ms: number): string {
  return `${formatValue(Math.min(ms, MAX_FRAMETIME_MS), 1)} ms`;
}
