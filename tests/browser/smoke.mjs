import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir = await fs.mkdtemp(join(tmpdir(), 'select-summary-browser-'));
const ext = fileURLToPath(new URL('../../chrome-extension/', import.meta.url));
const artifacts = fileURLToPath(new URL('../../artifacts/', import.meta.url));
await fs.mkdir(artifacts, { recursive: true });
const c = await chromium.launchPersistentContext(dir, {
  channel: 'chromium',
  headless: true,
  viewport: { width: 420, height: 850 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`]
});
const errors = [];
c.on('page', (p) => p.on('pageerror', (e) => errors.push(e.message)));
await c.addInitScript(() => {
  globalThis.__shadows = new WeakMap();
  const attach = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (options) {
    const s = attach.call(this, options);
    __shadows.set(this, s);
    return s;
  };
});
try {
  const w = c.serviceWorkers()[0] || (await c.waitForEvent('serviceworker'));
  await w.evaluate(async () => {
    let s;
    for (let i = 0; i < 60; i++) {
      s = (await chrome.storage.local.get('appState')).appState;
      if (s) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    const d = new Date(),
      today = [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0')
      ].join('-');
    await chrome.storage.local.set({
      appState: {
        ...s,
        key: 'fake-key',
        keyValidated: true,
        historyLimit: 15,
        onboarding: { completed: true },
        history: Array.from({ length: 12 }, (_, i) => ({
          id: 'sample-' + i,
          text: 'A saved summary.',
          timestamp: Date.now() - i * 1000,
          summaryWords: 3,
          sourceWords: 120
        })),
        activity: { [today]: { count: 12, secondsSaved: 180 } }
      }
    });
    globalThis.fetch = async () => {
      await new Promise((r) => setTimeout(r, 900));
      return new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                parts: [
                  {
                    text: 'Toronto is a diverse Canadian city on Lake Ontario.'
                  }
                ]
              }
            }
          ]
        }),
        { status: 200 }
      );
    };
  });
  const p = await c.newPage();
  await p.goto(w.url().replace('background.js', 'popup.html'));
  await p.locator('#home').waitFor({ state: 'visible' });
  assert.equal(await p.locator('#heatmap button').count(), 84);
  const cell = p
    .locator('#heatmap button[data-level="0"]:not(:disabled)')
    .first();
  const before = await cell.evaluate(
    (e) => getComputedStyle(e).backgroundColor
  );
  await cell.hover();
  assert.equal(
    await cell.evaluate((e) => getComputedStyle(e).backgroundColor),
    before
  );
  assert(await p.locator('#activity-tooltip').isVisible());
  await p.evaluate(() => {
    globalThis.savedCell = document.querySelector('#heatmap button');
  });
  await w.evaluate(() =>
    chrome.storage.session.set({
      notice: {
        id: 'test-notice',
        level: 'info',
        title: 'Test notice',
        message: 'A harmless status.'
      }
    })
  );
  await p.locator('#notice').waitFor({ state: 'visible' });
  assert(
    await p.evaluate(
      () => savedCell === document.querySelector('#heatmap button')
    )
  );
  await p.locator('#dismiss-notice').click();
  await p.locator('[data-view="settings"]').click();
  assert.equal(await p.locator('.settings-group').count(), 4);
  await p.locator('#history-limit input[value="20"] + span').click();
  await p.waitForFunction(
    () => document.querySelector('#history-limit input[value="20"]').checked
  );
  await p.reload();
  await p.locator('[data-view="settings"]').click();
  assert(await p.locator('#history-limit input[value="20"]').isChecked());
  await p.locator('#history-limit input[value="5"] + span').click();
  await p.locator('#confirm-dialog button[value="cancel"]').click();
  assert(await p.locator('#history-limit input[value="20"]').isChecked());
  assert.equal(
    (await w.evaluate(() => chrome.storage.local.get('appState'))).appState
      .history.length,
    12
  );
  await p.locator('#history-limit input[value="5"] + span').click();
  await p.locator('#confirm-action').click();
  await p
    .waitForFunction(
      () => document.querySelector('#history-limit input[value="5"]').checked,
      null,
      { timeout: 5000 }
    )
    .catch(async (e) => {
      console.log('NOTICE', await p.locator('#notice-message').textContent());
      throw e;
    });
  assert.equal(
    (await w.evaluate(() => chrome.storage.local.get('appState'))).appState
      .history.length,
    5
  );
  assert.equal(await p.locator('#stat-total').textContent(), '12');
  await p.waitForTimeout(250);
  await p.screenshot({
    path: `${artifacts}/settings-refined.png`,
    fullPage: true
  });
  await p.getByText('Gemini connection', { exact: true }).click();
  assert.equal(
    await p.locator('#key-status').textContent(),
    '••••••••••••••••••••••••-key'
  );
  assert(await p.locator('#remove-key').isVisible());
  const beforeDisconnect = await p.locator('#remove-key').boundingBox();
  await p.locator('#replace-key').click();
  assert(await p.locator('#new-key').isVisible());
  const afterDisconnect = await p.locator('#remove-key').boundingBox();
  assert.deepEqual(afterDisconnect, beforeDisconnect);
  const cancel = p.locator('.key-form-actions button[type=button]');
  const connect = p.locator('.key-form-actions button[type=submit]');
  const cancelBounds = await cancel.boundingBox(),
    connectBounds = await connect.boundingBox();
  assert.equal(cancelBounds.height, connectBounds.height);
  assert(Math.abs(cancelBounds.width - connectBounds.width) < 1);
  await p.screenshot({
    path: `${artifacts}/key-replacement-refined.png`,
    fullPage: true
  });
  await cancel.click();
  assert(await p.locator('#replace-key').isEnabled());
  await p.locator('#replace-key').click();
  await p.locator('#new-key').fill('replacement-fake-key');
  await p.locator('#replacement-form input[type=checkbox]').check();
  await p.locator('.key-form-actions button[type=submit]').click();
  await p.locator('#replacement-form').waitFor({ state: 'hidden' });
  assert.equal(
    (await w.evaluate(() => chrome.storage.local.get('appState'))).appState.key,
    'replacement-fake-key'
  );
  await p.getByText('Privacy & data', { exact: true }).click();
  assert(await p.locator('.setting-links').isVisible());
  await p
    .evaluate(() => {
      globalThis.testCard = SelectSummaryCard;
    })
    .catch(() => {});
  await p.evaluate(async () => {
    await import(chrome.runtime.getURL('summary-card.js'));
    globalThis.card = SelectSummaryCard.create();
    card.update({ kind: 'loading' });
  });
  await p.waitForTimeout(200);
  const loading = await p.evaluate(() => {
    const h = document.querySelector('select-summary-card'),
      s = __shadows.get(h);
    return {
      lines: s.querySelectorAll('.skeleton span').length,
      text: s.querySelector('.text')?.textContent,
      tooltip: s.querySelector('.close').hasAttribute('title'),
      brand: getComputedStyle(s.querySelector('.brand')).color
    };
  });
  assert.equal(
    await p.evaluate(
      () =>
        getComputedStyle(__shadows.get(card.host).querySelector('.brand'))
          .fontSize
    ),
    '18px'
  );
  assert.equal(loading.lines, 3);
  assert.equal(loading.text, undefined);
  assert.equal(loading.tooltip, false);
  assert.equal(loading.brand, 'rgb(21, 71, 62)');
  await p.screenshot({
    path: `${artifacts}/summary-skeleton.png`,
    fullPage: true
  });
  await p.evaluate(() =>
    card.update({ kind: 'summary', text: 'A clear summary.' })
  );
  await p.waitForTimeout(100);
  assert.equal(
    await p.evaluate(
      () =>
        getComputedStyle(__shadows.get(card.host).querySelector('.copy'))
          .backgroundColor
    ),
    'rgb(21, 71, 62)'
  );
  await p.evaluate(() =>
    __shadows.get(card.host).querySelector('.close').click()
  );
  assert.equal(await p.locator('select-summary-card').count(), 1);
  await p.waitForTimeout(220);
  assert.equal(await p.locator('select-summary-card').count(), 0);
  for (const width of [320, 420, 900]) {
    await p.setViewportSize({ width, height: 900 });
    await p.locator('[data-view="home"]').click();
    assert.equal(await p.locator('#heatmap button').count(), 84);
    await p.locator('[data-view="settings"]').click();
    assert(
      !(await p.evaluate(
        () => document.documentElement.scrollWidth > innerWidth
      ))
    );
  }
  const welcome = await c.newPage();
  await welcome.goto(w.url().replace('background.js', 'welcome.html'));
  await welcome.locator('#intro-step').waitFor({ state: 'visible' });
  await welcome.locator('#intro-result').waitFor({ state: 'visible' });
  assert.equal(
    await welcome.locator('#intro-result select-summary-card').count(),
    1
  );
  await welcome.emulateMedia({ reducedMotion: 'reduce' });
  await welcome.waitForTimeout(100);
  assert.equal(await welcome.locator('#intro-cursor').isVisible(), false);
  await welcome.emulateMedia({ reducedMotion: 'no-preference' });
  await welcome.waitForTimeout(950);
  assert(await welcome.locator('#intro-cursor').isVisible());
  await welcome.locator('#get-started').click();
  await welcome.locator('#continue-connect').click();
  await welcome.locator('#text-toronto').focus();
  await welcome.keyboard.press(
    process.platform === 'darwin' ? 'Meta+A' : 'Control+A'
  );
  await welcome.keyboard.press('Alt+Shift+S');
  await welcome.waitForFunction(() => {
    const h = document.querySelector('#demo-viewport select-summary-card');
    return h && __shadows.get(h)?.querySelector('.skeleton');
  });
  await welcome.waitForFunction(
    () => !document.querySelector('#continue-sandbox').disabled
  );
  assert.equal(
    await welcome.evaluate(
      () =>
        getComputedStyle(
          __shadows
            .get(document.querySelector('#demo-viewport select-summary-card'))
            .querySelector('.copy')
        ).backgroundColor
    ),
    'rgb(21, 71, 62)'
  );
  // Exercise a genuinely unconnected onboarding run and failure/retry behavior.
  await p.close();
  await welcome.close();
  await w.evaluate(async () => {
    const { appState } = await chrome.storage.local.get('appState');
    await chrome.storage.local.set({
      appState: {
        ...appState,
        key: null,
        keyValidated: false,
        credentialRevision: appState.credentialRevision + 1,
        onboarding: { completed: false }
      }
    });
    globalThis.mockStatus = 403;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: 'STOP',
              content: { parts: [{ text: 'A successful test summary.' }] }
            }
          ]
        }),
        { status: globalThis.mockStatus }
      );
  });
  const fresh = await c.newPage();
  await fresh.goto(w.url().replace('background.js', 'welcome.html'));
  await fresh.locator('#get-started').click();
  await fresh.locator('#api-key').fill('fresh-fake-key');
  await fresh.locator('#google-consent').check();
  await fresh.locator('#verify-key').click();
  await fresh.waitForFunction(() =>
    document.querySelector('#key-status').textContent.includes('could not use')
  );
  assert.equal(
    (await w.evaluate(() => chrome.storage.local.get('appState'))).appState.key,
    null
  );
  await w.evaluate(() => {
    globalThis.mockStatus = 200;
  });
  await fresh.locator('#verify-key').click();
  await fresh.locator('#sandbox-step').waitFor({ state: 'visible' });
  assert.equal(
    (await w.evaluate(() => chrome.storage.local.get('appState'))).appState.key,
    'fresh-fake-key'
  );
  assert(await fresh.locator('#continue-sandbox').isDisabled());
  await fresh.locator('#text-toronto').focus();
  await fresh.keyboard.press(
    process.platform === 'darwin' ? 'Meta+A' : 'Control+A'
  );
  await fresh.keyboard.press('Alt+Shift+S');
  await fresh.waitForFunction(
    () => !document.querySelector('#continue-sandbox').disabled
  );
  assert.deepEqual(errors, []);
  console.log(
    'PASS: 12-week grid and unchanged hover fills; accordion settings; persisted limit, cancel/confirm trimming; activity preservation; global skeleton/card colours, animated close/no tooltip; shared intro/live practice; 320/420/900px; new-key failure/retry and per-run practice gate.'
  );
} finally {
  await c.close();
  await fs.rm(dir, { recursive: true, force: true });
}
