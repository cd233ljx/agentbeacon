import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sanitizeAgent, sanitizeEvent, subscribe } from '../server/herdr-probe.mjs';

const observedAt = '2026-09-11T00:00:00.000Z';

test('sanitizeAgent only exposes allow-listed lifecycle fields', () => {
  const record = sanitizeAgent({
    pane_id: 'w1:p2',
    workspace_id: 'w1',
    agent: 'codex',
    agent_status: 'working',
    state_change_seq: 7,
    screen_detection_skipped: false,
    title: 'secret title',
    cwd: '/secret/path',
    agent_session: { value: 'secret-session' },
    terminal_title: 'secret terminal text',
  }, observedAt);

  assert.deepEqual(record, {
    observed_at: observedAt,
    event: 'snapshot',
    pane_id: 'w1:p2',
    workspace_id: 'w1',
    agent: 'codex',
    state: 'working',
    state_change_seq: 7,
    screen_detection_skipped: false,
  });
  assert.equal(JSON.stringify(record).includes('secret'), false);
});

test('sanitizeEvent accepts documented and observed status event spellings', () => {
  for (const event of ['pane_agent_status_changed', 'pane.agent_status_changed']) {
    assert.deepEqual(sanitizeEvent({
      event,
      data: {
        pane_id: 'w1:p2',
        workspace_id: 'w1',
        agent: 'codex',
        agent_status: 'blocked',
        title: 'do not expose',
      },
    }, observedAt), {
      observed_at: observedAt,
      event: 'status_changed',
      pane_id: 'w1:p2',
      workspace_id: 'w1',
      agent: 'codex',
      state: 'blocked',
    });
  }
});

test('sanitizeEvent records release and close without terminal data', () => {
  assert.deepEqual(sanitizeEvent({
    event: 'pane_agent_detected',
    data: {
      pane_id: 'w1:p2',
      workspace_id: 'w1',
      agent: 'codex',
      released: true,
      final_status: 'done',
    },
  }, observedAt), {
    observed_at: observedAt,
    event: 'agent_released',
    pane_id: 'w1:p2',
    workspace_id: 'w1',
    agent: 'codex',
    state: 'done',
  });

  assert.deepEqual(sanitizeEvent({
    event: 'pane_closed',
    data: { pane_id: 'w1:p2', workspace_id: 'w1' },
  }, observedAt), {
    observed_at: observedAt,
    event: 'pane_closed',
    pane_id: 'w1:p2',
    workspace_id: 'w1',
    agent: null,
    state: null,
  });
});

test('invalid and unrelated data is rejected', () => {
  assert.equal(sanitizeAgent({ pane_id: 'w1:p2', workspace_id: 'w1', agent_status: 'busy' }), null);
  assert.equal(sanitizeEvent({ event: 'pane_output_changed', data: { text: 'secret' } }), null);
});

test('subscribe sends NDJSON and accepts the Herdr acknowledgement envelope', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'agentbeacon-herdr-probe-'));
  const socketPath = join(directory, 'herdr.sock');
  context.after(() => rm(directory, { recursive: true, force: true }));

  const server = net.createServer((socket) => {
    let request = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      request += chunk;
      if (!request.includes('\n')) return;
      const parsed = JSON.parse(request.trim());
      assert.equal(parsed.method, 'events.subscribe');
      socket.write(`${JSON.stringify({
        id: parsed.id,
        result: { type: 'subscription_started' },
      })}\n`);
    });
  });
  await new Promise((resolve) => server.listen(socketPath, resolve));
  context.after(() => server.close());

  const socket = await subscribe(
    socketPath,
    'test_subscription',
    [{ type: 'pane.agent_detected' }],
    () => {},
  );
  socket.end();
});

test('subscribe surfaces a safe code from an internal probe error', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'agentbeacon-herdr-probe-error-'));
  const socketPath = join(directory, 'herdr.sock');
  context.after(() => rm(directory, { recursive: true, force: true }));

  const server = net.createServer((socket) => {
    socket.once('data', () => {
      socket.write(`${JSON.stringify({
        id: 'outer:sub:0:probe',
        error: { code: 'not_found', message: 'sensitive details' },
      })}\n`);
      socket.end();
    });
  });
  await new Promise((resolve) => server.listen(socketPath, resolve));
  context.after(() => server.close());

  await assert.rejects(
    subscribe(socketPath, 'outer', [{ type: 'pane.agent_status_changed', pane_id: 'w1:p1' }], () => {}),
    /Herdr API 错误：not_found/,
  );
});
