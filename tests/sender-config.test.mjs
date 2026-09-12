import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSenderConfig } from '../server/config.mjs';

function minimal(overrides = {}) {
  return {
    sourceId: 'home-server',
    receiverUrl: 'http://127.0.0.1:8787/v1/state',
    ...overrides,
  };
}

test('sender config uses injected Herdr socket then the default session path', () => {
  const defaultReceiver = validateSenderConfig({ sourceId: 'home-server' }, {
    environment: { HERDR_SOCKET_PATH: '/tmp/default-receiver.sock' },
  });
  assert.equal(defaultReceiver.receiverUrl, 'http://100.91.207.103:8787/v1/state');

  const injected = validateSenderConfig(minimal(), {
    environment: { HERDR_SOCKET_PATH: '/tmp/injected.sock' },
  });
  assert.equal(injected.herdrSocketPath, '/tmp/injected.sock');
  assert.equal(injected.heartbeatIntervalMs, 5_000);
  assert.equal(injected.requestTimeoutMs, 2_000);

  const explicit = validateSenderConfig(minimal({ herdrSocketPath: '/tmp/explicit.sock' }), {
    environment: { HERDR_SOCKET_PATH: '/tmp/injected.sock' },
  });
  assert.equal(explicit.herdrSocketPath, '/tmp/explicit.sock');
});

test('sender config rejects unsafe URL forms and invalid timeouts', () => {
  assert.throws(() => validateSenderConfig(minimal({ receiverUrl: 'ftp://host/v1/state' })), /http/);
  assert.throws(() => validateSenderConfig(minimal({ receiverUrl: 'http://host/state' })), /\/v1\/state/);
  assert.throws(
    () => validateSenderConfig(minimal({ receiverUrl: 'http://user:secret@host/v1/state' })),
    /不能包含凭据/,
  );
  assert.throws(
    () => validateSenderConfig(minimal({ heartbeatIntervalMs: 1_000, requestTimeoutMs: 1_000 })),
    /必须小于/,
  );
});
