// Compare effective styles on the same DOM against a supplied pre-cleanup copy.
// Usage: BASELINE_EXTENSION=/path/to/old/chrome-extension node tests/browser/styles.mjs
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const baseline = process.env.BASELINE_EXTENSION;
assert(
  baseline,
  'Set BASELINE_EXTENSION to the pre-cleanup extension directory.'
);
const extension = fileURLToPath(
  new URL('../../chrome-extension/', import.meta.url)
);
const profile = await fs.mkdtemp(join(tmpdir(), 'select-summary-styles-'));
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  headless: true,
  reducedMotion: 'reduce',
  args: [
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`
  ]
});
try {
  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent('serviceworker'));
  await worker.evaluate(async () => {
    for (let i = 0; i < 60; i++) {
      const { appState } = await chrome.storage.local.get('appState');
      if (appState) {
        await chrome.storage.local.set({
          appState: {
            ...appState,
            key: 'fake-key',
            keyValidated: true,
            onboarding: { completed: true },
            history: [
              {
                id: 'a',
                text: 'An example summary.',
                timestamp: 1700000000000,
                summaryWords: 3
              }
            ]
          }
        });
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  });
  const page = await context.newPage();
  const differences = [];
  for (const name of ['popup', 'welcome']) {
    const oldCSS = await fs.readFile(join(baseline, `${name}.css`), 'utf8');
    const newCSS = await fs.readFile(join(extension, `${name}.css`), 'utf8');
    await page.goto(worker.url().replace('background.js', `${name}.html`));
    await page
      .locator(name === 'popup' ? '#home' : '#intro-step')
      .waitFor({ state: 'visible' });
    for (const width of [320, 420, 800, 900, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const view of name === 'popup'
        ? ['home', 'history', 'settings']
        : ['intro', 'connect', 'sandbox', 'pin']) {
        await page.evaluate(
          ({ view, name }) => {
            // Inspect all sections without changing authorization or saved state.
            const ids =
              name === 'popup'
                ? ['home', 'history', 'settings']
                : ['intro-step', 'connect-step', 'sandbox-step', 'pin-step'];
            ids.forEach(
              (id) =>
                (document.getElementById(id).hidden =
                  id !== (name === 'popup' ? view : `${view}-step`))
            );
          },
          { view, name }
        );
        const diff = await page.evaluate(
          ({ oldCSS, newCSS }) => {
            const link = document.querySelector('link[rel=stylesheet]');
            link.disabled = true;
            const style = document.createElement('style');
            document.head.append(style);
            const stable = document.createElement('style');
            stable.textContent =
              '*,*::before,*::after{animation:none!important;transition:none!important}';
            document.head.append(stable);
            const nodes = [...document.querySelectorAll('body *')];
            const snapshot = () =>
              nodes.map((el) => {
                const css = getComputedStyle(el);
                return Object.fromEntries(
                  [...css]
                    .filter((key) => !key.startsWith('--'))
                    .map((key) => [key, css.getPropertyValue(key)])
                );
              });
            style.textContent = oldCSS;
            const before = snapshot();
            style.textContent = newCSS;
            const after = snapshot();
            const diff = [];
            for (let i = 0; i < nodes.length; i++)
              for (const key of Object.keys(before[i]))
                if (before[i][key] !== after[i][key])
                  diff.push({
                    element:
                      nodes[i].id || nodes[i].className || nodes[i].tagName,
                    key,
                    before: before[i][key],
                    after: after[i][key]
                  });
            style.remove();
            stable.remove();
            link.disabled = false;
            return diff;
          },
          { oldCSS, newCSS }
        );
        if (diff.length)
          differences.push({
            name,
            width,
            view,
            count: diff.length,
            examples: diff.slice(0, 8)
          });
      }
    }
  }
  assert.deepEqual(
    differences,
    [],
    'Style consolidation changed computed appearance: ' +
      JSON.stringify(differences, null, 2)
  );
  console.log(
    'PASS: identical computed styles for all 7 views at 320/420/800/900/1440px.'
  );
} finally {
  await context.close();
  await fs.rm(profile, { recursive: true, force: true });
}
