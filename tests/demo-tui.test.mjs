import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMO_KEYS,
  createDemoSnapshot,
  demoStateForKey,
  parseDemoArguments,
  postDemoState,
} from '../scripts/demo-tui.mjs';

test('Demo TUI maps 1-5 to the five display states', () => {
  assert.deepEqual(Object.keys(DEMO_KEYS), ['1', '2', '3', '4', '5']);
  assert.deepEqual(
    ['1', '2', '3', '4', '5'].map(demoStateForKey),
    ['idle', 'working', 'blocked', 'done', 'unknown'],
  );
  assert.equal(demoStateForKey('x'), null);
});

test('Demo TUI builds a valid manual v1 snapshot', () => {
  const snapshot = createDemoSnapshot({
    sourceId: 'home-server',
    instanceId: '6eb708b7-eb87-4673-b2ef-82983833bfa7',
    sequence: 2,
    state: 'blocked',
    now: new Date('2026-09-11T08:00:00.000Z'),
  });
  assert.equal(snapshot.state, 'blocked');
  assert.equal(snapshot.counts.blocked, 1);
  assert.equal(snapshot.counts.working, 0);
  assert.equal(snapshot.sent_at, '2026-09-11T08:00:00.000Z');
});

test('Demo TUI requires a concrete phone v1 endpoint', () => {
  assert.throws(() => parseDemoArguments([]), /--url/);
  assert.throws(() => parseDemoArguments(['--url', 'http://phone:8787/state']), /v1\/state/);
  const options = parseDemoArguments([
    '--url', 'http://100.91.207.103:8787/v1/state',
    '--source', 'home-server',
  ]);
  assert.equal(options.url.href, 'http://100.91.207.103:8787/v1/state');
});

test('Demo TUI posts the snapshot and verifies the response', async () => {
  const snapshot = createDemoSnapshot({
    sourceId: 'home-server',
    instanceId: '6eb708b7-eb87-4673-b2ef-82983833bfa7',
    sequence: 1,
    state: 'working',
  });
  let request;
  const result = await postDemoState(new URL('http://phone:8787/v1/state'), snapshot, {
    fetchImpl: async (url, options) => {
      request = { url: url.href, options };
      return new Response(JSON.stringify({
        instance_id: snapshot.instance_id,
        sequence: snapshot.sequence,
        disposition: 'applied',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  assert.equal(request.url, 'http://phone:8787/v1/state');
  assert.equal(JSON.parse(request.options.body).state, 'working');
  assert.equal(result.disposition, 'applied');
});
