import test from 'node:test';
import assert from 'node:assert/strict';
import { createProbeServer } from '../scripts/termux-receiver-probe.mjs';

test('standalone Termux probe accepts an AgentBeacon v1 state', async (context) => {
  const observed = [];
  const server = createProbeServer({ sourceId: 'home-server', onState: (line) => observed.push(line) });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/v1/state`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      protocol_version: 1,
      source_id: 'home-server',
      instance_id: '11111111-1111-4111-8111-111111111111',
      sequence: 1,
      sent_at: '2026-09-11T00:00:00.000Z',
      state: 'working',
      cause: 'aggregate',
      counts: { blocked: 0, working: 1, unknown: 0, done: 0, idle: 0 },
    }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).disposition, 'applied');
  assert.deepEqual(observed, ['STATE working sequence=1']);
});
