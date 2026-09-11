import { AGENT_STATES, aggregateCounts } from './protocol.mjs';

const STATE_SET = new Set(AGENT_STATES);
const HEALTH_CAUSES = Object.freeze({
  initializing: 'initializing',
  unavailable: 'collector_unavailable',
  incompatible: 'protocol_incompatible',
});

function sameView(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export class AggregateTracker {
  constructor({ onChange = () => {} } = {}) {
    this.health = 'initializing';
    this.sessions = new Map();
    this.onChange = onChange;
    this.lastView = this.view();
  }

  view() {
    if (this.health !== 'healthy') {
      return { state: 'unknown', cause: HEALTH_CAUSES[this.health] };
    }
    const counts = Object.fromEntries(AGENT_STATES.map((state) => [state, 0]));
    for (const state of this.sessions.values()) counts[state] += 1;
    return { state: aggregateCounts(counts), cause: 'aggregate', counts };
  }

  setHealth(health) {
    if (health !== 'healthy' && !(health in HEALTH_CAUSES)) {
      throw new Error(`不支持的采集健康状态：${health}`);
    }
    this.health = health;
    this.#emitIfChanged();
  }

  reconcile(agents) {
    const next = new Map();
    for (const agent of agents) {
      if (!agent || typeof agent.pane_id !== 'string' || !STATE_SET.has(agent.agent_status)) {
        throw new Error('Herdr agent.list 返回了不兼容的 Agent 状态');
      }
      next.set(agent.pane_id, agent.agent_status);
    }
    this.sessions = next;
    this.#emitIfChanged();
  }

  setPane(paneId, state) {
    if (typeof paneId !== 'string' || paneId.length === 0 || !STATE_SET.has(state)) {
      throw new Error('Herdr pane 状态无效');
    }
    this.sessions.set(paneId, state);
    this.#emitIfChanged();
  }

  removePane(paneId) {
    if (this.sessions.delete(paneId)) this.#emitIfChanged();
  }

  #emitIfChanged() {
    const next = this.view();
    if (sameView(next, this.lastView)) return;
    this.lastView = next;
    this.onChange(next);
  }
}
