import { randomUUID } from 'node:crypto';
import { validateSnapshot } from '../shared/protocol.mjs';

const DISPOSITIONS = new Set(['applied', 'refreshed', 'duplicate', 'stale', 'retired_instance']);

class SendError extends Error {
  constructor(message, { retryable = false } = {}) {
    super(message);
    this.name = 'SendError';
    this.retryable = retryable;
  }
}

export class SnapshotSender {
  #active = null;
  #closed = false;
  #heartbeat = null;
  #pending = null;
  #wakeDelay = null;

  constructor({
    receiverUrl,
    sourceId,
    heartbeatIntervalMs = 5_000,
    requestTimeoutMs = 2_000,
    retryDelaysMs = [250, 1_000, 3_000],
    fetchImpl = globalThis.fetch,
    instanceId = randomUUID(),
    now = () => new Date(),
    logger = console,
  }) {
    this.receiverUrl = receiverUrl;
    this.sourceId = sourceId;
    this.heartbeatIntervalMs = heartbeatIntervalMs;
    this.requestTimeoutMs = requestTimeoutMs;
    this.retryDelaysMs = retryDelaysMs;
    this.fetchImpl = fetchImpl;
    this.instanceId = instanceId;
    this.now = now;
    this.logger = logger;
    this.sequence = 0;
    this.latestView = null;
  }

  start(initialView) {
    if (this.#closed || this.#heartbeat) return;
    this.update(initialView);
    this.#heartbeat = setInterval(() => {
      if (this.latestView) this.#enqueue(this.latestView);
    }, this.heartbeatIntervalMs);
    this.#heartbeat.unref();
  }

  update(view) {
    if (this.#closed) return;
    this.latestView = structuredClone(view);
    this.#enqueue(this.latestView);
  }

  #enqueue(view) {
    if (this.sequence >= Number.MAX_SAFE_INTEGER) {
      throw new Error('发送序列号已耗尽，需要重启发送进程');
    }
    const snapshot = validateSnapshot({
      protocol_version: 1,
      source_id: this.sourceId,
      instance_id: this.instanceId,
      sequence: this.sequence += 1,
      sent_at: this.now().toISOString(),
      state: view.state,
      cause: view.cause,
      ...(view.counts ? { counts: { ...view.counts } } : {}),
    });
    this.#pending = snapshot;
    this.#wakeDelay?.();
    this.#startPump();
  }

  #startPump() {
    if (this.#active || !this.#pending || this.#closed) return;
    this.#active = this.#pump().finally(() => {
      this.#active = null;
      if (this.#pending && !this.#closed) this.#startPump();
    });
  }

  async #pump() {
    while (this.#pending && !this.#closed) {
      const snapshot = this.#pending;
      this.#pending = null;
      for (let attempt = 0; attempt <= this.retryDelaysMs.length; attempt += 1) {
        if (this.#closed) return;
        if (this.#pending) break;
        try {
          await this.#send(snapshot);
          break;
        } catch (error) {
          this.logger.warn?.(`Receiver 同步失败（sequence=${snapshot.sequence}, attempt=${attempt + 1}）：${error.message}`);
          if (this.#pending) break;
          if (!error.retryable || attempt >= this.retryDelaysMs.length) break;
          await this.#delay(this.retryDelaysMs[attempt]);
        }
      }
    }
  }

  async #send(snapshot) {
    let response;
    try {
      response = await this.fetchImpl(this.receiverUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(snapshot),
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch (error) {
      throw new SendError(error.message, { retryable: true });
    }
    if (!response.ok) {
      await response.body?.cancel?.();
      throw new SendError(`HTTP ${response.status}`, { retryable: response.status >= 500 });
    }

    let result;
    try {
      result = await response.json();
    } catch {
      throw new SendError('Receiver 成功响应不是有效 JSON');
    }
    if (
      result?.protocol_version !== 1
      || result.source_id !== snapshot.source_id
      || result.instance_id !== snapshot.instance_id
      || result.sequence !== snapshot.sequence
      || !DISPOSITIONS.has(result.disposition)
    ) throw new SendError('Receiver 成功响应与请求不匹配');
  }

  #delay(milliseconds) {
    return new Promise((resolve) => {
      const timer = setTimeout(finish, milliseconds);
      const sender = this;
      function finish() {
        clearTimeout(timer);
        if (sender.#wakeDelay === finish) sender.#wakeDelay = null;
        resolve();
      }
      this.#wakeDelay = finish;
    });
  }

  async waitForIdle() {
    while (this.#active) await this.#active;
  }

  async stop() {
    this.#closed = true;
    if (this.#heartbeat) clearInterval(this.#heartbeat);
    this.#heartbeat = null;
    this.#pending = null;
    this.#wakeDelay?.();
    await this.#active;
  }
}
