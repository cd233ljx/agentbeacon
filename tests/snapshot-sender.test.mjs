import test from 'node:test';
import assert from 'node:assert/strict';
import { createReceiverService } from '../receiver/server.mjs';
import { SnapshotSender } from '../server/snapshot-sender.mjs';

const instanceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const counts = { blocked: 0, working: 1, unknown: 0, done: 0, idle: 0 };
const working = { state: 'working', cause: 'aggregate', counts };
const quietLogger = { warn() {} };

function accepted(snapshot, disposition = 'applied') {
  return new Response(JSON.stringify({
    protocol_version: 1,
    disposition,
    source_id: snapshot.source_id,
    instance_id: snapshot.instance_id,
    sequence: snapshot.sequence,
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

test('sender retries the same sequence within one bounded cycle', async () => {
  const sent = [];
  const statuses = [503, 503, 200];
  const sender = new SnapshotSender({
    receiverUrl: 'http://127.0.0.1/v1/state',
    sourceId: 'home-server',
    instanceId,
    retryDelaysMs: [0, 0],
    logger: quietLogger,
    fetchImpl: async (_url, options) => {
      const snapshot = JSON.parse(options.body);
      sent.push(snapshot);
      const status = statuses.shift();
      return status === 200 ? accepted(snapshot) : new Response('', { status });
    },
  });
  sender.update(working);
  await sender.waitForIdle();
  assert.deepEqual(sent.map((snapshot) => snapshot.sequence), [1, 1, 1]);
  await sender.stop();
});

test('new state replaces an old retry and receives a new sequence', async () => {
  const sent = [];
  let notifyFailure;
  const failure = new Promise((resolve) => { notifyFailure = resolve; });
  const sender = new SnapshotSender({
    receiverUrl: 'http://127.0.0.1/v1/state',
    sourceId: 'home-server',
    instanceId,
    retryDelaysMs: [10_000],
    logger: { warn() { notifyFailure(); } },
    fetchImpl: async (_url, options) => {
      const snapshot = JSON.parse(options.body);
      sent.push(snapshot);
      if (snapshot.sequence === 1) return new Response('', { status: 503 });
      return accepted(snapshot);
    },
  });

  sender.update({ state: 'unknown', cause: 'collector_unavailable' });
  await failure;
  sender.update(working);
  await sender.waitForIdle();
  assert.deepEqual(sent.map(({ sequence, state }) => [sequence, state]), [
    [1, 'unknown'],
    [2, 'working'],
  ]);
  await sender.stop();
});

test('sender heartbeats create increasing snapshots', async () => {
  const sequences = [];
  let releaseSecond;
  const second = new Promise((resolve) => { releaseSecond = resolve; });
  const sender = new SnapshotSender({
    receiverUrl: 'http://127.0.0.1/v1/state',
    sourceId: 'home-server',
    instanceId,
    heartbeatIntervalMs: 15,
    retryDelaysMs: [],
    logger: quietLogger,
    fetchImpl: async (_url, options) => {
      const snapshot = JSON.parse(options.body);
      sequences.push(snapshot.sequence);
      if (sequences.length === 2) releaseSecond();
      return accepted(snapshot, sequences.length === 1 ? 'applied' : 'refreshed');
    },
  });
  sender.start(working);
  await second;
  await sender.stop();
  assert.deepEqual(sequences.slice(0, 2), [1, 2]);
});

test('sender interoperates with the Receiver over loopback HTTP', async (context) => {
  const states = [];
  const service = createReceiverService({
    host: '127.0.0.1',
    port: 8787,
    allowedSourceId: 'home-server',
    receiverTimeoutMs: 15_000,
    requestTimeoutMs: 2_000,
    dryRun: true,
    demoEnabled: false,
    wledBaseUrl: 'http://192.168.1.100',
    presets: { idle: 1, working: 2, blocked: 3, done: 4, unknown: 5 },
  }, { output: { ensureState: (state) => states.push(state), close() {} } });
  await new Promise((resolve) => service.server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise((resolve) => service.server.close(resolve)));
  const port = service.server.address().port;
  const sender = new SnapshotSender({
    receiverUrl: `http://127.0.0.1:${port}/v1/state`,
    sourceId: 'home-server',
    instanceId,
    retryDelaysMs: [],
    logger: quietLogger,
  });
  sender.update({
    state: 'done',
    cause: 'aggregate',
    counts: { blocked: 0, working: 0, unknown: 0, done: 1, idle: 0 },
  });
  await sender.waitForIdle();
  assert.equal(service.store.displayedState, 'done');
  assert.deepEqual(states, ['unknown', 'done']);
  await sender.stop();
});

test('sender logs confirmations, suppresses heartbeats and reports recovery and retired instances', async () => {
  const infos = [];
  const warnings = [];
  let disposition = 'applied';
  let fail = false;
  const sender = new SnapshotSender({
    receiverUrl: 'http://127.0.0.1/v1/state', sourceId: 'home-server', instanceId,
    retryDelaysMs: [],
    logger: { info: (line) => infos.push(line), warn: (line) => warnings.push(line) },
    fetchImpl: async (_url, options) => fail
      ? new Response('', { status: 503 })
      : accepted(JSON.parse(options.body), disposition),
  });
  async function send(view = working) {
    sender.update(view);
    await sender.waitForIdle();
  }
  try {
    await send();
    disposition = 'refreshed';
    await send();
    disposition = 'duplicate';
    await send();
    assert.equal(infos.length, 1);
    assert.match(infos[0], /state=working cause=aggregate sequence=1 disposition=applied/);
    fail = true;
    await send();
    assert.equal(infos.length, 1);
    assert.equal(warnings.length, 1);
    fail = false;
    disposition = 'refreshed';
    await send();
    assert.equal(infos.length, 2);
    disposition = 'retired_instance';
    await send();
    await send();
    assert.equal(infos.length, 2);
    assert.equal(warnings.length, 2);
    assert.match(warnings[1], /未采用快照.*retired_instance/);
    disposition = 'stale';
    await send();
    assert.equal(infos.length, 2);
    assert.equal(warnings.length, 3);
    disposition = 'applied';
    await send({ state: 'unknown', cause: 'collector_unavailable' });
    await send({ state: 'unknown', cause: 'initializing' });
    assert.equal(infos.length, 4);
    assert.match(infos[2], /state=unknown cause=collector_unavailable/);
    assert.match(infos[3], /state=unknown cause=initializing/);
  } finally {
    await sender.stop();
  }
});
