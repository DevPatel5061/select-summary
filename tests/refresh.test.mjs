import test from 'node:test';
import assert from 'node:assert/strict';
import { createRefreshQueue } from '../chrome-extension/shared/refresh.js';
import { timeline, TIMING } from '../chrome-extension/shared/timeline.js';
const tick = () => new Promise((r) => setTimeout(r, 5));
test('same-task refreshes coalesce into one read', async () => {
  let reads = 0;
  const q = createRefreshQueue(async () => {
    reads++;
  });
  await Promise.all([q.refresh(), q.refresh(), q.refresh()]);
  assert.equal(reads, 1);
});
test('storage events during a mutation await one final snapshot', async () => {
  let reads = 0,
    release;
  const q = createRefreshQueue(async () => {
    reads++;
  });
  let event;
  const pending = q.mutate(async () => {
    event = q.refresh();
    await new Promise((r) => {
      release = r;
    });
  });
  await tick();
  assert.equal(reads, 0);
  release();
  await Promise.all([pending, event]);
  assert.equal(reads, 1);
});
test('changes during a read trigger one subsequent read and failures recover', async () => {
  let reads = 0,
    release;
  const q = createRefreshQueue(async () => {
    reads++;
    if (reads === 1)
      await new Promise((r) => {
        release = r;
      });
    if (reads === 3) throw new Error('Read failed');
  });
  const first = q.refresh();
  while (!release) await tick();
  const second = q.refresh();
  release();
  await Promise.all([first, second]);
  assert.equal(reads, 2);
  await assert.rejects(q.refresh(), /Read failed/);
  await q.refresh();
  assert.equal(reads, 4);
});
test('scene durations derive from the actions that actually run', async () => {
  const calls = [];
  const scene = timeline([
    ['wait', 30],
    ['move', '#target'],
    ['type', '#name', 'abc'],
    ['press', '#target'],
    () => calls.push('action')
  ]);
  assert.equal(
    scene.duration,
    30 +
      TIMING.move +
      3 * TIMING.character +
      TIMING.hover +
      TIMING.down +
      TIMING.release
  );
  const api = Object.fromEntries(
    ['wait', 'move', 'type', 'press'].map((key) => [
      key,
      async () => calls.push(key)
    ])
  );
  await scene.run(api);
  assert.deepEqual(calls, ['wait', 'move', 'type', 'press', 'action']);
});
