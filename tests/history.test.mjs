import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState,
  addSummary,
  migrateState,
  publicState,
  HISTORY_LIMITS,
  VERSION
} from '../chrome-extension/core.js';
test('each history preference caps new summaries and preserves activity', () => {
  for (const limit of HISTORY_LIMITS) {
    let state = { ...initialState(), historyLimit: limit };
    for (let i = 0; i < 25; i++)
      state = addSummary(
        state,
        `Summary ${i}`,
        100,
        1700000000000 + i,
        `id-${i}`
      );
    assert.equal(state.history.length, limit);
    assert.equal(state.history[0].id, 'id-24');
    assert.equal(publicState(state).historyLimit, limit);
    assert.equal(
      Object.values(state.activity).reduce((sum, day) => sum + day.count, 0),
      25
    );
  }
});
test('version 4 migration adds default preference without dropping user data', () => {
  const previous = {
    ...initialState(),
    version: 4,
    key: 'fake-key',
    history: [{ id: 'old', text: 'Saved summary' }]
  };
  delete previous.historyLimit;
  const current = migrateState({ appState: previous });
  assert.equal(current.version, VERSION);
  assert.equal(current.historyLimit, 10);
  assert.deepEqual(current.history, previous.history);
  assert.equal(current.key, previous.key);
});
