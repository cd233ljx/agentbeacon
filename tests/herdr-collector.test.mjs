import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { HerdrCollector } from '../server/herdr-collector.mjs';
import { HerdrProtocolError } from '../server/herdr-api.mjs';
import { AggregateTracker } from '../shared/aggregation.mjs';

class FakeSocket extends EventEmitter {
  constructor() {
    super();
    this.destroyed = false;
  }

  end() {
    if (this.destroyed) return;
    this.destroyed = true;
    queueMicrotask(() => this.emit('close'));
  }
}

class FakeApi {
  constructor(listSnapshots, { protocolError } = {}) {
    this.listSnapshots = listSnapshots;
    this.protocolError = protocolError;
    this.listIndex = 0;
    this.agents = new Map(
      listSnapshots.at(-1).map((agent) => [agent.pane_id, { ...agent }]),
    );
    this.lifecycleSocket = null;
    this.lifecycleCallback = null;
    this.paneCallbacks = new Map();
  }

  async ping() {
    if (this.protocolError) throw this.protocolError;
  }

  async subscribeLifecycle(callback) {
    this.lifecycleCallback = callback;
    this.lifecycleSocket = new FakeSocket();
    queueMicrotask(() => callback({
      event: 'pane_agent_detected',
      data: { pane_id: 'historical:pane', released: true },
    }));
    return this.lifecycleSocket;
  }

  async listAgents() {
    const value = this.listSnapshots[Math.min(this.listIndex, this.listSnapshots.length - 1)];
    this.listIndex += 1;
    return value.map((agent) => ({ ...agent }));
  }

  async subscribePane(paneId, callback) {
    const socket = new FakeSocket();
    this.paneCallbacks.set(paneId, { callback, socket });
    return socket;
  }

  async getAgent(paneId) {
    const agent = this.agents.get(paneId);
    if (!agent) throw new Error('Herdr API 错误：pane_not_found');
    return { ...agent };
  }

  emitLifecycle(event, paneId) {
    this.lifecycleCallback({ event, data: { pane_id: paneId } });
  }

  emitStatus(paneId) {
    this.paneCallbacks.get(paneId).callback({
      event: 'pane_agent_status_changed',
      data: { pane_id: paneId },
    });
  }
}

async function waitFor(predicate, message = '等待条件超时') {
  const deadline = Date.now() + 1_000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

const quietLogger = { warn() {} };

test('collector reconciles startup races and verifies replayed lifecycle events', async () => {
  const api = new FakeApi([
    [{ pane_id: 'w1:p1', agent_status: 'done' }],
    [
      { pane_id: 'w1:p1', agent_status: 'done' },
      { pane_id: 'w1:p2', agent_status: 'working' },
    ],
  ]);
  const tracker = new AggregateTracker();
  const collector = new HerdrCollector({
    socketPath: '/fake/herdr.sock',
    tracker,
    apiFactory: () => api,
    reconnectDelaysMs: [0],
    logger: quietLogger,
  });
  collector.start();
  await waitFor(() => tracker.health === 'healthy' && tracker.view().state === 'working');
  assert.deepEqual([...tracker.sessions.keys()].sort(), ['w1:p1', 'w1:p2']);

  api.agents.set('w1:p1', { pane_id: 'w1:p1', agent_status: 'blocked' });
  api.emitStatus('w1:p1');
  await waitFor(() => tracker.view().state === 'blocked');

  // 历史 release 到达时 Agent 仍存在，必须以 agent.get 当前结果为准。
  api.emitLifecycle('pane_agent_detected', 'w1:p1');
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(tracker.sessions.get('w1:p1'), 'blocked');

  api.agents.delete('w1:p1');
  api.emitLifecycle('pane_agent_detected', 'w1:p1');
  await waitFor(() => !tracker.sessions.has('w1:p1'));
  assert.equal(tracker.view().state, 'working');

  api.agents.delete('w1:p2');
  api.emitLifecycle('pane_closed', 'w1:p2');
  await waitFor(() => tracker.view().state === 'idle');
  await collector.stop();
});

test('collector emits unavailable then fully reconciles after subscription disconnect', async () => {
  const changes = [];
  const tracker = new AggregateTracker({ onChange: (view) => changes.push(view) });
  const first = new FakeApi([[{ pane_id: 'w1:p1', agent_status: 'working' }]]);
  const second = new FakeApi([[{ pane_id: 'w2:p1', agent_status: 'done' }]]);
  const apis = [first, second];
  const collector = new HerdrCollector({
    socketPath: '/fake/herdr.sock',
    tracker,
    apiFactory: () => apis.shift() ?? second,
    reconnectDelaysMs: [0],
    logger: quietLogger,
  });
  collector.start();
  await waitFor(() => tracker.health === 'healthy' && tracker.view().state === 'working');
  first.lifecycleSocket.emit('close');
  await waitFor(() => tracker.health === 'healthy' && tracker.view().state === 'done');
  assert.ok(changes.some((view) => view.cause === 'collector_unavailable'));
  assert.deepEqual([...tracker.sessions.keys()], ['w2:p1']);
  await collector.stop();
});

test('collector reports protocol incompatibility without using cached business state', async () => {
  const tracker = new AggregateTracker();
  tracker.reconcile([{ pane_id: 'old:p1', agent_status: 'working' }]);
  const api = new FakeApi([[]], { protocolError: new HerdrProtocolError(21) });
  const collector = new HerdrCollector({
    socketPath: '/fake/herdr.sock',
    tracker,
    apiFactory: () => api,
    reconnectDelaysMs: [10_000],
    logger: quietLogger,
  });
  collector.start();
  await waitFor(() => tracker.health === 'incompatible');
  assert.deepEqual(tracker.view(), { state: 'unknown', cause: 'protocol_incompatible' });
  await collector.stop();
});
