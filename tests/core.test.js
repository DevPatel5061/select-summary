import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, migrateState, addSummary, activityStats, dayKey, shiftDay, wordCount, publicState, isPopupSender, validateSelection } from '../chrome-extension/core.js';
import { createStore } from '../chrome-extension/storage.js';

const noon = day => new Date(`${day}T12:00:00`);

test('legacy migration preserves keys and text without fabricating dates or activity', () => {
  const state = migrateState({ geminiApiKey: 'synthetic-key', summaries: ['First', { text: 'Second', timestamp: 1234 }, null, '', { text: 'Third', timestamp: 'bad' }] });
  assert.equal(state.key, 'synthetic-key');
  assert.equal(state.history.length, 3);
  assert.equal(state.history[0].timestamp, null);
  assert.equal(state.history[1].timestamp, 1234);
  assert.equal(state.history[2].timestamp, null);
  assert.deepEqual(state.activity, {});
  assert.equal(migrateState({ appState: state }), state);
});

test('migration caps history and rejects malformed legacy text', () => {
  assert.equal(migrateState({ summaries: Array(20).fill('Summary') }).history.length, 10);
  assert.deepEqual(migrateState({ summaries: {} }).history, []);
  assert.equal(migrateState({ geminiApiKey: 123 }).key, null);
});

test('Unicode word counts work beyond whitespace-delimited text', () => {
  assert.equal(wordCount('A short, clear summary.'), 4);
  assert(wordCount('日本語の文章を要約します') > 1);
});

test('only successful summary insertion changes statistics; history pruning preserves totals', () => {
  let state = initialState();
  for (let index = 0; index < 12; index++) state = addSummary(state, 'Short summary.', 227, noon('2026-11-16').getTime(), `id-${index}`);
  assert.equal(state.history.length, 10);
  assert.equal(state.history[0].id, 'id-11');
  assert.equal(activityStats(state.activity, noon('2026-11-16')).total, 12);
  assert.equal(state.activity['2026-11-16'].secondsSaved, 720);
  assert.equal(addSummary(state, 'Duplicate.', 10, Date.now(), 'id-11'), state);
  assert.equal(activityStats({ ...state.activity }).bestDay, 12);
  assert.equal(activityStats(state.activity).secondsSaved, activityStats({ ...state.activity }).secondsSaved);
});

test('time saved never goes negative and clearing history preserves activity', () => {
  const state = addSummary(initialState(), 'A longer summary than the source.', 1, Date.now(), 'one');
  assert.equal(activityStats(state.activity).secondsSaved, 0);
  const cleared = { ...state, history: [] };
  assert.equal(activityStats(cleared.activity).total, 1);
});

test('streaks span month/year and daylight-saving boundaries using calendar days', () => {
  for (const pair of [['2026-12-31', '2027-01-01'], ['2026-03-07', '2026-03-08'], ['2026-10-31', '2026-11-01']]) {
    const activity = Object.fromEntries(pair.map(day => [day, { count: 1, secondsSaved: 1 }]));
    assert.equal(activityStats(activity, noon(pair[1])).currentStreak, 2);
    assert.equal(activityStats(activity, shiftDay(noon(pair[1]), 1)).currentStreak, 2);
    assert.equal(activityStats(activity, shiftDay(noon(pair[1]), 2)).currentStreak, 0);
    assert.equal(activityStats(activity, noon(pair[1])).bestStreak, 2);
    assert.equal(dayKey(shiftDay(noon(pair[0]), 1)), pair[1]);
  }
});

test('empty activity has zero statistics and gaps break streaks', () => {
  assert.deepEqual(activityStats({}), { total: 0, today: 0, secondsSaved: 0, bestDay: 0, currentStreak: 0, bestStreak: 0 });
  const activity = { '2026-11-10': { count: 5, secondsSaved: 3 }, '2026-11-12': { count: 1, secondsSaved: 2 } };
  assert.equal(activityStats(activity, noon('2026-11-12')).bestStreak, 1);
  assert.equal(activityStats(activity, noon('2026-11-12')).today, 1);
});

test('public state never exposes the stored key', () => {
  const state = { ...initialState(), key: 'synthetic-private-key-abcd' };
  const exposed = publicState(state);
  assert.equal(exposed.keySuffix, 'abcd');
  assert.equal(exposed.keyConfigured, true);
  assert(!JSON.stringify(exposed).includes(state.key));
  assert(!('key' in exposed));
});

test('messages are accepted only from the exact extension UI', () => {
  const runtime = { id: 'extension-id', getURL: path => `chrome-extension://extension-id/${path}` };
  assert(isPopupSender({ id: runtime.id, url: runtime.getURL('popup.html') }, runtime));
  for (const url of ['https://example.com/popup.html', runtime.getURL('content.js'), 'chrome-extension://other/popup.html']) assert(!isPopupSender({ id: runtime.id, url }, runtime));
  assert(!isPopupSender({ id: 'other', url: runtime.getURL('popup.html') }, runtime));
});

test('empty and oversized selections are rejected before any request', () => {
  for (const value of ['', '  ', null, 123]) assert.throws(() => validateSelection(value), { code: 'NO_SELECTION' });
  assert.throws(() => validateSelection('x'.repeat(50_001)), { code: 'INPUT_LIMIT' });
  assert.equal(validateSelection(' x '), 'x');
});

function fakeStorage(seed = {}) {
  let data = structuredClone(seed);
  const calls = [];
  let failNextWrite = false;
  return {
    calls,
    failWrite() { failNextWrite = true; },
    async setAccessLevel(value) { calls.push(value); },
    async get(keys) {
      await new Promise(resolve => setTimeout(resolve, 1));
      return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter(key => key in data).map(key => [key, structuredClone(data[key])]));
    },
    async set(values) {
      if (failNextWrite) { failNextWrite = false; throw new Error('Storage unavailable'); }
      data = { ...data, ...structuredClone(values) };
    },
    async remove(keys) { for (const key of keys) delete data[key]; }
  };
}

test('storage locks down access before migration and serializes concurrent saves', async () => {
  const storage = fakeStorage({ geminiApiKey: 'synthetic-key', summaries: ['Legacy'] });
  const store = createStore(storage);
  await Promise.all(Array.from({ length: 20 }, (_, index) => store.update(state => addSummary(state, 'Summary.', 226, Date.now(), `new-${index}`))));
  const state = await store.read();
  assert.deepEqual(storage.calls, [{ accessLevel: 'TRUSTED_CONTEXTS' }]);
  assert.equal(activityStats(state.activity).total, 20);
  assert.equal(state.history.length, 10);
  assert.equal(state.key, 'synthetic-key');
  assert.deepEqual(await storage.get(['geminiApiKey', 'summaries']), {});
});

test('failed storage writes do not poison the queue or destroy legacy data', async () => {
  const storage = fakeStorage({ summaries: ['Keep this'] });
  const store = createStore(storage);
  storage.failWrite();
  await assert.rejects(store.read());
  assert.deepEqual((await storage.get('summaries')).summaries, ['Keep this']);
  assert.equal((await store.read()).history[0].text, 'Keep this');
  storage.failWrite();
  await assert.rejects(store.update(state => ({ ...state, history: [] })));
  assert.equal((await store.read()).history.length, 1);
});
