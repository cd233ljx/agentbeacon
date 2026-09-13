import { AGENT_STATES } from '../shared/protocol.mjs';

const STATE_SET = new Set(AGENT_STATES);

export class WledOutput {
  #active = null;
  #appliedGeneration = 0;
  #closed = false;
  #desired = null;
  #generation = 0;
  #wakeDelay = null;

  constructor({
    baseUrl,
    presets,
    dryRun = false,
    requestTimeoutMs = 2_000,
    retryDelaysMs = [250, 1_000, 3_000],
    fetchImpl = globalThis.fetch,
    logger = console,
  }) {
    this.baseUrl = baseUrl;
    this.presets = presets;
    this.dryRun = dryRun;
    this.requestTimeoutMs = requestTimeoutMs;
    this.retryDelaysMs = retryDelaysMs;
    this.fetchImpl = fetchImpl;
    this.logger = logger;
  }

  ensureState(state) {
    if (this.#closed) return;
    if (!STATE_SET.has(state)) throw new Error(`不支持的 WLED 状态：${state}`);
    const preset = this.presets[state];
    if (!Number.isSafeInteger(preset)) throw new Error(`状态 ${state} 没有 preset 映射`);

    if (!this.#desired || this.#desired.state !== state) {
      this.#generation += 1;
      this.#desired = { generation: this.#generation, state, preset };
      this.#wakeDelay?.();
    }
    if (this.#appliedGeneration === this.#desired.generation || this.#active) return;
    this.#active = this.#pump().finally(() => {
      this.#active = null;
    });
  }

  async #pump() {
    while (!this.#closed && this.#desired) {
      const target = this.#desired;
      if (this.#appliedGeneration === target.generation) return;

      let applied = false;
      for (let attempt = 0; attempt <= this.retryDelaysMs.length; attempt += 1) {
        if (this.#closed || target !== this.#desired) break;
        try {
          await this.#apply(target);
          if (target === this.#desired) this.#appliedGeneration = target.generation;
          applied = true;
          break;
        } catch (error) {
          this.logger.warn?.(`WLED preset 应用失败（state=${target.state}, attempt=${attempt + 1}）：${error.message}`);
          if (attempt < this.retryDelaysMs.length && target === this.#desired) {
            await this.#delay(this.retryDelaysMs[attempt]);
          }
        }
      }

      if (target !== this.#desired) continue;
      if (applied || this.#closed) return;
      // 本轮有界重试已耗尽；保留 desired，由下一次有效心跳再次触发恢复。
      return;
    }
  }

  async #apply({ state, preset }) {
    if (this.dryRun) {
      this.logger.info?.(`DRY-RUN WLED state=${state} preset=${preset}`);
      return;
    }
    const response = await this.fetchImpl(new URL('/json/state', `${this.baseUrl}/`), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ps: preset }),
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    });
    await response.arrayBuffer();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    this.logger.info?.(`WLED 已应用 state=${state} preset=${preset}`);
  }

  #delay(milliseconds) {
    return new Promise((resolve) => {
      const timer = setTimeout(finish, milliseconds);
      const output = this;
      function finish() {
        clearTimeout(timer);
        if (output.#wakeDelay === finish) output.#wakeDelay = null;
        resolve();
      }
      this.#wakeDelay = finish;
    });
  }

  async waitForIdle() {
    while (this.#active) await this.#active;
  }

  close() {
    this.#closed = true;
    this.#wakeDelay?.();
  }
}
