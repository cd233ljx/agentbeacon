import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateCounts,
  ProtocolError,
  validateSnapshot,
} from '../shared/protocol.mjs';

const instanceId = '11111111-1111-4111-8111-111111111111';

function snapshot(overrides = {}) {
  return {
    protocol_version: 1,
    source_id: 'home-server',
    instance_id: instanceId,
    sequence: 1,
    sent_at: '2026-09-11T08:00:00.000Z',
    state: 'working',
    cause: 'aggregate',
    counts: { blocked: 0, working: 1, unknown: 0, done: 0, idle: 0 },
    ...overrides,
  };
}

test('aggregateCounts follows blocked > working > unknown > done > idle', () => {
  assert.equal(aggregateCounts({ blocked: 0, working: 0, unknown: 1, done: 4, idle: 2 }), 'unknown');
  assert.equal(aggregateCounts({ blocked: 0, working: 1, unknown: 2, done: 0, idle: 0 }), 'working');
  assert.equal(aggregateCounts({ blocked: 0, working: 0, unknown: 0, done: 0, idle: 0 }), 'idle');
});

test('validateSnapshot normalizes known fields and ignores unknown top-level fields', () => {
  const value = snapshot({ extension: { private: 'ignored' } });
  const normalized = validateSnapshot(value, { allowedSourceId: 'home-server' });
  assert.equal(normalized.extension, undefined);
  assert.deepEqual(normalized.counts, value.counts);
});

test('validateSnapshot rejects source mismatch with 403', () => {
  assert.throws(
    () => validateSnapshot(snapshot(), { allowedSourceId: 'other-server' }),
    (error) => error instanceof ProtocolError
      && error.status === 403
      && error.code === 'source_not_allowed',
  );
});

test('validateSnapshot rejects inconsistent and malformed snapshots', () => {
  for (const value of [
    snapshot({ protocol_version: 2 }),
    snapshot({ sequence: 0 }),
    snapshot({ sent_at: '2026-02-30T00:00:00Z' }),
    snapshot({ state: 'done' }),
    snapshot({ counts: { blocked: 0, working: 1, unknown: 0, done: 0, idle: 0, extra: 1 } }),
    snapshot({ cause: 'collector_unavailable', state: 'unknown' }),
  ]) assert.throws(() => validateSnapshot(value), ProtocolError);
});

test('collector failure accepts unknown without counts', () => {
  const value = snapshot({
    state: 'unknown',
    cause: 'collector_unavailable',
  });
  delete value.counts;
  const normalized = validateSnapshot(value);
  assert.equal(normalized.state, 'unknown');
  assert.equal('counts' in normalized, false);
});
