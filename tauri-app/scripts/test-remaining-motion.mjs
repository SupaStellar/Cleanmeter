import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch();
const url = process.env.APP_URL ?? 'http://127.0.0.1:1424/';
try {
 for (const reducedMotion of ['no-preference','reduce']) {
  const page = await browser.newPage({reducedMotion, viewport:{width:800,height:1000}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  const tab = name => page.getByRole('tab',{name,exact:true}).click();
  const cpu = page.getByRole('switch',{name:'CPU',exact:true});
  await cpu.waitFor();
  const body = cpu.locator('xpath=ancestor::section').locator('.app-disclosure').first();
  const fullHeight=await body.evaluate(el=>el.getBoundingClientRect().height);
  assert.ok(fullHeight > 0);
  await cpu.click(); await page.waitForTimeout(500);
  assert.equal(await body.evaluate(el=>el.getBoundingClientRect().height),0);
  assert.equal(await body.getAttribute('inert'),'');
  await cpu.click(); await page.waitForTimeout(500);
  assert.ok(await body.evaluate(el=>el.getBoundingClientRect().height)>0);
  assert.equal(await body.evaluate(el=>el.style.height),'');
  const expand=page.getByRole('button',{name:/^Expand /}).first();
  if(await expand.count()) {
    const name=await expand.getAttribute('aria-label');
    await expand.click(); await page.waitForTimeout(300);
    assert.equal(await page.getByRole('button',{name:name.replace('Expand ','Collapse '),exact:true}).getAttribute('aria-expanded'),'true');
  }
  await tab('Style');
  const collapse=page.getByRole('button',{name:'Collapse Position',exact:true});
  await collapse.click(); await page.waitForTimeout(300);
  assert.equal(await page.getByRole('switch',{name:'Use custom position'}).count(),0);
  await page.getByRole('button',{name:'Expand Position',exact:true}).click();
  const custom=page.getByRole('switch',{name:'Use custom position'});
  await custom.waitFor();
  if(await custom.isChecked()) { await custom.click(); await page.waitForTimeout(500); }
  await custom.click(); await page.waitForTimeout(500);
  assert.equal(await page.getByRole('button',{name:'Top left',exact:true}).count(),0);
  await custom.click(); await page.waitForTimeout(500);
  assert.equal(await page.getByRole('button',{name:'Top left',exact:true}).count(),1);
  await tab('Settings');
  const pixel=page.getByRole('switch',{name:'Pixel Shift',exact:true});
  if(await pixel.isChecked()) await pixel.click();
  await pixel.click(); await page.waitForTimeout(500);
  await page.getByRole('combobox',{name:'Shift by',exact:true}).waitFor();
  await pixel.focus();
  for(let i=0;i<10;i++) await page.keyboard.press('Space');
  await page.waitForTimeout(500);
  assert.equal(await pixel.isChecked(),true);
  await tab('Help');
  await page.getByRole('button',{name:'Collapse Frequently asked questions'}).click();
  await page.waitForTimeout(300);
  assert.equal(await page.getByRole('button',{name:'Expand Frequently asked questions'}).locator('xpath=ancestor::div[contains(@class,"t-acc")]').locator('.app-disclosure').evaluate(el=>el.getBoundingClientRect().height),0);
  await page.getByRole('button',{name:'Expand Frequently asked questions'}).click();
  await page.getByRole('button',{name:'Give feedback',exact:true}).click();
  const dialog=page.getByRole('dialog'); await dialog.waitFor();
  assert.equal(await dialog.evaluate(el=>getComputedStyle(el).animationName),reducedMotion==='reduce'?'none':'app-modal-enter');
  await page.keyboard.press('Escape'); await dialog.waitFor({state:'detached'});
  await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Give feedback');
  const close=page.getByRole('button',{name:'Close to tray',exact:true});
  await close.hover(); const tip=page.getByRole('tooltip'); await tip.waitFor();
  assert.equal(await tip.textContent(),'Close to tray');
  await page.mouse.move(400,900,{steps:10});
  await tip.waitFor({state:'detached'});
  await page.evaluate(async()=>{const {useToastStore}=await import('/src/stores/toast-store.ts');useToastStore.getState().showToast('Motion check');});
  const toast=page.locator('.t-toast'); await toast.waitFor(); await page.waitForTimeout(400);
  assert.equal(await toast.evaluate(el=>getComputedStyle(el).opacity),'1');
  await page.waitForTimeout(3700);
  await page.evaluate(async()=>{const {useToastStore}=await import('/src/stores/toast-store.ts');useToastStore.getState().showToast('Motion check');});
  await page.waitForTimeout(500); assert.equal(await toast.count(),1,'Repeated toast survives prior exit timer');
  await toast.waitFor({state:'detached',timeout:5000});
  assert.deepEqual(errors,[]);
  console.log(`PASS remaining app motion: ${reducedMotion}`);
  await page.close();
 }
} finally {await browser.close();}
