import test from 'node:test';
import assert from 'node:assert/strict';
import { AggregateTracker } from '../shared/aggregation.mjs';

test('tracker distinguishes initialization, healthy empty and collector failure', () => {
  const changes = [];
  const tracker = new AggregateTracker({ onChange: (view) => changes.push(view) });
  assert.deepEqual(tracker.view(), { state: 'unknown', cause: 'initializing' });
  tracker.reconcile([]);
  tracker.setHealth('healthy');
  assert.deepEqual(tracker.view(), {
    state: 'idle',
    cause: 'aggregate',
    counts: { blocked: 0, working: 0, unknown: 0, done: 0, idle: 0 },
  });
  tracker.setHealth('unavailable');
  assert.deepEqual(tracker.view(), { state: 'unknown', cause: 'collector_unavailable' });
  assert.equal(changes.length, 2);
});

test('tracker aggregates sessions and clears completed panes', () => {
  const tracker = new AggregateTracker();
  tracker.reconcile([
    { pane_id: 'p1', agent_status: 'done' },
    { pane_id: 'p2', agent_status: 'unknown' },
  ]);
  tracker.setHealth('healthy');
  assert.equal(tracker.view().state, 'unknown');
  tracker.setPane('p3', 'working');
  assert.equal(tracker.view().state, 'working');
  tracker.setPane('p1', 'blocked');
  assert.equal(tracker.view().state, 'blocked');
  tracker.removePane('p1');
  tracker.removePane('p3');
  assert.equal(tracker.view().state, 'unknown');
  tracker.removePane('p2');
  assert.equal(tracker.view().state, 'idle');
});

test('cached sessions never turn a failed collector into a business state', () => {
  const tracker = new AggregateTracker();
  tracker.reconcile([{ pane_id: 'p1', agent_status: 'working' }]);
  tracker.setHealth('healthy');
  tracker.setHealth('incompatible');
  assert.deepEqual(tracker.view(), { state: 'unknown', cause: 'protocol_incompatible' });
});
