import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch();
const sent = [];
const failures = [];
let rejectNext = false;
try {
  const page = await browser.newPage({ viewport: { width: 651, height: 900 } });
  page.on('pageerror', error => failures.push(error.message));
  await page.exposeFunction('__feedbackSend', async input => {
    sent.push(input);
    if (rejectNext) { rejectNext = false; throw new Error('Temporary submission failure'); }
    if (process.env.FEEDBACK_PORTAL_URL) {
      const fields = { name: input.name, message: input.message, app_version: '2.2.18', os: 'windows' };
      if (input.email) fields.email = input.email;
      if (input.includeDiagnostics) {
        fields.diagnostics_summary = 'Local email integration check';
        fields.diagnostics = { name: 'cleanmeter-diagnostics.txt', mimeType: 'text/plain', buffer: Buffer.from('Local integration diagnostics\n') };
      }
      const response = await page.request.post(`${process.env.FEEDBACK_PORTAL_URL}/api/feedback`, {
        headers: { 'x-feedback-key': process.env.FEEDBACK_TEST_KEY ?? 'local-email-test-key' },
        multipart: fields,
      });
      assert.equal(response.status(), 201, await response.text());
    }
  });
  await page.route('**/src/lib/tauri.ts*', async route => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = 'export const submitFeedback = (input) => {';
    assert.ok(source.includes(marker), 'Intercept only the desktop transport boundary');
    await route.fulfill({ response, body: source.replace(marker, `${marker} return window.__feedbackSend(input);`) });
  });
  await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:1433/');
  const open = async () => {
    await page.getByRole('tab', { name: 'Help', exact: true }).click();
    await page.getByRole('button', { name: 'Give feedback', exact: true }).click();
  };
  await open();
  const email = page.getByRole('textbox', { name: 'Email (optional)', exact: true });
  const message = page.getByRole('textbox', { name: 'Message', exact: true });
  const submit = page.getByRole('button', { name: 'Submit', exact: true });
  await email.waitFor({ timeout: 5000 });
  await message.fill('Anonymous email test');
  await submit.click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(sent.at(-1).email, undefined, 'Blank email stays optional');
  await open();
  await email.fill('invalid');
  await email.blur();
  await message.fill('Contact email integration test');
  assert.equal(await email.getAttribute('aria-invalid'), 'true');
  assert.equal(await submit.isDisabled(), true);
  const count = sent.length;
  await email.fill('reply@example.com');
  rejectNext = true;
  await submit.click();
  await page.getByRole('alert').filter({ hasText: 'Temporary submission failure' }).waitFor();
  assert.equal(await email.inputValue(), 'reply@example.com');
  assert.equal(await message.inputValue(), 'Contact email integration test');
  assert.equal(sent.length, count + 1);
  await page.getByRole('checkbox', { name: 'Include system specs and app logs' }).check();
  await submit.click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(sent.at(-1).email, 'reply@example.com');
  assert.equal(sent.at(-1).includeDiagnostics, true);
  await open();
  assert.equal(await email.inputValue(), '');
  assert.equal(await message.inputValue(), '');
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme });
    for (const height of [900, 500]) {
      await page.setViewportSize({ width: 651, height });
      const fieldGeometry = await page.locator('#fb-name, #fb-email').evaluateAll(inputs => inputs.map(input => {
        const style = getComputedStyle(input);
        return {
          id: input.id,
          height: input.parentElement.getBoundingClientRect().height,
          textSpace: input.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
          lineHeight: parseFloat(style.lineHeight),
        };
      }));
      assert.ok(Math.abs(fieldGeometry[0].height - fieldGeometry[1].height) < 0.5, 'Name and email fields have equal heights');
      for (const field of fieldGeometry) assert.ok(field.textSpace >= field.lineHeight, `${field.id}: its text line fits inside the field without vertical clipping`);
      await email.fill('invalid');
      await email.blur();
      await email.scrollIntoViewIfNeeded();
      assert.equal(await email.getAttribute('aria-invalid'), 'true');
      const errorContrast = await page.locator('#fb-email-error').evaluate(element => {
        const luminance = color => {
          const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
            const s = value / 255;
            return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          });
          return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
        };
        const foreground = luminance(getComputedStyle(element).color);
        const background = luminance(getComputedStyle(element.closest('[role="dialog"]')).backgroundColor);
        return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
      });
      assert.ok(errorContrast >= 4.5, `Readable email error in ${colorScheme}: ${errorContrast.toFixed(2)}:1`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await mkdir('test-results', { recursive: true });
      if (colorScheme === 'dark' && height === 900) await page.screenshot({ path: 'test-results/feedback-email-dark.png' });
      await submit.scrollIntoViewIfNeeded();
      const box = await submit.boundingBox();
      assert.ok(box.y >= 0 && box.y + box.height <= height, 'Submit remains reachable at short heights');
    }
  }
  assert.deepEqual(failures, []);
  console.log('PASS optional email, validation, retry preservation, diagnostics, draft reset, both themes, short window, and submission transport');
} finally {
  await browser.close();
}
