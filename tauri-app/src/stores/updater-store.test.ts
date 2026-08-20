import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// lib/tauri reads `window` at import time, which does not exist in the node
// test project, and every action here crosses it. checkForUpdate is the only
// mock a test asserts through; the rest just need to resolve.
const checkForUpdate = vi.fn();
const prepareForUpdate = vi.fn(async () => {});
const relaunchApp = vi.fn(async () => {});

vi.mock("@/lib/tauri", () => ({
  isBrowser: true,
  checkForUpdate: (...args: unknown[]) => checkForUpdate(...args),
  prepareForUpdate: () => prepareForUpdate(),
  relaunchApp: () => relaunchApp(),
}));

/**
 * The store keeps the pending Update in module scope, so every test gets a
 * fresh module rather than trying to unwind that from the outside.
 */
async function freshStore() {
  vi.resetModules();
  const { useUpdaterStore } = await import("./updater-store");
  return useUpdaterStore;
}

type DownloadEvents = (event: unknown) => void;

/** An Update with only the two methods the store calls. */
function fakeUpdate(opts: { install?: () => Promise<void>; download?: (onEvent?: DownloadEvents) => Promise<void> } = {}) {
  return {
    version: "9.9.9",
    download:
      opts.download ??
      (async (onEvent?: DownloadEvents) => {
        onEvent?.({ event: "Started", data: { contentLength: 100 } });
        onEvent?.({ event: "Progress", data: { chunkLength: 50 } });
        onEvent?.({ event: "Finished" });
      }),
    install: opts.install ?? (async () => {}),
  };
}

let errorLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  checkForUpdate.mockReset();
  prepareForUpdate.mockClear();
  relaunchApp.mockClear();
  // The failure paths log on purpose; keep the test output readable.
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorLog.mockRestore();
});

describe("check", () => {
  it("offers an update it finds, and clears a previous dismissal", async () => {
    const store = await freshStore();
    checkForUpdate.mockResolvedValue(fakeUpdate());
    store.setState({ dismissed: true });

    await store.getState().check({ silent: true });

    expect(store.getState().status).toBe("available");
    expect(store.getState().availableVersion).toBe("9.9.9");
    expect(store.getState().dismissed).toBe(false);
  });

  it("stays quiet on a silent check with nothing to offer, and speaks up on a manual one", async () => {
    const silent = await freshStore();
    checkForUpdate.mockResolvedValue(null);
    await silent.getState().check({ silent: true });
    expect(silent.getState().status).toBe("idle");

    const manual = await freshStore();
    checkForUpdate.mockResolvedValue(null);
    await manual.getState().check();
    expect(manual.getState().status).toBe("uptodate");
  });

  it("re-surfaces a downloaded update instead of checking again", async () => {
    const store = await freshStore();
    checkForUpdate.mockResolvedValue(fakeUpdate());
    await store.getState().check({ silent: true });
    await store.getState().download();
    expect(store.getState().status).toBe("ready");

    store.getState().dismiss();
    checkForUpdate.mockClear();
    await store.getState().check();

    // The pill comes back on the update already in hand: no second check, and
    // the downloaded state is not thrown away.
    expect(checkForUpdate).not.toHaveBeenCalled();
    expect(store.getState().status).toBe("ready");
    expect(store.getState().dismissed).toBe(false);
  });
});

describe("download", () => {
  it("tracks progress and lands on ready", async () => {
    const store = await freshStore();
    checkForUpdate.mockResolvedValue(fakeUpdate());
    await store.getState().check({ silent: true });

    await store.getState().download();

    expect(store.getState().status).toBe("ready");
    expect(store.getState().progress).toBe(100);
  });

  it("reports an unknown total as -1 while it runs, then 100 once it finishes", async () => {
    const store = await freshStore();
    let finish: () => void = () => {};
    const settled = new Promise<void>((resolve) => {
      finish = resolve;
    });
    checkForUpdate.mockResolvedValue(
      fakeUpdate({
        download: async (onEvent) => {
          onEvent?.({ event: "Started", data: { contentLength: null } });
          await settled;
        },
      }),
    );
    await store.getState().check({ silent: true });
    const inFlight = store.getState().download();

    // -1 is the "no total to divide by" marker the pill spins on. It only
    // means anything mid-download.
    expect(store.getState().progress).toBe(-1);

    finish();
    await inFlight;
    expect(store.getState().progress).toBe(100);
  });

  it("returns to the offer when the download fails, keeping the pill on screen", async () => {
    const store = await freshStore();
    checkForUpdate.mockResolvedValue(
      fakeUpdate({
        download: async () => {
          throw new Error("connection reset");
        },
      }),
    );
    await store.getState().check({ silent: true });
    await store.getState().download();

    // Not "error": that status is not one the pill renders, so it would take
    // the pill off screen and strand the user.
    expect(store.getState().status).toBe("available");
    expect(store.getState().progress).toBe(0);
    expect(store.getState().error).toBe("connection reset");
  });
});

describe("cancel", () => {
  it("orphans the run in flight, so its late finish cannot move the status", async () => {
    const store = await freshStore();
    let finish: () => void = () => {};
    const settled = new Promise<void>((resolve) => {
      finish = resolve;
    });
    checkForUpdate.mockResolvedValue(
      fakeUpdate({
        download: async (onEvent) => {
          onEvent?.({ event: "Started", data: { contentLength: 100 } });
          await settled;
        },
      }),
    );
    await store.getState().check({ silent: true });

    const inFlight = store.getState().download();
    expect(store.getState().status).toBe("downloading");

    store.getState().cancel();
    expect(store.getState().status).toBe("available");
    expect(store.getState().progress).toBe(0);

    finish();
    await inFlight;

    // The abandoned run resolved after the cancel and must not claim "ready".
    expect(store.getState().status).toBe("available");
  });

  it("ignores progress from an abandoned run", async () => {
    const store = await freshStore();
    let emit: DownloadEvents = () => {};
    let finish: () => void = () => {};
    const settled = new Promise<void>((resolve) => {
      finish = resolve;
    });
    checkForUpdate.mockResolvedValue(
      fakeUpdate({
        download: async (onEvent) => {
          emit = onEvent ?? (() => {});
          emit({ event: "Started", data: { contentLength: 100 } });
          await settled;
        },
      }),
    );
    await store.getState().check({ silent: true });
    const inFlight = store.getState().download();

    store.getState().cancel();
    emit({ event: "Progress", data: { chunkLength: 50 } });

    expect(store.getState().progress).toBe(0);
    finish();
    await inFlight;
  });
});

describe("install", () => {
  it("stops the sidecar before installing, then relaunches", async () => {
    const store = await freshStore();
    checkForUpdate.mockResolvedValue(fakeUpdate());
    await store.getState().check({ silent: true });
    await store.getState().download();

    await store.getState().install();

    expect(prepareForUpdate).toHaveBeenCalledTimes(1);
    expect(relaunchApp).toHaveBeenCalledTimes(1);
    expect(store.getState().status).toBe("installing");
  });

  it("does not stop the sidecar while only downloading", async () => {
    const store = await freshStore();
    checkForUpdate.mockResolvedValue(fakeUpdate());
    await store.getState().check({ silent: true });
    await store.getState().download();

    expect(prepareForUpdate).not.toHaveBeenCalled();
  });

  it("returns to ready when the install fails, so the downloaded update stays offered", async () => {
    const store = await freshStore();
    checkForUpdate.mockResolvedValue(
      fakeUpdate({
        install: async () => {
          throw new Error("installer busy");
        },
      }),
    );
    await store.getState().check({ silent: true });
    await store.getState().download();
    await store.getState().install();

    expect(store.getState().status).toBe("ready");
    expect(store.getState().error).toBe("installer busy");
    expect(relaunchApp).not.toHaveBeenCalled();
  });
});
