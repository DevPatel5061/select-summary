import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, activityStats } from '../chrome-extension/core.js';

function event() {
  return { listeners: [], addListener(listener) { this.listeners.push(listener); } };
}
let local = {}, session = {}, messages = [], calls = [], badge = '', selection = '';
let providerStatus = 200, providerGate = null, injectionBlocked = false;
const storageArea = (read, write) => ({
  async setAccessLevel() {},
  async get(keys) { return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter(key => key in read()).map(key => [key, structuredClone(read()[key])])); },
  async set(values) { write({ ...read(), ...structuredClone(values) }); },
  async remove(keys) { const data = { ...read() }; for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key]; write(data); }
});
globalThis.chrome = {
  runtime: { id: 'test-extension', getURL: path => `chrome-extension://test-extension/${path}`, onInstalled: event(), onMessage: event() },
  storage: { local: storageArea(() => local, value => { local = value; }), session: storageArea(() => session, value => { session = value; }) },
  contextMenus: { onClicked: event(), removeAll(callback) { callback(); }, create() {} },
  commands: { onCommand: event() },
  action: { async setBadgeText({ text }) { badge = text; }, async setBadgeBackgroundColor() {}, async openPopup() {} },
  tabs: { async query() { return [{ id: 1, url: 'https://example.test' }]; }, async sendMessage(tabId, payload) { if (injectionBlocked) throw new Error('Cannot inject'); messages.push({ tabId, ...payload }); } },
  scripting: { async executeScript(options) { if (injectionBlocked) throw new Error('Protected page'); return options.func ? [{ result: selection }] : []; } }
};
globalThis.fetch = async (url, options) => {
  calls.push({ url, options });
  if (providerGate) await providerGate;
  if (providerStatus !== 200) return new Response('private-provider-error', { status: providerStatus });
  return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'A short synthetic summary.' }] } }] }));
};
await import('../chrome-extension/background.js');
const trusted = { id: chrome.runtime.id, url: chrome.runtime.getURL('popup.html') };
function send(message, sender = trusted) {
  return new Promise(resolve => {
    const accepted = chrome.runtime.onMessage.listeners[0](message, sender, resolve);
    if (!accepted) resolve(undefined);
  });
}
async function waitFor(predicate) {
  for (let attempts = 0; attempts < 300; attempts++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 2));
  }
  assert.fail('Background operation did not finish');
}
function click(text, id = 1) {
  chrome.contextMenus.onClicked.listeners[0]({ menuItemId: 'summarize-selection', selectionText: text }, { id, url: 'https://example.test' });
}

beforeEach(() => {
  local = { appState: { ...initialState(), key: 'synthetic-existing-key' } };
  session = {}; messages = []; calls = []; badge = ''; selection = '';
  providerStatus = 200; providerGate = null; injectionBlocked = false;
});

test('worker denies content-script and external-page requests', async () => {
  assert.equal(await send({ type: 'RESET_ALL' }, { id: chrome.runtime.id, url: 'https://example.test', tab: { id: 1 } }), undefined);
  assert.equal(await send({ type: 'GET_STATE' }, { id: 'other', url: trusted.url }), undefined);
  assert.equal(local.appState.key, 'synthetic-existing-key');
  const result = await send({ type: 'GET_STATE' });
  assert(result.ok);
  assert(!JSON.stringify(result).includes('synthetic-existing-key'));
});

test('worker validates messages and consent without sending API requests', async () => {
  for (const message of [{ type: 'UNKNOWN' }, { type: 'SET_ONBOARDING', step: 8 }, { type: 'CONNECT_KEY', key: 'synthetic-key', consent: false }, { type: 'CONNECT_KEY', key: 'has whitespace', consent: true }]) assert.equal((await send(message)).ok, false);
  assert.equal(calls.length, 0);
});

test('connection tests save only successful keys and do not count as activity', async () => {
  providerStatus = 403;
  assert.equal((await send({ type: 'CONNECT_KEY', key: 'synthetic-replacement', consent: true })).ok, false);
  assert.equal(local.appState.key, 'synthetic-existing-key');
  providerStatus = 200;
  const result = await send({ type: 'CONNECT_KEY', key: 'synthetic-replacement', consent: true });
  assert(result.ok);
  assert.equal(result.sample, 'A short synthetic summary.');
  assert.equal(local.appState.key, 'synthetic-replacement');
  assert.deepEqual(local.appState.history, []);
  assert.deepEqual(local.appState.activity, {});
});

test('context-menu summaries are saved once with counts, without source text', async () => {
  const source = 'Unique original source that must never persist in local storage.';
  click(source);
  click(source);
  await waitFor(() => session.notice?.level === 'success');
  assert.equal(calls.length, 1);
  assert.equal(local.appState.history.length, 1);
  assert.equal(activityStats(local.appState.activity).total, 1);
  assert(!JSON.stringify(local).includes(source));
  assert(messages.some(message => message.kind === 'loading'));
  assert(messages.some(message => message.kind === 'summary'));
});

test('simultaneous summaries from different tabs cannot overwrite each other', async () => {
  click('First source.', 1);
  click('Second source.', 2);
  await waitFor(() => local.appState.history.length === 2 && messages.filter(message => message.kind === 'summary').length === 2);
  assert.equal(activityStats(local.appState.activity).total, 2);
});

test('injection failures preserve generated summaries and surface a fallback notice', async () => {
  injectionBlocked = true;
  click('Synthetic source.');
  await waitFor(() => session.notice?.level === 'info');
  assert.equal(local.appState.history.length, 1);
  assert.equal(session.notice.title, 'Saved to your history');
  assert.equal(badge, '1');
});

test('missing keys and empty selection never call Gemini or create history', async () => {
  local.appState.key = null;
  click('Synthetic source.');
  await waitFor(() => session.notice?.level === 'error');
  assert.match(session.notice.message, /connect your Gemini key/);
  assert.equal(calls.length, 0);
  assert.equal(badge, '!');
  session = {};
  await chrome.commands.onCommand.listeners[0]('summarize-selection');
  assert.equal(calls.length, 0);
  assert.match(session.notice.message, /Highlight some text/);
});

test('quota failures surface guidance without adding activity or provider details', async () => {
  providerStatus = 429;
  click('Synthetic source.');
  await waitFor(() => session.notice?.level === 'error');
  assert.match(session.notice.message, /quota/);
  assert(!JSON.stringify(session).includes('private-provider-error'));
  assert.deepEqual(local.appState.history, []);
});

test('resetting during a summary prevents the in-flight result from restoring history', async () => {
  let release;
  providerGate = new Promise(resolve => { release = resolve; });
  click('Synthetic source.');
  await waitFor(() => calls.length === 1);
  await send({ type: 'RESET_ALL' });
  release();
  await waitFor(() => session.notice?.level === 'error');
  assert.equal(local.appState.key, null);
  assert.deepEqual(local.appState.history, []);
  assert.deepEqual(local.appState.activity, {});
});

test('removing a key cancels a pending connection test', async () => {
  let release;
  providerGate = new Promise(resolve => { release = resolve; });
  const pending = send({ type: 'CONNECT_KEY', key: 'synthetic-new-key', consent: true });
  await waitFor(() => calls.length === 1);
  await send({ type: 'REMOVE_KEY' });
  release();
  const result = await pending;
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'CANCELLED');
  assert.equal(local.appState.key, null);
});

test('protected-page keyboard failures surface useful guidance', async () => {
  injectionBlocked = true;
  await chrome.commands.onCommand.listeners[0]('summarize-selection');
  assert.equal(session.notice.title, 'This page is protected');
  assert.equal(calls.length, 0);
});
