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
    data.sensors.push({ name: "Memory Used", identifier: "/ram/data/0", hardwareIdentifier: "/ram", sensorType: 12, value: 9 });
    store.getState().setSensorData(data);
    store.getState().updateSensor("onePercentLow", { isEnabled: true });
    store.getState().updateSensor("zeroPointOnePercentLow", { isEnabled: true });
  });
  await page.evaluate(() => document.fonts.ready);
  const sample = async (large) => {
    await page.evaluate(async (large) => {
      const { useSettingsStore: store } = await import("/src/stores/settings-store.ts");
      const data = store.getState().sensorData;
      store.getState().setSensorData({ ...data, sensors: data.sensors.map(s => ({ ...s, value:
        s.sensorType === 14 ? (large ? 1_500_000 : 1000) :
        s.sensorType === 12 ? (large ? 10 : 9) :
        s.sensorType === 13 ? (large ? 10240 : 9216) :
        large ? 100 : 99,
      })) });
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, large);
    return page.locator("#root > div > div").evaluateAll(nodes => nodes.map(node => {
      const { x, y, width, height } = node.getBoundingClientRect();
      return { x, y, width, height };
    }));
  };
  for (const isHorizontal of [true, false]) for (const progressType of ["none", "circular", "bar"]) for (const fontSizeValue of [12, 18, 24]) {
    await page.evaluate(async settings => {
      const { useSettingsStore } = await import("/src/stores/settings-store.ts");
      useSettingsStore.getState().updateSettings(settings);
    }, { fixedPillSize: true, isHorizontal, progressType, fontSizeValue });
    const before = await sample(false);
    const after = await sample(true);
    assert.equal(before.length, 5, `${JSON.stringify({isHorizontal,progressType,fontSizeValue})}: ${await page.locator("#root").innerHTML()}`);
    assert.deepEqual(after, before, `Pills moved: ${JSON.stringify({ isHorizontal, progressType, fontSizeValue })}`);
  }
  await page.evaluate(async () => {
    const { useSettingsStore } = await import("/src/stores/settings-store.ts");
    useSettingsStore.getState().updateSettings({ fixedPillSize: false, isHorizontal: true });
  });
  const before = await sample(false);
  const after = await sample(true);
  assert.notDeepEqual(after, before, "The disabled option should retain content sizing");
  console.log("PASS: 18 font/orientation/gauge combinations stay fixed across digit and unit changes; disabled mode still resizes.");
} finally {
  await browser.close();
}
