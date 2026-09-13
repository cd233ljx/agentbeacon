import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { WledOutput } from '../receiver/wled-output.mjs';

const presets = { idle: 1, working: 2, blocked: 3, done: 4, unknown: 5 };

function fakeResponse(status) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async arrayBuffer() { return new ArrayBuffer(0); },
  };
}

test('WLED output posts preset mapping and does not restart an applied state', async (context) => {
  const requests = [];
  const logs = [];
  const mock = http.createServer(async (request, response) => {
    let body = '';
    request.setEncoding('utf8');
    for await (const chunk of request) body += chunk;
    requests.push({ method: request.method, url: request.url, body: JSON.parse(body) });
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{}');
  });
  await new Promise((resolve) => mock.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise((resolve) => mock.close(resolve)));
  const address = mock.address();
  const output = new WledOutput({
    baseUrl: `http://127.0.0.1:${address.port}`,
    presets,
    retryDelaysMs: [],
    logger: { info: (message) => logs.push(message) },
  });
  context.after(() => output.close());

  output.ensureState('unknown');
  await output.waitForIdle();
  output.ensureState('blocked');
  await output.waitForIdle();
  output.ensureState('blocked');
  await output.waitForIdle();

  assert.deepEqual(logs, [
    'WLED 已应用 state=unknown preset=5',
    'WLED 已应用 state=blocked preset=3',
  ]);
  assert.deepEqual(requests, [
    { method: 'POST', url: '/json/state', body: { ps: 5 } },
    { method: 'POST', url: '/json/state', body: { ps: 3 } },
  ]);
});

test('WLED output retries a bounded cycle and a later heartbeat recovers it', async () => {
  const calls = [];
  const statuses = [503, 503, 503, 200];
  const logs = [];
  const warnings = [];
  const output = new WledOutput({
    baseUrl: 'http://127.0.0.1:1',
    presets,
    retryDelaysMs: [0, 0],
    logger: { info: (message) => logs.push(message), warn: (message) => warnings.push(message) },
    fetchImpl: async (_url, options) => {
      calls.push(JSON.parse(options.body));
      return fakeResponse(statuses.shift());
    },
  });

  output.ensureState('working');
  await output.waitForIdle();
  assert.equal(calls.length, 3);
  assert.deepEqual(logs, []);
  assert.equal(warnings.length, 3);
  output.ensureState('working');
  await output.waitForIdle();
  assert.deepEqual(calls, [{ ps: 2 }, { ps: 2 }, { ps: 2 }, { ps: 2 }]);
  assert.deepEqual(logs, ['WLED 已应用 state=working preset=2']);
  output.ensureState('working');
  await output.waitForIdle();
  assert.equal(logs.length, 1);
  assert.equal(calls.length, 4);
  output.close();
});

test('a new desired state cancels retries for the old state', async () => {
  const calls = [];
  let notifyFailure;
  const firstFailure = new Promise((resolve) => { notifyFailure = resolve; });
  const output = new WledOutput({
    baseUrl: 'http://127.0.0.1:1',
    presets,
    retryDelaysMs: [10_000],
    logger: { info() {}, warn() { notifyFailure(); } },
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      calls.push(body);
      return fakeResponse(body.ps === 2 ? 503 : 200);
    },
  });

  output.ensureState('working');
  await firstFailure;
  output.ensureState('done');
  await output.waitForIdle();
  assert.deepEqual(calls, [{ ps: 2 }, { ps: 4 }]);
  output.close();
});
