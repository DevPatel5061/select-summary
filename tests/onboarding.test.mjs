import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../chrome-extension/core.js';
import { DEMO_ARTICLES } from '../chrome-extension/demo-articles.js';
const local = {
  appState: { ...initialState(), key: 'test-key', keyValidated: true }
};
const session = {};
const area = (data) => ({
  async get(keys) {
    return Object.fromEntries(
      (Array.isArray(keys) ? keys : [keys]).map((key) => [
        key,
        structuredClone(data[key])
      ])
    );
  },
  async set(value) {
    Object.assign(data, structuredClone(value));
  },
  async remove(keys) {
    for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key];
  },
  async setAccessLevel() {}
});
let listener;
const event = { addListener() {} };
globalThis.chrome = {
  storage: { local: area(local), session: area(session) },
  runtime: {
    id: 'test-extension',
    getURL: (page) => `chrome-extension://test-extension/${page}`,
    onInstalled: event,
    onMessage: {
      addListener(fn) {
        listener = fn;
      }
    }
  },
  tabs: { onRemoved: event },
  contextMenus: { onClicked: event },
  commands: { onCommand: event },
  action: { async setBadgeText() {} }
};
let status = 200;
let release;
let delayed = false;
globalThis.fetch = async () => {
  if (delayed)
    await new Promise((resolve) => {
      release = resolve;
    });
  return new Response(
    JSON.stringify({
      candidates: [
        {
          finishReason: 'STOP',
          content: {
            parts: [{ text: 'Toronto is a diverse city on Lake Ontario.' }]
          }
        }
      ]
    }),
    { status }
  );
};
await import('../chrome-extension/background.js');
const sender = (tabId) => ({
  id: chrome.runtime.id,
  url: chrome.runtime.getURL('welcome.html'),
  tab: { id: tabId }
});
const send = (type, id, fields = {}, tab = 7) =>
  new Promise((resolve) =>
    listener({ type, welcomeRunId: id, ...fields }, sender(tab), resolve)
  );
const summary = (id, tab = 7) =>
  send(
    'SUMMARIZE_DEMO',
    id,
    {
      articleId: 'toronto',
      selection: DEMO_ARTICLES.toronto.text,
      requestId: crypto.randomUUID()
    },
    tab
  );
const a = 'walkthrough-session-a';
const b = 'walkthrough-session-b';
test('practice gates, failures, replay, tab isolation and late responses', async () => {
  assert.equal((await send('BEGIN_WELCOME', a)).ok, true);
  assert.equal((await send('SET_WELCOME_STEP', a, { step: 3 })).ok, false);
  assert.equal((await send('FINISH_WELCOME', a)).ok, false);
  status = 403;
  assert.equal((await summary(a)).ok, false);
  assert.equal((await send('FINISH_WELCOME', a)).ok, false);
  assert.equal(local.appState.history.length, 0);
  status = 200;
  assert.equal((await summary(a)).ok, true);
  assert.equal((await send('SET_WELCOME_STEP', a, { step: 3 })).ok, true);
  assert.equal((await send('FINISH_WELCOME', a)).ok, true);
  assert.equal((await send('BEGIN_WELCOME', b)).ok, true);
  assert.equal((await send('FINISH_WELCOME', b)).ok, false);
  assert.equal(local.appState.key, 'test-key');
  assert.equal(local.appState.history.length, 1);
  assert.equal((await send('FINISH_WELCOME', a)).ok, false);
  assert.equal((await send('FINISH_WELCOME', b, {}, 8)).ok, false);
  delayed = true;
  const pending = summary(b);
  while (!release) await new Promise((resolve) => setTimeout(resolve, 0));
  const fresh = 'walkthrough-session-fresh';
  await send('BEGIN_WELCOME', fresh);
  release();
  assert.equal((await pending).ok, true);
  assert.equal((await send('FINISH_WELCOME', fresh)).ok, false);
  assert.equal(local.appState.history.length, 2);
  delayed = false;
  assert.equal((await summary(fresh)).ok, true);
  assert.equal((await send('FINISH_WELCOME', fresh)).ok, true);
});
