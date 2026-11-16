import { test as base, expect, chromium } from '@playwright/test';
import { mkdtemp, rm, cp, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { addSummary, dayKey, shiftDay } from '../../chrome-extension/core.js';

const test = base.extend({
  extension: async ({}, use) => {
    const temporary = await mkdtemp(path.join(os.tmpdir(), 'select-summary-test-'));
    const extensionPath = path.join(temporary, 'extension');
    await cp(path.resolve('chrome-extension'), extensionPath, { recursive: true });
    const manifest = JSON.parse(
      await readFile(path.join(extensionPath, 'manifest.json'), 'utf8')
    );
    // A temporary test-only localhost grant lets us exercise injection without
    // interacting with the browser's native context menu. Never shipped.
    manifest.host_permissions.push('http://127.0.0.1/*');
    await writeFile(path.join(extensionPath, 'manifest.json'), JSON.stringify(manifest));
    const server = http.createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end(
        '<!doctype html><html lang="en"><title>Synthetic reading fixture</title><style>body{font:18px Arial;padding:40px}button,p,h2{color:purple!important;background:yellow!important}</style><h1>A synthetic article</h1><p id="source">Urban gardens create space for food, neighbors, and wildlife. Good gardens need regular watering and shared care.</p><textarea>Selected text in a text field.</textarea></html>'
      );
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = `http://127.0.0.1:${server.address().port}`;
    const context = await chromium.launchPersistentContext(
      path.join(temporary, 'profile'),
      {
        channel: 'chromium',
        headless: true,
        args: [
          `--disable-extensions-except=${extensionPath}`,
          `--load-extension=${extensionPath}`
        ]
      }
    );
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    const apiCalls = [];
    // Deny real HTTP(S) from pages. The only allowed network is our local fixture.
    await context.route(/^https?:\/\//, (route) =>
      route.request().url().startsWith(address) ? route.continue() : route.abort()
    );
    // Worker fetch is replaced before any UI connection can be submitted. It
    // never falls back to the network, even for unexpected requests.
    await worker.evaluate(() => {
      globalThis.__testRequests = [];
      globalThis.__testStatus = 200;
      globalThis.__testDelay = 0;
      globalThis.fetch = async (url, options) => {
        globalThis.__testRequests.push({
          url,
          headers: options.headers,
          body: JSON.parse(options.body)
        });
        if (globalThis.__testDelay)
          await new Promise((resolve) => setTimeout(resolve, globalThis.__testDelay));
        if (globalThis.__testStatus !== 200)
          return new Response('Synthetic provider error', {
            status: globalThis.__testStatus
          });
        return new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: 'STOP',
                content: {
                  parts: [
                    {
                      text: 'Urban gardens grow food, connect neighbors, and support wildlife. Reliable watering and shared care help them thrive.'
                    }
                  ]
                }
              }
            ]
          })
        );
      };
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`chrome-extension://${id}/popup.html`);
    try {
      await use({ context, worker, page, id, address, apiCalls, errors });
    } finally {
      await context.close();
      await new Promise((resolve) => server.close(resolve));
      await rm(temporary, { recursive: true, force: true });
    }
  }
});

async function saveKey(page) {
  await page.getByRole('button', { name: 'Set up', exact: true }).click();
  await page.getByRole('button', { name: 'I have my key' }).click();
  const save = page.getByRole('button', { name: 'Save key', exact: true });
  await expect(save).toBeDisabled();
  await page
    .getByLabel('Gemini API key', { exact: true })
    .fill('synthetic-test-key-abcd');
  await expect(save).toBeDisabled();
  await page.getByRole('checkbox').check();
  await expect(save).toBeEnabled();
  await save.click();
  await expect(
    page.getByRole('heading', { name: "You're all set.", exact: true })
  ).toBeVisible();
}

async function selectPractice(page) {
  await page.locator('#practice-source').scrollIntoViewIfNeeded();
  await page.locator('#practice-source').focus();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
}

async function completePractice(page) {
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await selectPractice(page);
  await page
    .locator('#practice-source')
    .click({ button: 'right', position: { x: 20, y: 20 } });
  await page.getByRole('menuitem', { name: 'Summarize selection' }).click();
  await expect(page.locator('#practice-status')).toHaveText('Right-click complete.');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeDisabled();
  await selectPractice(page);
  await page.keyboard.press('Alt+Shift+S');
  await expect(page.locator('#practice-status')).toHaveText('Shortcut complete.');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
}

async function connect(page) {
  await saveKey(page);
  await completePractice(page);
}

async function seed(worker, count = 1) {
  let state = await worker.evaluate(
    async () => (await chrome.storage.local.get('appState')).appState
  );
  for (let index = 0; index < count; index++)
    state = addSummary(
      state,
      'Synthetic summaries preserve the important concepts without keeping the original selection.',
      450,
      Date.now() - index * 60_000,
      `fixture-${index}`
    );
  // A few synthetic past days help inspect streaks and heatmap color levels.
  for (let index = 1; index <= 4; index++)
    state.activity[dayKey(shiftDay(new Date(), -index))] = {
      count: index,
      secondsSaved: index * 60
    };
  await worker.evaluate((appState) => chrome.storage.local.set({ appState }), state);
}

test('setup saves without an API call, requires both practice methods, and renders accessible layouts', async ({
  extension
}) => {
  const { page, worker, errors } = extension;
  await page.setViewportSize({ width: 420, height: 720 });
  await saveKey(page);
  expect(await worker.evaluate(() => globalThis.__testRequests.length)).toBe(0);
  const skipped = await page.evaluate(() =>
    chrome.runtime.sendMessage({ type: 'FINISH_TUTORIAL' })
  );
  expect(skipped.ok).toBe(false);
  await completePractice(page);
  expect(await worker.evaluate(() => globalThis.__testRequests.length)).toBe(0);
  await expect(page.locator('#stat-total')).toHaveText('0');
  await expect(page.locator('#heatmap button')).toHaveCount(91);
  const snapshot = await page.evaluate(() =>
    chrome.runtime.sendMessage({ type: 'GET_STATE' })
  );
  expect(JSON.stringify(snapshot)).not.toContain('synthetic-test-key');
  expect(snapshot.state.history).toEqual([]);
  expect(
    await page
      .locator('svg')
      .evaluateAll((nodes) => nodes.every((node) => node.closest('button')))
  ).toBe(true);
  await page.getByRole('button', { name: 'History', exact: false }).first().click();
  await expect(page.getByRole('heading', { name: 'No summaries yet.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Clear history' })).toBeDisabled();
  for (const width of [320, 420, 920]) {
    await page.setViewportSize({ width, height: 800 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
    ).toBe(true);
  }
  await page.getByRole('button', { name: 'Overview' }).click();
  await expect(page.locator('#heatmap button')).toHaveCount(364);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await page.locator('#home').evaluate((node) => getComputedStyle(node).animationName)
  ).toBe('none');
  expect(errors).toEqual([]);
});

test('local format validation protects the saved key without making an API request', async ({
  extension
}) => {
  const { page, worker } = extension;
  await connect(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Replace key', exact: true }).click();
  await page
    .getByLabel('Gemini API key', { exact: true })
    .fill('invalid key with spaces');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Save key' }).click();
  await expect(page.locator('.form-status')).toContainText(
    'Paste a complete API key without spaces'
  );
  expect(
    await worker.evaluate(
      async () => (await chrome.storage.local.get('appState')).appState.key
    )
  ).toBe('synthetic-test-key-abcd');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('#new-key')).toHaveCount(0);
});

test('history safely renders hostile provider text, copy feedback works, and clearing preserves statistics', async ({
  extension
}) => {
  const { page, worker } = extension;
  await connect(page);
  await seed(worker, 3);
  await worker.evaluate(async () => {
    const { appState } = await chrome.storage.local.get('appState');
    appState.history[0].text = '<img src=x onerror="globalThis.exposed=true">';
    await chrome.storage.local.set({ appState });
  });
  await page.getByRole('button', { name: 'History', exact: false }).first().click();
  await expect(page.locator('#summary-list .summary-card')).toHaveCount(3);
  expect(await page.locator('#summary-list img').count()).toBe(0);
  await expect(page.locator('#summary-list .summary-text').first()).toContainText(
    '<img src=x'
  );
  await page.getByRole('button', { name: 'Copy', exact: true }).first().click();
  await expect(
    page.getByRole('status').filter({ hasText: /Copied|Copy was blocked/ })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Clear history', exact: true }).click();
  await page.getByRole('button', { name: 'Keep it' }).click();
  await expect(page.locator('#summary-list .summary-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Clear history', exact: true }).click();
  await page.locator('#confirm-action').click();
  await expect(page.locator('#summary-list .summary-card')).toHaveCount(0);
  expect(
    await worker.evaluate(
      async () =>
        Object.keys((await chrome.storage.local.get('appState')).appState.activity).length
    )
  ).toBeGreaterThan(0);
});

test('removing a key preserves history; resetting removes all local data', async ({
  extension
}) => {
  const { page, worker } = extension;
  await connect(page);
  await seed(worker);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Remove key from this device' }).click();
  await page.locator('#confirm-action').click();
  await expect(page.getByRole('button', { name: 'Set up' })).toBeVisible();
  expect(
    await worker.evaluate(
      async () => (await chrome.storage.local.get('appState')).appState.history.length
    )
  ).toBe(1);
  await connect(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Reset all local data' }).click();
  await page.locator('#confirm-action').click();
  await expect(page.getByRole('button', { name: 'Set up' })).toBeVisible();
  const state = await worker.evaluate(
    async () => (await chrome.storage.local.get('appState')).appState
  );
  expect(state.key).toBe(null);
  expect(state.history).toEqual([]);
  expect(state.activity).toEqual({});
});

test('injected card is isolated, injection is idempotent, and content scripts cannot read storage or call privileged messages', async ({
  extension
}) => {
  const { page, worker, context, address } = extension;
  await connect(page);
  const article = await context.newPage();
  await article.goto(address);
  const tabId = await worker.evaluate(
    async (address) =>
      (await chrome.tabs.query({})).find((tab) => tab.url?.startsWith(address)).id,
    address
  );
  const result = await worker.evaluate(async (tabId) => {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async () => {
        let readDenied = false,
          messageDenied = false;
        try {
          await chrome.storage.local.get('appState');
        } catch {
          readDenied = true;
        }
        try {
          const result = await chrome.runtime.sendMessage({ type: 'RESET_ALL' });
          messageDenied = !result?.ok;
        } catch {
          messageDenied = true;
        }
        return { readDenied, messageDenied };
      }
    });
    await chrome.tabs.sendMessage(tabId, {
      type: 'SELECT_SUMMARY_CARD',
      kind: 'summary',
      title: 'The short version',
      text: '<script>globalThis.exposed=true</script>'
    });
    return result;
  }, tabId);
  expect(result).toEqual({ readDenied: true, messageDenied: true });
  await expect(article.locator('select-summary-card')).toHaveCount(1);
  expect(
    await article.locator('select-summary-card').evaluate((node) => node.shadowRoot)
  ).toBe(null);
  expect(await article.evaluate(() => globalThis.exposed)).toBeUndefined();
  expect(
    await worker.evaluate(async () =>
      Boolean((await chrome.storage.local.get('appState')).appState.key)
    )
  ).toBe(true);
});

test('window control opens a responsive extension window', async ({ extension }) => {
  const { page, context } = extension;
  await connect(page);
  const windowPagePromise = context.waitForEvent('page');
  await page.getByRole('button', { name: 'Open in a separate window' }).click();
  const windowPage = await windowPagePromise;
  await expect(
    windowPage.getByRole('heading', { name: 'Ready for your first summary?' })
  ).toBeVisible();
  expect(
    await windowPage
      .locator('body')
      .evaluate((node) => node.classList.contains('window-mode'))
  ).toBe(true);
});

test('toolbar action opens the compact popup with reachable controls', async ({
  extension
}) => {
  const { page, worker } = extension;
  await worker.evaluate(() => chrome.action.openPopup());
  // Toolbar popups are Chrome "other" targets rather than ordinary tabs.
  // Inspect the same-origin view through the supported extension API.
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(
          chrome.extension
            .getViews({ type: 'popup' })[0]
            ?.document.querySelector('#start-setup')
        )
      )
    )
    .toBe(true);
  const layout = await page.evaluate(() => {
    const view = chrome.extension.getViews({ type: 'popup' })[0];
    return {
      windowMode: view.document.body.classList.contains('window-mode'),
      width: view.innerWidth,
      bodyWidth: parseFloat(view.getComputedStyle(view.document.body).width),
      scrollWidth: view.document.documentElement.scrollWidth,
      controlVisible:
        view.document.querySelector('#start-setup').getBoundingClientRect().height > 0
    };
  });
  expect(layout.windowMode).toBe(false);
  expect(layout.bodyWidth).toBe(420);
  expect(layout.width).toBeGreaterThanOrEqual(420);
  expect(layout.width).toBeLessThanOrEqual(480);
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width);
  expect(layout.controlVisible).toBe(true);
});

test('capture synthetic documentation screenshots', async ({ extension }) => {
  const { page, worker } = extension;
  await mkdir('docs/images', { recursive: true });
  await page.setViewportSize({ width: 420, height: 760 });
  await page.getByRole('button', { name: 'Set up', exact: true }).click();
  await page.screenshot({
    path: 'docs/images/onboarding.png',
    fullPage: true,
    animations: 'disabled'
  });
  await page.getByRole('button', { name: 'I have my key' }).click();
  await page
    .getByLabel('Gemini API key', { exact: true })
    .fill('synthetic-test-key-abcd');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Save key', exact: true }).click();
  await expect(page.locator('#practice-source')).toBeVisible();
  await page.screenshot({
    path: 'docs/images/tutorial.png',
    fullPage: true,
    animations: 'disabled'
  });
  await completePractice(page);
  await seed(worker, 5);
  await expect(page.locator('#stat-total')).toHaveText('15');
  await page.locator('#toast').waitFor({ state: 'hidden' });
  await page.screenshot({
    path: 'docs/images/overview.png',
    fullPage: true,
    animations: 'disabled'
  });
});

test('card timers use 10 seconds for errors and 25 for summaries, without stale dismissals', async ({
  extension
}) => {
  const { context, worker, address } = extension;
  const article = await context.newPage();
  await article.goto(address);
  const tabId = await worker.evaluate(
    async (address) =>
      (await chrome.tabs.query({})).find((tab) => tab.url?.startsWith(address)).id,
    address
  );

  // Accelerate only this disposable content-script world's timers. Capture its
  // closed shadow root inside that same world, without weakening production UI.
  await worker.evaluate(async (tabId) => {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const realTimeout = globalThis.setTimeout;
        globalThis.__cardDurations = [];
        globalThis.setTimeout = (callback, duration, ...args) => {
          if (duration === 10_000 || duration === 25_000) {
            globalThis.__cardDurations.push(duration);
            return realTimeout(callback, duration / 25, ...args);
          }
          return realTimeout(callback, duration, ...args);
        };
        const attach = Element.prototype.attachShadow;
        Element.prototype.attachShadow = function (options) {
          const root = attach.call(this, options);
          globalThis.__cardRoot = root;
          return root;
        };
      }
    });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tabId, {
      type: 'SELECT_SUMMARY_CARD',
      kind: 'error',
      title: 'Unable to summarize',
      text: 'Synthetic error.'
    });
  }, tabId);

  await expect(article.locator('select-summary-card')).toHaveCount(1);
  await worker.evaluate(async (tabId) => {
    await chrome.tabs.sendMessage(tabId, {
      type: 'SELECT_SUMMARY_CARD',
      kind: 'summary',
      title: 'Summary',
      text: 'A concise synthetic summary.'
    });
  }, tabId);
  const controls = await worker.evaluate(async (tabId) => {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        durations: globalThis.__cardDurations,
        copy: globalThis.__cardRoot.querySelector('.copy').textContent,
        ring: Boolean(globalThis.__cardRoot.querySelector('.close .timer-progress')),
        artworkOnlyInButtons: [...globalThis.__cardRoot.querySelectorAll('svg')].every(
          (svg) => svg.closest('button')
        )
      })
    });
    return result;
  }, tabId);
  expect(controls).toEqual({
    durations: [10_000, 25_000],
    copy: 'Copy',
    ring: true,
    artworkOnlyInButtons: true
  });
  // The replaced error would close after 400ms. Its timer must not close this card.
  await new Promise((resolve) => setTimeout(resolve, 450));
  await expect(article.locator('select-summary-card')).toHaveCount(1);
  await expect(article.locator('select-summary-card')).toHaveCount(0, { timeout: 2000 });
});
