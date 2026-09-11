import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_KEYS, demoStateForKey } from '../scripts/demo-tui.mjs';

test('Demo TUI maps 1-5 to the five display states', () => {
  assert.deepEqual(Object.keys(DEMO_KEYS), ['1', '2', '3', '4', '5']);
  assert.deepEqual(
    ['1', '2', '3', '4', '5'].map(demoStateForKey),
    ['idle', 'working', 'blocked', 'done', 'unknown'],
  );
  assert.equal(demoStateForKey('x'), null);
});
