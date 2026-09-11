import test from 'node:test';
import assert from 'node:assert/strict';
import { ReceiverStateStore } from '../receiver/state-store.mjs';

const firstInstance = '11111111-1111-4111-8111-111111111111';
const secondInstance = '22222222-2222-4222-8222-222222222222';

function snapshot(sequence, state = 'working', instanceId = firstInstance) {
  return {
    protocol_version: 1,
    source_id: 'home-server',
    instance_id: instanceId,
    sequence,
    sent_at: `2026-09-11T08:00:${String(sequence).padStart(2, '0')}.000Z`,
    state,
    cause: 'aggregate',
    counts: {
      blocked: state === 'blocked' ? 1 : 0,
      working: state === 'working' ? 1 : 0,
      unknown: state === 'unknown' ? 1 : 0,
      done: state === 'done' ? 1 : 0,
      idle: state === 'idle' ? 1 : 0,
    },
  };
}

function setup() {
  let now = 0;
  const states = [];
  const store = new ReceiverStateStore({
    allowedSourceId: 'home-server',
    timeoutMs: 15_000,
    output: { ensureState: (state) => states.push(state) },
    clock: () => now,
  });
  return { store, states, setNow: (value) => { now = value; } };
}

test('store applies, refreshes, deduplicates and rejects sequence conflicts', () => {
  const { store, states, setNow } = setup();
  assert.equal(store.accept(snapshot(1)).disposition, 'applied');
  setNow(1_000);
  assert.equal(store.accept(snapshot(2)).disposition, 'refreshed');
  setNow(2_000);
  assert.equal(store.accept(snapshot(2)).disposition, 'duplicate');
  assert.equal(store.lastAcceptedAt, 1_000);
  assert.equal(store.accept(snapshot(1)).disposition, 'stale');
  assert.throws(
    () => store.accept({ ...snapshot(2), sent_at: '2026-09-11T09:00:00.000Z' }),
    /内容冲突/,
  );
  assert.deepEqual(states, ['unknown', 'working', 'working']);
});

test('new process retires the previous instance and rejects its late packets', () => {
  const { store } = setup();
  store.accept(snapshot(5, 'done'));
  assert.equal(store.accept(snapshot(1, 'idle', secondInstance)).disposition, 'applied');
  assert.equal(store.accept(snapshot(6, 'blocked', firstInstance)).disposition, 'retired_instance');
  assert.equal(store.displayedState, 'idle');
});

test('timeout displays unknown and a new sequence restores the received state', () => {
  const { store, states, setNow } = setup();
  store.accept(snapshot(1, 'working'));
  assert.equal(store.checkTimeout(14_999), false);
  assert.equal(store.checkTimeout(15_000), true);
  assert.equal(store.displayedState, 'unknown');
  setNow(16_000);
  assert.equal(store.accept(snapshot(2, 'working')).disposition, 'applied');
  assert.equal(store.timedOut, false);
  assert.deepEqual(states, ['unknown', 'working', 'unknown', 'working']);
});
