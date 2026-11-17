import { afterEach, describe, expect, it, vi } from "vitest";
import { watchOverlayDisplays } from "./overlay-displays";
import type { MonitorInfo } from "./types";

const display: MonitorInfo = { name: "Display", x: 0, y: 0, width: 1920, height: 1080, primary: true };
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

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

  it("stops background polling and re-arms on resize, DPI, and visibility changes", async () => {
    vi.useFakeTimers();
    const viewport = Object.assign(new EventTarget(), {
      document: new EventTarget(),
      devicePixelRatio: 1,
      matchMedia: vi.fn(() => new EventTarget()),
    });
    vi.stubGlobal("window", viewport);

    const read = vi.fn().mockResolvedValue([display]);
    const changed = vi.fn();
    const stop = watchOverlayDisplays(read, changed);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(read).toHaveBeenCalledTimes(31);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(read).toHaveBeenCalledTimes(31);

    const resize = new Event("resize");
    viewport.dispatchEvent(resize);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(read).toHaveBeenCalledTimes(33);

    const firstDpiQuery = viewport.matchMedia.mock.results[0].value;
    viewport.devicePixelRatio = 1.5;
    firstDpiQuery.dispatchEvent(new Event("change"));
    expect(viewport.matchMedia).toHaveBeenLastCalledWith("(resolution: 1.5dppx)");
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(34);

    viewport.document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(35);
    expect(changed).toHaveBeenCalledTimes(1);

    stop();
    viewport.dispatchEvent(resize);
    viewport.document.dispatchEvent(new Event("visibilitychange"));
    viewport.matchMedia.mock.results[1].value.dispatchEvent(new Event("change"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(read).toHaveBeenCalledTimes(35);
  });
});
