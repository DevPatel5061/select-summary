import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState,
  migrateState,
  VERSION
} from '../chrome-extension/core.js';
import { createStore } from '../chrome-extension/storage.js';
import { memoryStorage } from './fixtures/storage.mjs';
for (const version of [3, 4, 5])
  test(`schema ${version} migration preserves user data and removes obsolete fields`, () => {
    const previous = {
      ...initialState(),
      version,
      key: 'saved-key',
      keyValidated: true,
      credentialRevision: 4,
      history: [{ id: 'a', text: 'Saved' }],
      historyLimit: 15,
      activity: { '2026-11-17': { count: 4, secondsSaved: 100 } },
      onboarding: {
        version: 1,
        step: 3,
        completed: true,
        sandboxComplete: true
      },
      milestones: { firstSummary: true },
      tutorialComplete: true
    };
    const next = migrateState({ appState: previous });
    assert.equal(next.version, VERSION);
    assert.equal(next.key, previous.key);
    assert.equal(next.credentialRevision, 4);
    assert.equal(next.historyLimit, 15);
    assert.deepEqual(next.history, previous.history);
    assert.deepEqual(next.activity, previous.activity);
    assert.deepEqual(next.onboarding, { completed: true });
    assert.equal('milestones' in next, false);
    assert.equal('tutorialComplete' in next, false);
  });
test('legacy migration retains key and valid summaries without inventing activity', () => {
  const next = migrateState({
    geminiApiKey: ' saved-key ',
    summaries: ['Saved', { text: 'Other', timestamp: 1700000000000 }, null]
  });
  assert.equal(next.key, 'saved-key');
  assert.equal(next.history.length, 2);
  assert.equal(next.onboarding.completed, true);
  assert.deepEqual(next.activity, {});
});
test('unsupported future schema is rejected instead of overwritten', () => {
  assert.throws(() => migrateState({ appState: { version: 999 } }), {
    code: 'VERSION'
  });
});
test('store initializes with one read, skips absent legacy cleanup and returns isolated snapshots', async () => {
  const storage = memoryStorage({ appState: initialState() });
  const store = createStore(storage);
  const state = await store.read();
  assert.equal(storage.calls.get, 1);
  assert.equal(storage.calls.set, 0);
  assert.equal(storage.calls.remove, 0);
  state.history.push('outside');
  assert.equal((await store.read()).history.length, 0);
});
test('store serializes concurrent writes, recovers after rejection and cleans legacy keys', async () => {
  const storage = memoryStorage({
    geminiApiKey: 'old-key',
    summaries: ['Saved']
  });
  const store = createStore(storage);
  await Promise.all(
    Array.from({ length: 12 }, () =>
      store.update((s) => ({
        ...s,
        credentialRevision: s.credentialRevision + 1
      }))
    )
  );
  assert.equal((await store.read()).credentialRevision, 12);
  assert.equal(storage.calls.access, 1);
  assert.equal(storage.calls.remove, 1);
  assert.equal('geminiApiKey' in storage.data, false);
  await assert.rejects(
    store.update(() => {
      throw new Error('Failed transform');
    })
  );
  assert.equal((await store.read()).history.length, 1);
});
