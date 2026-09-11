import { requestOnce, subscribe } from './herdr-probe.mjs';

export const HERDR_PROTOCOL = 20;

export class HerdrProtocolError extends Error {
  constructor(actualProtocol) {
    super(`Herdr protocol 不兼容：期望 ${HERDR_PROTOCOL}，实际 ${actualProtocol ?? 'unknown'}`);
    this.name = 'HerdrProtocolError';
    this.actualProtocol = actualProtocol;
  }
}

export function isNotFoundError(error) {
  return /(?:pane_not_found|agent_not_found|not_found)/.test(error?.message ?? '');
}

export class HerdrApi {
  constructor(socketPath, { timeoutMs = 10_000 } = {}) {
    this.socketPath = socketPath;
    this.timeoutMs = timeoutMs;
    this.sequence = 0;
  }

  async #request(method, params = {}) {
    return requestOnce(this.socketPath, {
      id: `agentbeacon_${this.sequence += 1}`,
      method,
      params,
    }, this.timeoutMs);
  }

  async ping() {
    const result = await this.#request('ping');
    if (result?.type !== 'pong' || !Number.isSafeInteger(result.protocol)) {
      throw new Error('Herdr ping 返回结构无效');
    }
    if (result.protocol !== HERDR_PROTOCOL) throw new HerdrProtocolError(result.protocol);
    return result;
  }

  async listAgents() {
    const result = await this.#request('agent.list');
    if (result?.type !== 'agent_list' || !Array.isArray(result.agents)) {
      throw new Error('Herdr agent.list 返回结构无效');
    }
    return result.agents;
  }

  async getAgent(paneId) {
    const result = await this.#request('agent.get', { target: paneId });
    if (result?.type !== 'agent_info' || !result.agent) {
      throw new Error('Herdr agent.get 返回结构无效');
    }
    return result.agent;
  }

  subscribeLifecycle(onEvent) {
    return subscribe(this.socketPath, `lifecycle_${this.sequence += 1}`, [
      { type: 'pane.agent_detected' },
      { type: 'pane.closed' },
      { type: 'pane.exited' },
    ], onEvent, this.timeoutMs);
  }

  subscribePane(paneId, onEvent) {
    return subscribe(
      this.socketPath,
      `status_${this.sequence += 1}`,
      [{ type: 'pane.agent_status_changed', pane_id: paneId }],
      onEvent,
      this.timeoutMs,
    );
  }
}
