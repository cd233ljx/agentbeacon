import { AGENT_STATES } from '../shared/protocol.mjs';
import {
  HerdrApi,
  HerdrProtocolError,
  isNotFoundError,
} from './herdr-api.mjs';

const STATE_SET = new Set(AGENT_STATES);
const RELEVANT_EVENTS = new Set([
  'pane_agent_detected',
  'pane.agent_detected',
  'pane_agent_status_changed',
  'pane.agent_status_changed',
  'pane_closed',
  'pane.closed',
  'pane_exited',
  'pane.exited',
]);

class HerdrSchemaError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HerdrSchemaError';
  }
}

function normalizeAgent(agent) {
  if (!agent || typeof agent.pane_id !== 'string' || !STATE_SET.has(agent.agent_status)) {
    throw new HerdrSchemaError('Herdr Agent schema 与 protocol 20 不兼容');
  }
  return { pane_id: agent.pane_id, agent_status: agent.agent_status };
}

function eventPaneId(message, fallbackPaneId) {
  if (!message || !RELEVANT_EVENTS.has(message.event)) return null;
  if (typeof fallbackPaneId === 'string') return fallbackPaneId;
  return typeof message.data?.pane_id === 'string' ? message.data.pane_id : null;
}

function closeSocket(socket, intentional) {
  if (!socket) return;
  intentional.add(socket);
  socket.end?.();
}

export class HerdrCollector {
  constructor({
    socketPath,
    tracker,
    requestTimeoutMs = 10_000,
    reconnectDelaysMs = [250, 1_000, 3_000, 10_000, 30_000],
    apiFactory = (path) => new HerdrApi(path, { timeoutMs: requestTimeoutMs }),
    logger = console,
  }) {
    this.socketPath = socketPath;
    this.tracker = tracker;
    this.reconnectDelaysMs = reconnectDelaysMs;
    this.apiFactory = apiFactory;
    this.logger = logger;
    this.running = false;
    this.loop = null;
    this.cancelConnection = null;
    this.cancelDelay = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.tracker.setHealth('initializing');
    this.loop = this.#run();
  }

  async stop() {
    this.running = false;
    this.cancelConnection?.();
    this.cancelDelay?.();
    await this.loop;
  }

  async #run() {
    let failures = 0;
    while (this.running) {
      try {
        await this.#runConnection();
      } catch (error) {
        if (!this.running) break;
        const wasHealthy = this.tracker.health === 'healthy';
        const incompatible = error instanceof HerdrProtocolError || error instanceof HerdrSchemaError;
        this.tracker.setHealth(incompatible ? 'incompatible' : 'unavailable');
        this.logger.warn?.(`Herdr 采集失败：${error.message}`);
        if (wasHealthy) failures = 0;
      }
      if (!this.running) break;
      const delay = this.reconnectDelaysMs[Math.min(failures, this.reconnectDelaysMs.length - 1)];
      failures += 1;
      await this.#wait(delay);
    }
  }

  async #runConnection() {
    const api = this.apiFactory(this.socketPath);
    const sockets = new Set();
    const intentional = new WeakSet();
    const paneSockets = new Map();
    const pendingEvents = [];
    let alive = true;
    let ready = false;
    let draining = false;
    let rejectDisconnected;
    const disconnected = new Promise((_, reject) => { rejectDisconnected = reject; });

    const disconnect = (error = new Error('Herdr 订阅连接已关闭')) => {
      if (!alive) return;
      alive = false;
      rejectDisconnected(error);
    };
    const assertAlive = () => {
      if (!alive) throw new Error('Herdr 连接已失效');
    };
    this.cancelConnection = () => disconnect(new Error('Herdr 采集已停止'));

    const watchSocket = (socket) => {
      sockets.add(socket);
      socket.once?.('error', disconnect);
      socket.once?.('close', () => {
        if (!intentional.has(socket)) disconnect();
      });
      if (socket.destroyed) disconnect();
      return socket;
    };

    const removePane = (paneId) => {
      this.tracker.removePane(paneId);
      const socket = paneSockets.get(paneId);
      if (socket) {
        paneSockets.delete(paneId);
        closeSocket(socket, intentional);
      }
    };

    const enqueue = (message, fallbackPaneId) => {
      if (!alive) return;
      const paneId = eventPaneId(message, fallbackPaneId);
      if (!paneId) return;
      if (pendingEvents.length >= 10_000) {
        disconnect(new Error('Herdr 事件积压超过安全上限'));
        return;
      }
      pendingEvents.push(paneId);
      if (ready) void drain();
    };

    const ensurePaneSubscription = async (paneId) => {
      if (paneSockets.has(paneId)) return;
      const socket = await api.subscribePane(
        paneId,
        (message) => enqueue(message, paneId),
      );
      if (!alive) {
        closeSocket(socket, intentional);
        assertAlive();
      }
      paneSockets.set(paneId, watchSocket(socket));
    };

    const refreshPane = async (paneId) => {
      try {
        const agent = normalizeAgent(await api.getAgent(paneId));
        assertAlive();
        await ensurePaneSubscription(agent.pane_id);
        this.tracker.setPane(agent.pane_id, agent.agent_status);
      } catch (error) {
        if (isNotFoundError(error)) {
          removePane(paneId);
          return;
        }
        throw error;
      }
    };

    const drain = async () => {
      if (draining || !ready || !alive) return;
      draining = true;
      try {
        while (pendingEvents.length > 0 && alive) await refreshPane(pendingEvents.shift());
      } catch (error) {
        disconnect(error);
      } finally {
        draining = false;
      }
    };

    const synchronize = async (agents) => {
      assertAlive();
      const normalized = agents.map(normalizeAgent);
      const live = new Set(normalized.map((agent) => agent.pane_id));
      for (const agent of normalized) await ensurePaneSubscription(agent.pane_id);
      for (const paneId of paneSockets.keys()) {
        if (!live.has(paneId)) removePane(paneId);
      }
      this.tracker.reconcile(normalized);
    };

    const setup = async () => {
      await api.ping();
      assertAlive();
      const lifecycleSocket = await api.subscribeLifecycle((message) => enqueue(message));
      if (!alive) {
        closeSocket(lifecycleSocket, intentional);
        assertAlive();
      }
      watchSocket(lifecycleSocket);
      await synchronize(await api.listAgents());
      assertAlive();
      await synchronize(await api.listAgents());
      assertAlive();
      this.tracker.setHealth('healthy');
      ready = true;
      await drain();
    };

    try {
      await Promise.race([setup(), disconnected]);
      await disconnected;
    } finally {
      alive = false;
      this.cancelConnection = null;
      for (const socket of sockets) closeSocket(socket, intentional);
    }
  }

  #wait(milliseconds) {
    return new Promise((resolve) => {
      const timer = setTimeout(finish, milliseconds);
      const collector = this;
      function finish() {
        clearTimeout(timer);
        if (collector.cancelDelay === finish) collector.cancelDelay = null;
        resolve();
      }
      this.cancelDelay = finish;
    });
  }
}
