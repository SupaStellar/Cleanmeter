// Run against `npm run dev`: node scripts/test-sound-effects.mjs
// Exercises the actual app, not Storybook. Native persistence has separate tests.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 800, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.addInitScript(() => {
  window.soundStarts = 0;
  window.soundTiming = [];
  window.soundDirections = [];
  window.noiseFrequencies = [];
  // Exercise cold output initialization under main-thread load.
  const createConvolver = AudioContext.prototype.createConvolver;
  AudioContext.prototype.createConvolver = function (...args) {
    const until = performance.now() + 80;
    while (performance.now() < until) { /* simulate expensive first setup */ }
    return createConvolver.apply(this, args);
  };
  window.soundPeak = 0;
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (destination, ...args) {
    if (destination === this.context.destination) {
      const analyser = this.context.createAnalyser();
      analyser.fftSize = 32768;
      connect.call(this, analyser);
      const samples = new Float32Array(analyser.fftSize);
      setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        for (const sample of samples) {
          window.soundPeak = Math.max(window.soundPeak, Math.abs(sample));
        }
      }, 5);
    }
    return connect.call(this, destination, ...args);
  };
  const createBufferSource = AudioContext.prototype.createBufferSource;
  AudioContext.prototype.createBufferSource = function (...args) {
    const until = performance.now() + 30;
    while (performance.now() < until) { /* simulate busy noise source setup */ }
    const source = createBufferSource.apply(this, args);
    const connectSource = source.connect.bind(source);
    let filter;
    source.connect = (destination, ...rest) => { filter = destination; return connectSource(destination, ...rest); };
    const startSource = source.start.bind(source);
    source.start = (...values) => {
      window.soundStarts++;
      window.soundTiming.push(values[0] - this.currentTime);
      window.noiseFrequencies.push(filter?.frequency?.value);
      return startSource(...values);
    };
    return source;
  };
  const createOscillator = AudioContext.prototype.createOscillator;
  AudioContext.prototype.createOscillator = function (...args) {
    // Source allocation must also precede the shared cue clock.
    const until = performance.now() + 30;
    while (performance.now() < until) { /* simulate busy node setup */ }
    const oscillator = createOscillator.apply(this, args);
    let from, to;
    const setFrequency = oscillator.frequency.setValueAtTime.bind(oscillator.frequency);
    const rampFrequency = oscillator.frequency.exponentialRampToValueAtTime.bind(oscillator.frequency);
    oscillator.frequency.setValueAtTime = (value, time) => { from = value; return setFrequency(value, time); };
    oscillator.frequency.exponentialRampToValueAtTime = (value, time) => { to = value; return rampFrequency(value, time); };
    const start = oscillator.start.bind(oscillator);
    oscillator.start = (...values) => {
      window.soundStarts++;
      window.soundTiming.push(values[0] - this.currentTime);
      window.soundDirections.push(to > from ? "back" : "forward");
      return start(...values);
    };
    return oscillator;
  };
});
const count = () => page.evaluate(() => window.soundStarts);
const pause = () => page.waitForTimeout(800);
const tab = (name) => page.getByRole("tab", { name, exact: true }).click();
async function audible(label, action) {
  await pause();
  const before = await count();
  await page.evaluate(() => { window.soundPeak = 0; });
  await action();
  await pause();
  assert.ok(await count() > before, `${label} must synthesize a sound`);
  assert.ok(await page.evaluate(() => window.soundPeak) > 0.001,
    `${label} must produce a non-zero signal at the audio destination`);
  const leads = await page.evaluate(() => window.soundTiming);
  assert.ok(leads.every((lead) => lead >= 0),
    `${label}: envelopes must not start in the past (${Math.min(...leads)}s)`);
  console.log(`PASS audible: ${label}`);
}
async function silent(label, action) {
  await pause();
  const before = await count();
  await action();
  await pause();
  assert.equal(await count(), before, `${label} must be silent`);
  console.log(`PASS silent: ${label}`);
}

try {
  await page.goto(process.env.APP_URL ?? "http://127.0.0.1:1420/");
  await page.waitForTimeout(2500);
  assert.equal(await count(), 0, "Startup and telemetry must be silent");
  for (const name of ["CPU", "GPU"]) {
    await page.reload();
    await page.waitForTimeout(2500);
    const control = page.getByRole("switch", { name, exact: true });
    for (const checked of [false, true, false, true]) {
      await audible(`${name} ${checked}`, () => control.click());
      assert.equal(await control.getAttribute("aria-checked"), String(checked));
      assert.deepEqual(await page.evaluate(() => window.noiseFrequencies.slice(-2)), [2200, 3800], "Original Legacy toggle recipe in both directions");
    }
  }
  await silent("tab navigation", () => tab("Settings"));
  const sound = page.getByRole("switch", { name: "Sound effects", exact: true });
  assert.equal(await sound.getAttribute("aria-checked"), "true");
  await audible("Pixel Shift toggle", () => page.getByRole("switch", { name: "Pixel Shift", exact: true }).click());
  const beforeRapid = await count();
  const pixelShift = page.getByRole("switch", { name: "Pixel Shift", exact: true });
  await pixelShift.focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press("Space");
  assert.equal(await count() - beforeRapid, 20, "Ten rapid toggle events must produce ten cues");
  console.log("PASS ten rapid toggles: ten cues");
  await audible("temperature selection", () => page.getByRole("radio", { name: "Fahrenheit", exact: false }).click());
  await silent("same temperature selection", () => page.getByRole("radio", { name: "Fahrenheit", exact: false }).click());
  await audible("start minimized", () => page.getByRole("checkbox", { name: "Start minimized", exact: true }).click());
  assert.equal(await page.evaluate(() => window.noiseFrequencies.at(-1)), 1700, "Original Legacy press for checkbox");
  await silent("turn sound off", () => sound.click());
  await silent("muted Pixel Shift", () => page.getByRole("switch", { name: "Pixel Shift", exact: true }).click());
  await tab("Stats");
  await silent("muted CPU section", () => page.getByRole("switch", { name: "CPU", exact: true }).click());
  await tab("Settings");
  await audible("enable sound with keyboard", () => sound.press("Space"));
  await tab("Stats");
  await pause();
  const beforeGroup = await count();
  await page.getByRole("switch", { name: "CPU", exact: true }).click();
  await pause();
  assert.equal(await count() - beforeGroup, 2, "Grouped CPU changes must produce one toggle cue");
  console.log("PASS grouped CPU section: one cue");
  await audible("CPU checkbox", () => page.getByRole("checkbox", {name:"CPU Usage",exact:true}).click());
  assert.equal(await page.evaluate(() => window.noiseFrequencies.at(-1)),1700);
  await tab("Style");
  await audible("orientation", () => page.getByRole("button", { name: "Vertical", exact: false }).click());
  await silent("unchanged orientation", () => page.getByRole("button", { name: "Vertical", exact: false }).click());
  await silent("opacity slider keyboard", () => page.getByRole("slider").press("ArrowLeft"));
  await tab("Help");
  await audible("feedback button", () => page.getByRole("button", { name: "Give feedback", exact: true }).click());
  await audible("feedback diagnostics checkbox", () => page.getByRole("checkbox", {name:"Include system specs and app logs"}).click());
  assert.equal(await page.evaluate(() => window.noiseFrequencies.at(-1)),1700);
  await page.keyboard.press("Escape");
  await tab("Settings");
  await sound.click();
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await silent("muted keyboard change with reduced motion", () => page.getByRole("switch", { name: "Pixel Shift", exact: true }).press("Space"));
  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/sound-settings.png", fullPage: true });
  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log("PASS no runtime errors");
} finally {
  await browser.close();
}
