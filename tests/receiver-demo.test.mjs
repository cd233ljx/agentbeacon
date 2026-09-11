import test from 'node:test';
import assert from 'node:assert/strict';
import { createReceiverService } from '../receiver/server.mjs';

const instanceId = '11111111-1111-4111-8111-111111111111';

function snapshot(sequence, state) {
  const counts = { blocked: 0, working: 0, unknown: 0, done: 0, idle: 0 };
  counts[state] = 1;
  return {
    protocol_version: 1,
    source_id: 'home-server',
    instance_id: instanceId,
    sequence,
    sent_at: `2026-09-11T09:00:${String(sequence).padStart(2, '0')}.000Z`,
    state,
    cause: 'aggregate',
    counts,
  };
}

async function setup(context) {
  let now = 0;
  const states = [];
  const service = createReceiverService({
    host: '127.0.0.1',
    port: 8787,
    allowedSourceId: 'home-server',
    receiverTimeoutMs: 15_000,
    requestTimeoutMs: 2_000,
    dryRun: true,
    demoEnabled: true,
    wledBaseUrl: 'http://192.168.1.100',
    presets: { idle: 1, working: 2, blocked: 3, done: 4, unknown: 5 },
  }, {
    clock: () => now,
    output: { ensureState: (state) => states.push(state), close() {} },
  });
  await new Promise((resolve) => service.server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise((resolve) => service.server.close(resolve)));
  return {
    service,
    states,
    setNow: (value) => { now = value; },
    url: `http://127.0.0.1:${service.server.address().port}`,
  };
}

async function request(url, path, method, body) {
  const response = await fetch(`${url}${path}`, {
    method,
    ...(body ? {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    } : {}),
  });
  return { response, result: await response.json() };
}

test('Demo switches five states while formal snapshots remain cached', async (context) => {
  const { service, states, url } = await setup(context);
  await request(url, '/v1/state', 'POST', snapshot(1, 'working'));
  for (const state of ['idle', 'working', 'blocked', 'done', 'unknown']) {
    const { response, result } = await request(url, '/state', 'POST', { state });
    assert.equal(response.status, 200);
    assert.deepEqual(result, { demo: true, state });
    assert.equal(service.store.displayedState, state);
  }

  const formal = await request(url, '/v1/state', 'POST', snapshot(2, 'done'));
  assert.equal(formal.result.disposition, 'refreshed');
  assert.equal(service.store.displayedState, 'unknown');
  const exited = await request(url, '/state', 'DELETE');
  assert.deepEqual(exited.result, { demo: false, state: 'done' });
  assert.equal(service.store.displayedState, 'done');
  assert.ok(states.includes('blocked'));
});

test('Demo exit restores unknown when the formal snapshot expired', async (context) => {
  const { service, setNow, url } = await setup(context);
  await request(url, '/v1/state', 'POST', snapshot(1, 'working'));
  await request(url, '/state', 'POST', { state: 'blocked' });
  setNow(15_000);
  assert.equal(service.store.checkTimeout(), true);
  assert.equal(service.store.displayedState, 'blocked');
  const exited = await request(url, '/state', 'DELETE');
  assert.deepEqual(exited.result, { demo: false, state: 'unknown' });
});

test('Demo rejects invalid state and health reports its activity', async (context) => {
  const { url } = await setup(context);
  let result = await request(url, '/state', 'POST', { state: 'rainbow' });
  assert.equal(result.response.status, 422);
  result = await request(url, '/state', 'POST', { state: 'blocked' });
  assert.equal(result.response.status, 200);
  const health = await fetch(`${url}/health`);
  assert.equal((await health.json()).demo_active, true);
});
