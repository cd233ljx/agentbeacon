import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReceiverConfig } from '../receiver/config.mjs';

function minimal(overrides = {}) {
  return {
    allowedSourceId: 'home-server',
    wledBaseUrl: 'http://192.168.1.100',
    ...overrides,
  };
}

test('Receiver config defaults to loopback and dry-run', () => {
  const config = validateReceiverConfig(minimal());
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 8787);
  assert.equal(config.dryRun, true);
  assert.equal(config.receiverTimeoutMs, 15_000);
  assert.deepEqual(config.presets, { idle: 1, working: 2, blocked: 3, done: 4, unknown: 5 });
});

test('Receiver config rejects wildcard listeners and unsafe WLED URLs', () => {
  assert.throws(() => validateReceiverConfig(minimal({ host: '0.0.0.0' })), /禁止通配监听/);
  assert.throws(
    () => validateReceiverConfig(minimal({ wledBaseUrl: 'http://user:secret@192.168.1.100' })),
    /不能包含凭据/,
  );
});

test('Receiver config validates source and preset mappings', () => {
  assert.throws(() => validateReceiverConfig(minimal({ allowedSourceId: 'Bad Source' })), /source_id/);
  assert.throws(() => validateReceiverConfig(minimal({ presets: { typo: 3 } })), /未知状态/);
  assert.throws(() => validateReceiverConfig(minimal({ presets: { blocked: 0 } })), /presets.blocked/);
});
