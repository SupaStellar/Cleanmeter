import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch();
try {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const page = await browser.newPage({ reducedMotion, viewport: { width: 800, height: 1000 } });
    await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:1420/');
    await page.getByRole('tab', {name:'Settings', exact:true}).click();
    const checkbox = page.getByRole('checkbox', {name:'Start minimized', exact:true});
    await checkbox.waitFor();
    const draw = checkbox.locator('.app-checkbox-draw');
    assert.equal(await draw.evaluate(el=>el.getAnimations().length), 0, 'No startup draw');
    if (await checkbox.isChecked()) await checkbox.click();
    await page.waitForTimeout(400);
    await checkbox.focus();
    await page.keyboard.press('Space');
    const during = await draw.evaluate(el=>({offset:parseFloat(getComputedStyle(el).strokeDashoffset), animations:el.getAnimations().length}));
    if (reducedMotion === 'reduce') {
      assert.equal(during.offset, 0);
      assert.equal(during.animations, 0);
    } else {
      assert.ok(during.offset > 0 && during.offset <= 15, 'Checking draws progressively');
      assert.ok(during.animations > 0);
    }
    await page.waitForTimeout(400);
    assert.equal(await draw.evaluate(el=>parseFloat(getComputedStyle(el).strokeDashoffset)), 0);
    for (let i=0; i<11; i++) await page.keyboard.press('Space');
    await page.waitForTimeout(400);
    assert.equal(await checkbox.isChecked(), false);
    assert.equal(await draw.evaluate(el=>parseFloat(getComputedStyle(el).strokeDashoffset)), 15);
    assert.equal(await checkbox.locator('.app-checkbox-indicator').evaluate(el=>getComputedStyle(el).opacity), '1', 'No checkmark opacity fade');
    await checkbox.click();
    await page.waitForTimeout(400);
    const length = await draw.evaluate(el=>el.getTotalLength());
    assert.equal(Math.ceil(length), 15, 'Dash length calibrated to reference path');
    await page.screenshot({path:`test-results/checkbox-${reducedMotion}.png`});
    console.log(`PASS checkbox: ${reducedMotion}; progressive stroke draw, rapid reversal, keyboard, no opacity fade`);
    await page.close();
  }
} finally { await browser.close(); }

