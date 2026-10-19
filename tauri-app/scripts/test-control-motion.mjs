// Run against the actual app: npm run dev, then node scripts/test-control-motion.mjs.
import { chromium } from "playwright";
import assert from "node:assert/strict";

const browser = await chromium.launch();
try {
  for (const reducedMotion of ["no-preference", "reduce"]) {
    const page = await browser.newPage({ reducedMotion, viewport: { width: 800, height: 1000 } });
    await page.goto(process.env.APP_URL ?? "http://127.0.0.1:1420/");
    const cpu = page.getByRole("switch", { name: "CPU", exact: true });
    await cpu.waitFor();
    const thumb = cpu.locator('[data-slot="switch-thumb"]');
    assert.equal(await thumb.evaluate(el => el.getAnimations().length), 0, "No entrance toggle on hydration");
    const initial = await cpu.getAttribute("aria-checked");
    assert.equal(await page.getByRole("tabpanel").count(), 1, "Only the active panel is accessible");
    await page.locator('#panel-stats').evaluate(el => { el.scrollTop = 120; });
    const savedScroll = await page.locator('#panel-stats').evaluate(el => el.scrollTop);
    await cpu.focus();
    for (let i = 0; i < 11; i++) await page.keyboard.press("Space");
    await page.waitForTimeout(400);
    assert.notEqual(await cpu.getAttribute("aria-checked"), initial);
    const checked = await cpu.getAttribute("aria-checked") === "true";
    assert.equal(await thumb.evaluate(el => getComputedStyle(el).translate), checked ? "16px" : "0px");
    assert.equal(await thumb.evaluate(el => getComputedStyle(el).animationDuration), reducedMotion === "reduce" ? "0s" : "0.35s");
    if (reducedMotion === "no-preference") {
      if (!checked) await cpu.click();
      await page.waitForTimeout(400);
      assert.equal(await thumb.evaluate(el => el.style.getPropertyValue('--toggle-from')), '', 'Finished interaction must not leave a stale animation origin');
      await page.evaluate(async () => {
        const { useSettingsStore } = await import('/src/stores/settings-store.ts');
        for (const key of Object.keys(useSettingsStore.getState().settings.sensors).filter(key => key.startsWith('cpu'))) {
          useSettingsStore.getState().updateSensor(key, { isEnabled: false });
        }
      });
      await page.waitForTimeout(400);
      assert.equal(await cpu.getAttribute('aria-checked'), 'false');
      assert.equal(await thumb.evaluate(el => getComputedStyle(el).translate), '0px');
    }
    await page.locator('#panel-stats').evaluate((el, top) => { el.scrollTop = top; }, savedScroll);

    for (const name of ["Help", "Style", "Stats", "Settings"]) {
      // DOM clicks deliberately interrupt the transition without Playwright's stability wait.
      await page.getByRole("tab", { name, exact: true }).evaluate(el => el.click());
      await page.waitForTimeout(25);
    }
    await page.waitForTimeout(300);
    assert.equal(await page.getByRole("tab", { name: "Settings", exact: true }).getAttribute("aria-selected"), "true");
    const indicator = page.locator('.app-tab-indicator');
    const position = await indicator.evaluate(el => ({ x: new DOMMatrix(getComputedStyle(el).transform).m41, width: el.getBoundingClientRect().width }));
    assert.ok(Math.abs(position.x - position.width * 2) < 1, "Rapid tab changes settle at latest tab");
    assert.equal(await indicator.evaluate(el => getComputedStyle(el).transitionDuration), reducedMotion === "reduce" ? "0s" : "0.25s");
    const panels = await page.locator('.app-tab-panel').evaluateAll(elements => elements.map(el => ({
      active: el.dataset.active === 'true', inert: el.inert,
      opacity: getComputedStyle(el).opacity, visibility: getComputedStyle(el).visibility,
      x: new DOMMatrix(getComputedStyle(el).transform).m41,
      duration: getComputedStyle(el).transitionDuration,
    })));
    assert.equal(panels.filter(p => p.active).length, 1);
    for (const panel of panels) {
      assert.equal(panel.inert, !panel.active);
      assert.equal(panel.opacity, panel.active ? '1' : '0');
      assert.equal(panel.visibility, panel.active ? 'visible' : 'hidden');
      assert.equal(Math.abs(panel.x), panel.active ? 0 : 8);
      if (reducedMotion === 'reduce') assert.equal(panel.duration, '0s');
    }

    const pixel = page.getByRole("switch", { name: "Pixel Shift", exact: true });
    if (await pixel.getAttribute("aria-checked") !== "true") await pixel.click();
    const trigger = page.getByRole("combobox", { name: "Shift by", exact: true });
    await trigger.focus();
    await page.keyboard.press("Space");
    const menu = page.locator('[data-slot="select-content"]');
    await menu.waitFor();
    assert.equal(await menu.evaluate(el => getComputedStyle(el).animationName), reducedMotion === "reduce" ? "none" : "app-select-enter");
    await page.waitForTimeout(300);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await menu.waitFor({ state: "detached" });
    await page.waitForFunction(() => document.activeElement?.getAttribute("aria-labelledby") === "pixelShiftDistance-label");
    assert.equal(await trigger.evaluate(el => el === document.activeElement), true, "Selection restores trigger focus");
    await page.keyboard.press("Space");
    await menu.waitFor();
    await page.keyboard.press("Escape");
    await menu.waitFor({ state: "detached" });
    await page.waitForFunction(() => document.activeElement?.getAttribute("aria-labelledby") === "pixelShiftDistance-label");
    assert.equal(await trigger.evaluate(el => el === document.activeElement), true, "Escape restores trigger focus");
    await page.getByRole("tab", { name: "Stats", exact: true }).focus();
    await page.keyboard.press("Enter");
    assert.equal(await cpu.getAttribute("aria-checked"), String(checked), "Tab switches preserve state");
    assert.equal(await page.locator('#panel-stats').evaluate(el => el.scrollTop), savedScroll, "Tab switches preserve per-panel scroll position");
    console.log(`PASS app controls: ${reducedMotion}; rapid toggles/tabs, final positions, keyboard selection/Escape, focus and preserved state`);
    await page.close();
  }
} finally {
  await browser.close();
}
