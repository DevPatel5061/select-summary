import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '../chrome-extension/shared/client.js';
import { INTERFACE_VERSION } from '../chrome-extension/core.js';
test('UI client attaches run context and preserves worker error codes', async () => {
  let sent;
  globalThis.chrome = {
    runtime: {
      async sendMessage(message) {
        sent = message;
        return { ok: false, error: { code: 'AUTH', message: 'A safe error' } };
      }
    }
  };
  const request = createClient(() => ({ welcomeRunId: 'current-run' }));
  await assert.rejects(request('CONNECT_KEY', { consent: true }), {
    code: 'AUTH',
    message: 'A safe error'
  });
  assert.deepEqual(sent, {
    type: 'CONNECT_KEY',
    consent: true,
    welcomeRunId: 'current-run'
  });
});
test('UI client rejects incompatible worker state and hides low-level transport errors', async () => {
  globalThis.chrome = {
    runtime: {
      async sendMessage() {
        return { ok: true, interfaceVersion: INTERFACE_VERSION - 1 };
      }
    }
  };
  const request = createClient();
  await assert.rejects(request('GET_STATE'), /Reload Select Summary/);
  chrome.runtime.sendMessage = async () => {
    throw new Error('Low-level details');
  };
  await assert.rejects(request('GET_STATE'), {
    message: 'The extension disconnected. Reload it and try again.'
  });
});
