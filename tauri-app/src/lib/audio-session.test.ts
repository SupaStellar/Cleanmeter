import { afterEach, describe, expect, it, vi } from "vitest";
import { createAudioSession, installAudioReadiness } from "./audio-session";

function output() {
  const gain = { gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
  const source = { frequency: { value: 0 }, connect: vi.fn(() => gain), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn() };
  const context = { state: "running", currentTime: 0, destination: {}, createOscillator: () => source, createGain: () => gain,
    resume: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined) };
  return { source, gain, context, create: vi.fn(() => context as unknown as AudioContext) };
}

afterEach(() => vi.unstubAllGlobals());

describe("Windows audio session readiness", () => {
  it("reuses one session and releases every node and context when stopped", () => {
    const device = output();
    const session = createAudioSession(device.create);
    session.setActive(false);
    expect(device.create).not.toHaveBeenCalled();
    session.setActive(true);
    session.setActive(true);
    expect(device.create).toHaveBeenCalledTimes(1);
    expect(device.source.frequency.value).toBe(20);
    expect(device.gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.0005, 0.05);
    session.setActive(false);
    session.stop();
    expect(device.source.stop).toHaveBeenCalledTimes(1);
    expect(device.source.disconnect).toHaveBeenCalledTimes(1);
    expect(device.gain.disconnect).toHaveBeenCalledTimes(1);
    expect(device.context.close).toHaveBeenCalledTimes(1);
  });

  it("contains missing audio devices and failed resume without blocking the app", async () => {
    const broken = createAudioSession(() => { throw new Error("No output"); });
    expect(() => broken.setActive(true)).not.toThrow();
    const device = output();
    device.context.resume.mockRejectedValue(new Error("Autoplay denied"));
    const session = createAudioSession(device.create);
    session.setActive(true);
    await Promise.resolve();
    session.stop();
    expect(device.context.close).toHaveBeenCalledTimes(1);
  });

  it("stops on mute, blur, hide and disposal, and resumes only when eligible", () => {
    const device = output();
    const win = Object.assign(new EventTarget(), { __TAURI_INTERNALS__: {}, location: { pathname: "/" } });
    let focused = true;
    const doc = Object.assign(new EventTarget(), { visibilityState: "visible", hasFocus: () => focused });
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", doc);
    vi.stubGlobal("navigator", { userAgent: "Windows" });
    vi.stubGlobal("AudioContext", function () { return device.context; });
    let enabled = false;
    const readiness = installAudioReadiness(() => enabled);
    expect(device.source.start).not.toHaveBeenCalled();
    enabled = true;
    readiness.sync();
    expect(device.source.start).toHaveBeenCalledTimes(1);
    enabled = false;
    readiness.sync();
    expect(device.context.close).toHaveBeenCalledTimes(1);
    enabled = true;
    focused = false;
    readiness.sync();
    expect(device.source.start).toHaveBeenCalledTimes(1);
    focused = true;
    win.dispatchEvent(new Event("focus"));
    win.dispatchEvent(new Event("blur"));
    expect(device.context.close).toHaveBeenCalledTimes(2);
    win.dispatchEvent(new Event("focus"));
    doc.visibilityState = "hidden";
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(device.context.close).toHaveBeenCalledTimes(3);
    doc.visibilityState = "visible";
    doc.dispatchEvent(new Event("visibilitychange"));
    readiness.dispose();
    expect(device.context.close).toHaveBeenCalledTimes(4);
    win.dispatchEvent(new Event("focus"));
    expect(device.source.start).toHaveBeenCalledTimes(4);
  });
});
