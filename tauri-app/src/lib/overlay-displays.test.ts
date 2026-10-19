import { afterEach, describe, expect, it, vi } from "vitest";
import { watchOverlayDisplays } from "./overlay-displays";
import type { MonitorInfo } from "./types";

const display: MonitorInfo = { name: "Display", x: 0, y: 0, width: 1920, height: 1080, primary: true };
afterEach(() => vi.useRealTimers());

describe("overlay display refresh", () => {
  it("recovers from empty boot enumeration and reapplies changed geometry only", async () => {
    vi.useFakeTimers();
    const read = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([display])
      .mockResolvedValueOnce([{ ...display }])
      .mockResolvedValue([{ ...display, width: 2560, x: -2560 }]);
    const changed = vi.fn();
    const stop = watchOverlayDisplays(read, changed);
    await vi.advanceTimersByTimeAsync(0);
    expect(changed).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(4000);
    expect(changed).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(changed).toHaveBeenLastCalledWith([{ ...display, width: 2560, x: -2560 }]);
    stop();
    await vi.advanceTimersByTimeAsync(4000);
    expect(read).toHaveBeenCalledTimes(4);
  });

  it("retains geometry on failures and ignores a response after unmount", async () => {
    vi.useFakeTimers();
    let resolve!: (value: MonitorInfo[]) => void;
    const read = vi.fn().mockResolvedValueOnce([display])
      .mockRejectedValueOnce(new Error("display unavailable"))
      .mockImplementation(() => new Promise<MonitorInfo[]>(r => { resolve = r; }));
    const changed = vi.fn();
    const stop = watchOverlayDisplays(read, changed);
    await vi.advanceTimersByTimeAsync(8000);
    expect(read).toHaveBeenCalledTimes(3); // no overlapping requests
    expect(changed).toHaveBeenCalledTimes(1);
    stop();
    resolve([{ ...display, width: 2560 }]);
    await vi.advanceTimersByTimeAsync(0);
    expect(changed).toHaveBeenCalledTimes(1);
  });
});
