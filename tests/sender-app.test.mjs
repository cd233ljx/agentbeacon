import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createReceiverService } from '../receiver/server.mjs';
import { createSenderApp } from '../server/app.mjs';

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

class FakeHerdrApi {
  constructor() {
    this.agent = { pane_id: 'w1:p1', agent_status: 'working' };
    this.lifecycleSocket = null;
    this.failPing = false;
  }

  async ping() {
    if (this.failPing) throw new Error('模拟 Herdr 离线');
  }

  async subscribeLifecycle(callback) {
    this.lifecycleCallback = callback;
    this.lifecycleSocket = new FakeSocket();
    return this.lifecycleSocket;
  }

  async listAgents() {
    return this.agent ? [{ ...this.agent }] : [];
  }

  async subscribePane(_paneId, callback) {
    this.statusCallback = callback;
    return new FakeSocket();
  }

  async getAgent() {
    if (!this.agent) throw new Error('Herdr API 错误：pane_not_found');
    return { ...this.agent };
  }
}

async function waitFor(predicate) {
  const deadline = Date.now() + 1_500;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('等待端到端状态超时');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

test('sender app carries Herdr aggregate, release and disconnect states to Receiver', async (context) => {
  const displayed = [];
  const receiver = createReceiverService({
    host: '127.0.0.1',
    port: 8787,
    allowedSourceId: 'home-server',
    receiverTimeoutMs: 15_000,
    requestTimeoutMs: 2_000,
    dryRun: true,
    demoEnabled: false,
    wledBaseUrl: 'http://192.168.1.100',
    presets: { idle: 1, working: 2, blocked: 3, done: 4, unknown: 5 },
  }, { output: { ensureState: (state) => displayed.push(state), close() {} } });
  await new Promise((resolve) => receiver.server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise((resolve) => receiver.server.close(resolve)));
  const api = new FakeHerdrApi();
  const app = createSenderApp({
    sourceId: 'home-server',
    receiverUrl: `http://127.0.0.1:${receiver.server.address().port}/v1/state`,
    herdrSocketPath: '/fake/herdr.sock',
    heartbeatIntervalMs: 250,
    requestTimeoutMs: 100,
    herdrRequestTimeoutMs: 100,
  }, {
    apiFactory: () => api,
    instanceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    reconnectDelaysMs: [10_000],
    retryDelaysMs: [],
    logger: { warn() {} },
  });
  context.after(() => app.stop());
  app.start();
  await waitFor(() => receiver.store.displayedState === 'working');

  api.agent.agent_status = 'blocked';
  api.statusCallback({ event: 'pane_agent_status_changed', data: { pane_id: 'w1:p1' } });
  await waitFor(() => receiver.store.displayedState === 'blocked');

  api.agent = null;
  api.lifecycleCallback({ event: 'pane_agent_detected', data: { pane_id: 'w1:p1', released: true } });
  await waitFor(() => receiver.store.displayedState === 'idle');

  api.failPing = true;
  api.lifecycleSocket.emit('close');
  await waitFor(() => receiver.store.displayedState === 'unknown');
  assert.ok(displayed.includes('working'));
  assert.ok(displayed.includes('blocked'));
  assert.ok(displayed.includes('idle'));
  await app.stop();
});
