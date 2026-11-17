import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
test('injected listener accepts skeleton loading, suppresses dismissed responses and validates senders', async () => {
  const source = await readFile(
    new URL('../chrome-extension/content.js', import.meta.url),
    'utf8'
  );
  let listener, options;
  const updates = [];
  const host = { isConnected: true, dataset: {} };
  const context = vm.createContext({
    chrome: {
      runtime: {
        id: 'test',
        onMessage: {
          addListener(fn) {
            listener = fn;
          }
        }
      }
    },
    SelectSummaryCard: {
      create(value) {
        options = value;
        return {
          host,
          update(message) {
            updates.push(message);
          }
        };
      }
    }
  });
  vm.runInContext(source, context);
  const sender = { id: 'test' };
  listener({ type: 'SELECT_SUMMARY_CARD', kind: 'loading' }, sender);
  assert.equal(updates.length, 1);
  options.onClose({ kind: 'loading', reason: 'manual' });
  listener(
    { type: 'SELECT_SUMMARY_CARD', kind: 'summary', text: 'Late result' },
    sender
  );
  assert.equal(updates.length, 1);
  listener({ type: 'SELECT_SUMMARY_CARD', kind: 'loading' }, sender);
  assert.equal(updates.length, 2);
  listener({ type: 'SELECT_SUMMARY_CARD', kind: 'summary' }, sender);
  assert.equal(updates.length, 2);
  listener(
    { type: 'SELECT_SUMMARY_CARD', kind: 'summary', text: 'Bad sender' },
    { id: 'other' }
  );
  assert.equal(updates.length, 2);
  listener(
    { type: 'SELECT_SUMMARY_CARD', kind: 'summary', text: 'Good result' },
    sender
  );
  assert.equal(updates.length, 3);
  vm.runInContext(source, context);
  assert.equal(context.__selectSummaryInstalled, true);
});
