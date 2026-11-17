import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize, validateApiKey } from '../chrome-extension/gemini.js';
import { wordCount } from '../chrome-extension/core.js';
const response = (text, finishReason = 'STOP') => ({
  candidates: [{ finishReason, content: { parts: [{ text }] } }]
});
test('summary uses one authenticated request without sending source URLs or cookies', async () => {
  let count = 0;
  const text = await summarize('A source paragraph.', 'fake-key', {
    fetcher: async (url, options) => {
      count++;
      assert.equal(options.headers['x-goog-api-key'], 'fake-key');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.referrerPolicy, 'no-referrer');
      assert.equal(
        JSON.parse(options.body).contents[0].parts[0].text,
        'A source paragraph.'
      );
      return Response.json(response('A concise summary.'));
    }
  });
  assert.equal(text, 'A concise summary.');
  assert.equal(count, 1);
});
for (const [status, code] of [
  [400, 'AUTH'],
  [401, 'AUTH'],
  [403, 'AUTH'],
  [404, 'MODEL'],
  [429, 'QUOTA'],
  [500, 'SERVICE']
])
  test(`provider ${status} maps to ${code} without retries`, async () => {
    let count = 0;
    await assert.rejects(
      summarize('Source', 'fake-key', {
        fetcher: async () => {
          count++;
          return new Response('', { status });
        }
      }),
      { code }
    );
    assert.equal(count, 1);
  });
test('network errors and aborts have distinct safe errors', async () => {
  const fetcher = async () => {
    throw new Error('Secret provider details');
  };
  await assert.rejects(summarize('Source', 'key', { fetcher }), {
    code: 'NETWORK'
  });
  await assert.rejects(
    summarize('Source', 'key', { fetcher, signal: AbortSignal.abort() }),
    { code: 'TIMEOUT' }
  );
});
for (const [body, code] of [
  [{ promptFeedback: { blockReason: 'SAFETY' } }, 'INCOMPLETE'],
  [response('Partial', 'MAX_TOKENS'), 'INCOMPLETE'],
  [{}, 'EMPTY_RESPONSE']
])
  test(`unusable provider response: ${code}`, async () => {
    await assert.rejects(
      summarize('Source', 'key', { fetcher: async () => Response.json(body) }),
      { code }
    );
  });
test('invalid JSON is handled and no raw response leaks', async () => {
  await assert.rejects(
    summarize('Source', 'key', {
      fetcher: async () => new Response('not-json')
    }),
    { code: 'RESPONSE' }
  );
});
test('verbose responses are capped locally without repair calls', async () => {
  let count = 0;
  const text = await summarize('Source', 'key', {
    fetcher: async () => {
      count++;
      return Response.json(response(Array(80).fill('word').join(' ')));
    }
  });
  assert.equal(wordCount(text), 35);
  assert(text.endsWith('…'));
  assert.equal(count, 1);
  const complete = await summarize('Source', 'key', {
    fetcher: async () =>
      Response.json(
        response(
          'A complete thought. Another ' + Array(80).fill('word').join(' ')
        )
      )
  });
  assert.equal(complete, 'A complete thought.');
});
test('connection check is one small explicit call, and invalid selections make no calls', async () => {
  let count = 0;
  const fetcher = async (url, options) => {
    count++;
    assert.equal(
      JSON.parse(options.body).contents[0].parts[0].text,
      'Connection check.'
    );
    return Response.json(response('OK'));
  };
  await validateApiKey('key', { fetcher });
  assert.equal(count, 1);
  await assert.rejects(summarize('', 'key', { fetcher }), {
    code: 'NO_SELECTION'
  });
  await assert.rejects(summarize('a'.repeat(50001), 'key', { fetcher }), {
    code: 'INPUT_LIMIT'
  });
  assert.equal(count, 1);
});
