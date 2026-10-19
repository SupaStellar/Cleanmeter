import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch();
const base = process.env.STORYBOOK_URL ?? 'http://127.0.0.1:6006';
try {
  for (const theme of ['light', 'dark']) for (const reducedMotion of ['no-preference', 'reduce']) {
    const page = await browser.newPage({ reducedMotion });
    const open = async id => {
      await page.goto(`${base}/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`);
      await page.locator('#storybook-root').waitFor();
    };
    await open('components-checkbox--with-label');
    const checkbox = page.getByRole('checkbox', {name:'Accept terms'});
    await checkbox.waitFor();
    assert.equal(await checkbox.getAttribute('data-slot'), 'checkbox');
    await page.getByText('Accept terms', {exact:true}).click();
    assert.equal(await checkbox.isChecked(), false, 'Label activates shared checkbox');
    await checkbox.press('Space');
    await page.waitForTimeout(400);
    assert.equal(await checkbox.locator('path').evaluate(el=>parseFloat(getComputedStyle(el).strokeDashoffset)), 0);

    await open('components-toggle--off');
    const toggle = page.getByRole('switch');
    await toggle.waitFor();
    assert.equal(await toggle.getAttribute('data-slot'), 'switch');
    const thumb = toggle.locator('[data-slot="switch-thumb"]');
    assert.equal(await thumb.evaluate(el=>el.getAnimations().length), 0);
    await toggle.press('Space');
    assert.equal(await thumb.evaluate(el=>getComputedStyle(el).animationName), reducedMotion === 'reduce' ? 'none' : 't-toggle-on');
    await page.waitForTimeout(400);
    assert.equal(await thumb.evaluate(el=>parseFloat(getComputedStyle(el).translate)), 16);

    await open('components-select--with-label');
    const trigger = page.getByRole('combobox');
    await trigger.press('Space');
    const menu = page.locator('[data-slot="select-content"]');
    await menu.waitFor();
    assert.equal(await menu.evaluate(el=>getComputedStyle(el).animationName), reducedMotion === 'reduce' ? 'none' : 'app-select-enter');
    await page.keyboard.press('Escape');
    await menu.waitFor({state:'detached'});
    await page.waitForFunction(()=>document.activeElement?.getAttribute('role') === 'combobox');

    await open('components-navigationtabs--default');
    const input = page.getByRole('textbox', {name:'Preserved input'});
    await input.fill('Keep this value');
    await page.locator('#panel-stats').evaluate(el=>{el.scrollTop=80;});
    for (const name of ['Style','Help','Settings','Stats']) {
      await page.getByRole('tab',{name, exact:true}).evaluate(el=>el.click());
      await page.waitForTimeout(20);
    }
    await page.waitForTimeout(300);
    assert.equal(await input.inputValue(), 'Keep this value');
    assert.equal(await page.locator('#panel-stats').evaluate(el=>el.scrollTop), 80);
    assert.equal(await page.getByRole('tabpanel').count(), 1);
    if (reducedMotion === 'reduce') assert.equal(await page.locator('#panel-stats').evaluate(el=>getComputedStyle(el).transitionDuration), '0s');
    console.log(`PASS Storybook shared components: ${theme}, ${reducedMotion}`);
    await page.close();
  }
} finally { await browser.close(); }
