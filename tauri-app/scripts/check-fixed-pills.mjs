// Start npm run dev first, then: node scripts/check-fixed-pills.mjs http://localhost:1420
import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 2400, height: 1000 } });
  // Mount the real HUD alone, avoiding the preview's periodic fixture reset.
  await page.route("**/src/main.tsx*", async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(/import App from "\/src\/App\.tsx[^"]*";/, 'import { OverlayHud as App } from "/src/components/overlay/OverlayHud.tsx";');
    await route.fulfill({ response, body });
  });
  await page.goto(process.argv[2] ?? "http://localhost:1420");
  await page.locator("[data-pill=CPU]").waitFor();
  await page.waitForTimeout(1000);
  await page.evaluate(async () => {
    const { useSettingsStore: store } = await import("/src/stores/settings-store.ts");
    const { previewSensorData } = await import("/src/lib/preview-fixture.ts");
    const data = previewSensorData();
    // A 16 GB machine and a 16 GB card. The totals size the GB slots, so the
    // used readings below can cross 9.0 → 10.0 without leaving their slot.
    data.sensors.push(
      { name: "Memory Used", identifier: "/ram/data/0", hardwareIdentifier: "/ram", sensorType: 12, value: 9 },
      { name: "Memory Available", identifier: "/ram/data/1", hardwareIdentifier: "/ram", sensorType: 12, value: 7 },
    );
    data.sensors.find((s) => s.name === "GPU Memory Total").value = 16384;
    store.getState().setSensorData(data);
    store.getState().updateSensor("onePercentLow", { isEnabled: true });
    store.getState().updateSensor("zeroPointOnePercentLow", { isEnabled: true });
  });
  await page.evaluate(() => document.fonts.ready);
  // Four readings of the same machine, each one step wider than the last:
  //   0  quiet:   99 / 9 GB / 1000 B/s / 99 fps / 99.0 ms
  //   1  larger:  100 / 10 GB / 1.4 MB/s / 100 fps / 100.0 ms
  //   2  network at 1023.9 KB/s, the widest string before the unit changes
  //   3  the game's extremes on top: an uncapped 4321 fps menu, and the
  //      5000 ms frame the sidecar reports after a loading screen or an idle
  //      gap (it hands over the raw present-to-present interval), which must
  //      saturate at 999.9 ms. Every reading is at its widest string here.
  // Totals are constants on a real machine and stay put.
  const sample = async (step) => {
    await page.evaluate(async (step) => {
      const { useSettingsStore: store } = await import("/src/stores/settings-store.ts");
      const data = store.getState().sensorData;
      const value = (s) => {
        if (/memory (total|available)/i.test(s.name)) return s.value;
        if (s.identifier === "/presentmon/frametime") return step === 3 ? 5000 : step ? 100 : 99;
        if (s.identifier.startsWith("/presentmon/")) return step === 3 ? 4321 : step ? 100 : 99;
        if (s.sensorType === 14) return step >= 2 ? 1_048_473 : step ? 1_500_000 : 1000;
        if (s.sensorType === 12) return step ? 10 : 9;
        if (s.sensorType === 13) return step ? 10240 : 9216;
        return step ? 100 : 99;
      };
      store.getState().setSensorData({ ...data, sensors: data.sensors.map(s => ({ ...s, value: value(s) })) });
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, step);
    return page.locator("#root > div > div").evaluateAll(nodes => nodes.map(node => {
      const { x, y, width, height } = node.getBoundingClientRect();
      return { x, y, width, height };
    }));
  };
  // Slot width minus what it holds. With every reading at its widest string a
  // value slot must be exactly its text; a unit slot must be exactly its widest
  // unit ("MB/s" over "KB/s", "GB" over "%"). Anything past a pixel is padding.
  const slack = () => page.evaluate(() => {
    const width = (node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return range.getBoundingClientRect().width;
    };
    const measure = (selector, widest) => [...document.querySelectorAll(selector)].map((slot) => {
      const text = slot.querySelector("[data-metric-text]") ?? slot;
      return { text: text.textContent, slack: slot.getBoundingClientRect().width - widest(slot, text) };
    });
    return [
      ...measure("[data-metric-value]", (_slot, text) => width(text)),
      ...measure("[data-metric-unit]", (slot, text) => Math.max(width(text), ...[...slot.querySelectorAll("[data-metric-reserve]")].map(width))),
    ].filter((s) => Math.abs(s.slack) > 1);
  });
  const texts = () => page.locator("[data-metric-value] [data-metric-text]").allTextContents();
  for (const isHorizontal of [true, false]) for (const progressType of ["none", "circular", "bar"]) for (const fontSizeValue of [12, 18, 24]) {
    await page.evaluate(async settings => {
      const { useSettingsStore } = await import("/src/stores/settings-store.ts");
      useSettingsStore.getState().updateSettings(settings);
    }, { fixedPillSize: true, isHorizontal, progressType, fontSizeValue });
    const combo = JSON.stringify({ isHorizontal, progressType, fontSizeValue });
    const quiet = await sample(0);
    const larger = await sample(1);
    const boundary = await sample(2);
    const extreme = await sample(3);
    assert.equal(quiet.length, 5, `${combo}: ${await page.locator("#root").innerHTML()}`);
    assert.deepEqual(larger, quiet, `Pills moved on a digit change: ${combo}`);
    assert.deepEqual(boundary, quiet, `Network unit boundary must not resize pills: ${combo}`);
    assert.deepEqual(extreme, quiet, `Four-digit fps and a multi-second frame must not resize pills: ${combo}`);
    const shown = await texts();
    assert.ok(shown.includes("999.9 ms"), `A 5000 ms frame must read 999.9 ms, got ${JSON.stringify(shown)}`);
    assert.ok(shown.includes("4321"), `An uncapped menu must read its fps in full, got ${JSON.stringify(shown)}`);
    assert.deepEqual(await slack(), [], `Slots must be exactly as wide as their widest reading: ${combo}`);
  }
  await page.evaluate(async () => {
    const { useSettingsStore } = await import("/src/stores/settings-store.ts");
    useSettingsStore.getState().updateSettings({ fixedPillSize: false, isHorizontal: true });
  });
  const quiet = await sample(0);
  const larger = await sample(1);
  assert.notDeepEqual(larger, quiet, "The disabled option should retain content sizing");
  console.log("PASS: 18 font/orientation/gauge combinations stay fixed across digit changes, unit changes, four-digit fps and saturated frametimes, with no slack; disabled mode still resizes.");
} finally {
  await browser.close();
}
