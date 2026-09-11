import test from 'node:test';
import assert from 'node:assert/strict';
import { createReceiverService } from '../receiver/server.mjs';

const instanceId = '11111111-1111-4111-8111-111111111111';

function config() {
  return {
    host: '127.0.0.1',
    port: 8787,
    allowedSourceId: 'home-server',
    receiverTimeoutMs: 15_000,
    requestTimeoutMs: 2_000,
    dryRun: true,
    demoEnabled: false,
    wledBaseUrl: 'http://192.168.1.100',
    presets: { idle: 1, working: 2, blocked: 3, done: 4, unknown: 5 },
  };
}

function snapshot(overrides = {}) {
  return {
    protocol_version: 1,
    source_id: 'home-server',
    instance_id: instanceId,
    sequence: 1,
    sent_at: '2026-09-11T08:00:00.000Z',
    state: 'working',
    cause: 'aggregate',
    counts: { blocked: 0, working: 1, unknown: 0, done: 0, idle: 0 },
    ...overrides,
  };
}

async function setup(context) {
  const states = [];
  const output = {
    ensureState: (state) => states.push(state),
    close() {},
  };
  const service = createReceiverService(config(), { output });
  await new Promise((resolve) => service.server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise((resolve) => service.server.close(resolve)));
  const address = service.server.address();
  return { service, states, url: `http://127.0.0.1:${address.port}` };
}

async function post(url, value, headers = { 'content-type': 'application/json' }) {
  return fetch(`${url}/v1/state`, {
    method: 'POST',
    headers,
    body: typeof value === 'string' ? value : JSON.stringify(value),
  });
}

test('Receiver accepts valid snapshots and exposes aggregate-only health', async (context) => {
  const { states, url } = await setup(context);
  const first = await post(url, snapshot());
  assert.equal(first.status, 200);
  assert.equal((await first.json()).disposition, 'applied');

  const second = await post(url, snapshot({
    sequence: 2,
    sent_at: '2026-09-11T08:00:05.000Z',
  }));
  assert.equal((await second.json()).disposition, 'refreshed');
  assert.deepEqual(states, ['unknown', 'working', 'working']);

  const health = await fetch(`${url}/health`);
  assert.deepEqual(await health.json(), {
    protocol_version: 1,
    status: 'ok',
    state: 'working',
    timed_out: false,
    dry_run: true,
    demo_active: false,
  });
});

test('Receiver enforces content type, body limit, source and sequence conflicts', async (context) => {
  const { url } = await setup(context);
  let response = await post(url, '{}', { 'content-type': 'text/plain' });
  assert.equal(response.status, 415);

  response = await post(url, `${' '.repeat(4_097)}`);
  assert.equal(response.status, 413);

  response = await post(url, snapshot({ source_id: 'other-server' }));
  assert.equal(response.status, 403);

  response = await post(url, snapshot());
  assert.equal(response.status, 200);
  response = await post(url, snapshot({ sent_at: '2026-09-11T09:00:00.000Z' }));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'sequence_conflict');
});

test('Receiver rejects malformed JSON and keeps Demo endpoint disabled', async (context) => {
  const { url } = await setup(context);
  let response = await post(url, '{');
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'invalid_json');

  response = await fetch(`${url}/state`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"state":"blocked"}',
  });
  assert.equal(response.status, 404);
});
