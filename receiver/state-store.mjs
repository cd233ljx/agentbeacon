import { AGENT_STATES, canonicalSnapshot, ProtocolError } from '../shared/protocol.mjs';

const STATE_SET = new Set(AGENT_STATES);

export class ReceiverStateStore {
  constructor({ allowedSourceId, timeoutMs = 15_000, output, clock = () => performance.now() }) {
    this.allowedSourceId = allowedSourceId;
    this.timeoutMs = timeoutMs;
    this.output = output;
    this.clock = clock;
    this.currentInstanceId = null;
    this.highestSequence = null;
    this.lastCanonical = null;
    this.lastAcceptedAt = null;
    this.receivedState = null;
    this.displayedState = 'unknown';
    this.demoActive = false;
    this.retiredInstances = new Set();
    this.timedOut = false;
    this.output.ensureState('unknown');
  }

  accept(snapshot) {
    const canonical = canonicalSnapshot(snapshot);
    if (this.retiredInstances.has(snapshot.instance_id)) {
      return this.#result('retired_instance', snapshot);
    }

    if (this.currentInstanceId === snapshot.instance_id) {
      if (snapshot.sequence < this.highestSequence) return this.#result('stale', snapshot);
      if (snapshot.sequence === this.highestSequence) {
        if (canonical !== this.lastCanonical) {
          throw new ProtocolError(
            'sequence_conflict',
            '同一 instance_id 和 sequence 的快照内容冲突',
            409,
          );
        }
        return this.#result('duplicate', snapshot);
      }
    } else if (this.currentInstanceId !== null) {
      this.retiredInstances.add(this.currentInstanceId);
    }

    this.currentInstanceId = snapshot.instance_id;
    this.highestSequence = snapshot.sequence;
    this.lastCanonical = canonical;
    this.lastAcceptedAt = this.clock();
    this.receivedState = snapshot.state;
    this.timedOut = false;
    if (this.demoActive) return this.#result('refreshed', snapshot);

    const stateChanged = this.displayedState !== snapshot.state;
    this.displayedState = snapshot.state;
    // 成功应用时是空操作；此前失败时可借新 sequence 心跳恢复 WLED。
    this.output.ensureState(snapshot.state);
    return this.#result(stateChanged ? 'applied' : 'refreshed', snapshot);
  }

  checkTimeout(now = this.clock()) {
    if (this.lastAcceptedAt === null || this.timedOut) return false;
    if (now - this.lastAcceptedAt < this.timeoutMs) return false;
    this.timedOut = true;
    if (this.demoActive) return true;
    if (this.displayedState !== 'unknown') {
      this.displayedState = 'unknown';
      this.output.ensureState('unknown');
    }
    return true;
  }

  setDemoState(state) {
    if (!STATE_SET.has(state)) throw new ProtocolError('invalid_state', 'Demo state 无效');
    this.demoActive = true;
    if (this.displayedState !== state) {
      this.displayedState = state;
      this.output.ensureState(state);
    }
    return state;
  }

  exitDemo(now = this.clock()) {
    if (!this.demoActive) return this.displayedState;
    this.demoActive = false;
    if (this.lastAcceptedAt !== null && now - this.lastAcceptedAt >= this.timeoutMs) {
      this.timedOut = true;
    }
    const restored = !this.timedOut && this.receivedState ? this.receivedState : 'unknown';
    if (this.displayedState !== restored) {
      this.displayedState = restored;
      this.output.ensureState(restored);
    }
    return restored;
  }

  #result(disposition, snapshot) {
    return {
      protocol_version: 1,
      disposition,
      source_id: snapshot.source_id,
      instance_id: snapshot.instance_id,
      sequence: snapshot.sequence,
    };
  }
}
