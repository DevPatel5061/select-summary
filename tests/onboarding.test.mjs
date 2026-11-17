import test from 'node:test';
import assert from 'node:assert/strict';
import { workerFixture } from './fixtures/worker.mjs';
const run = 'walkthrough-session-a';

test('practice is required for Ready, completion and popup opening', async () => {
  const f = await workerFixture();
  await f.send('BEGIN_WELCOME', run);
  for (const [type, fields] of [
    ['SET_WELCOME_STEP', { step: 3 }],
    ['FINISH_WELCOME', {}],
    ['OPEN_TOOLBAR_POPUP', {}]
  ])
    assert.equal((await f.send(type, run, fields)).error.code, 'SANDBOX');
  assert.equal(f.calls.popup.length, 0);
});
test('failed practice does not save history or unlock completion', async () => {
  const f = await workerFixture();
  await f.send('BEGIN_WELCOME', run);
  f.settings.status = 403;
  assert.equal((await f.summary(run)).error.code, 'AUTH');
  assert.equal((await f.send('FINISH_WELCOME', run)).ok, false);
  assert.equal(f.local.appState.history.length, 0);
});
test('successful practice can finish and open the native toolbar popup', async () => {
  const f = await workerFixture();
  await f.send('BEGIN_WELCOME', run);
  assert.equal((await f.summary(run)).ok, true);
  assert.equal((await f.send('SET_WELCOME_STEP', run, { step: 3 })).ok, true);
  assert.equal((await f.send('FINISH_WELCOME', run)).ok, true);
  assert.equal((await f.send('OPEN_TOOLBAR_POPUP', run)).ok, true);
  assert.deepEqual(f.calls.popup, [{ windowId: 99 }]);
  assert.deepEqual(f.calls.closed, [7]);
});
test('replay and tab isolation keep a new walkthrough locked', async () => {
  const f = await workerFixture();
  await f.send('BEGIN_WELCOME', run);
  await f.summary(run);
  const fresh = 'walkthrough-session-fresh';
  await f.send('BEGIN_WELCOME', fresh);
  for (const [id, tab] of [
    [run, 7],
    [fresh, 7],
    [fresh, 8]
  ])
    assert.equal((await f.send('FINISH_WELCOME', id, {}, tab)).ok, false);
  assert.equal(f.local.appState.key, 'test-key');
  assert.equal(f.local.appState.history.length, 1);
});
test('late practice saves a result without unlocking a restarted run', async () => {
  const f = await workerFixture();
  await f.send('BEGIN_WELCOME', run);
  let release;
  f.settings.delay = new Promise((resolve) => {
    release = resolve;
  });
  const pending = f.summary(run);
  while (!f.calls.provider) await new Promise((r) => setTimeout(r, 0));
  const fresh = 'walkthrough-session-fresh';
  await f.send('BEGIN_WELCOME', fresh);
  release();
  assert.equal((await pending).ok, true);
  assert.equal((await f.send('FINISH_WELCOME', fresh)).ok, false);
  assert.equal(f.local.appState.history.length, 1);
});
test('popup failure preserves the guide, including the single-tab case', async () => {
  const f = await workerFixture();
  await f.send('BEGIN_WELCOME', run);
  await f.summary(run);
  await f.send('FINISH_WELCOME', run);
  f.settings.popupFails = true;
  assert.equal((await f.send('OPEN_TOOLBAR_POPUP', run)).error.code, 'POPUP');
  assert.deepEqual(f.calls.closed, []);
  f.settings.tabs = [{ id: 7 }];
  assert.equal((await f.send('OPEN_TOOLBAR_POPUP', run)).error.code, 'POPUP');
  assert.deepEqual(f.calls.closed, [9]);
  f.settings.popupFails = false;
  await f.send('OPEN_TOOLBAR_POPUP', run);
  assert.equal(f.calls.closed.at(-1), 7);
  assert.equal(f.calls.created.length, 2);
});
test('repeated demo request IDs reuse saved output without another provider call', async () => {
  const f = await workerFixture();
  await f.send('BEGIN_WELCOME', run);
  const fields = { requestId: 'summary-request-stable' };
  await f.summary(run, fields);
  await f.summary(run, fields);
  assert.equal(f.calls.provider, 1);
  assert.equal(f.local.appState.history.length, 1);
});
test('disconnect cancels late summary and connection writes', async () => {
  for (const mode of ['summary', 'connection']) {
    const f = await workerFixture();
    await f.send('BEGIN_WELCOME', run);
    let release;
    f.settings.delay = new Promise((r) => {
      release = r;
    });
    const pending =
      mode === 'summary'
        ? f.summary(run)
        : f.send('CONNECT_KEY', run, { key: 'replacement-key', consent: true });
    while (!f.calls.provider) await new Promise((r) => setTimeout(r, 0));
    await f.send('REMOVE_KEY', run);
    release();
    assert.equal((await pending).error.code, 'CANCELLED');
    assert.equal(f.local.appState.key, null);
    assert.equal(f.local.appState.history.length, 0);
  }
});
test('history preferences retain newest entries and preserve aggregates', async () => {
  const f = await workerFixture();
  f.local.appState.history = Array.from({ length: 16 }, (_, i) => ({
    id: `saved-${i}`,
    text: 'Saved summary'
  }));
  const activity = structuredClone(f.local.appState.activity);
  for (const limit of [20, 15, 10, 5]) {
    assert.equal((await f.send('SET_HISTORY_LIMIT', run, { limit })).ok, true);
    assert.equal(f.local.appState.history.length, Math.min(16, limit));
    assert.equal(f.local.appState.history[0].id, 'saved-0');
  }
  assert.deepEqual(f.local.appState.activity, activity);
  for (const limit of [0, 6, 21, '10', null])
    assert.equal((await f.send('SET_HISTORY_LIMIT', run, { limit })).ok, false);
});
test('state reads exclude obsolete fields and do not request shortcut metadata; step changes do not write', async () => {
  const f = await workerFixture();
  await f.send('BEGIN_WELCOME', run);
  const writes = f.storage.calls.set;
  await f.send('SET_WELCOME_STEP', run, { step: 2 });
  assert.equal(f.storage.calls.set, writes);
  const result = await f.send('GET_STATE');
  assert.equal(result.interfaceVersion, 4);
  assert.equal('xp' in result.state, false);
  assert.equal('milestones' in result.state, false);
  assert.equal(f.calls.metadata, 0);
  await f.send('GET_METADATA');
  assert.equal(f.calls.metadata, 2);
});
test('untrusted senders cannot manage local data', async () => {
  const f = await workerFixture();
  let responded = false;
  assert.equal(
    f.messages.listeners[0](
      { type: 'RESET_ALL' },
      { id: 'another-extension', url: 'https://example.com' },
      () => {
        responded = true;
      }
    ),
    false
  );
  assert.equal(responded, false);
  assert.equal(f.local.appState.key, 'test-key');
});
