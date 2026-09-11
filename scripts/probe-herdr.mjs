import { sanitizeAgent, sanitizeEvent, requestOnce, subscribe } from '../server/herdr-probe.mjs';

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

if (process.env.HERDR_ENV !== '1') fail('必须从 Herdr 托管的 pane 内运行');
if (!process.env.HERDR_SOCKET_PATH) fail('HERDR_SOCKET_PATH 未注入');
if (!process.env.HERDR_PANE_ID) fail('HERDR_PANE_ID 未注入');

const durationIndex = process.argv.indexOf('--duration');
const durationSeconds = durationIndex === -1 ? 120 : Number(process.argv[durationIndex + 1]);
if (!Number.isInteger(durationSeconds) || durationSeconds < 5 || durationSeconds > 900) {
  fail('--duration 必须是 5 到 900 之间的整数秒');
}

const socketPath = process.env.HERDR_SOCKET_PATH;
const sockets = new Set();
const paneSubscriptions = new Map();
const livePanes = new Set();
const trackedPanes = new Set();
let requestSequence = 0;
let lifecycleQueue = Promise.resolve();
let releaseInitialReconciliation;
const initialReconciliation = new Promise((resolve) => {
  releaseInitialReconciliation = resolve;
});

function emit(record) {
  if (record) process.stdout.write(`${JSON.stringify(record)}\n`);
}

async function subscribePane(paneId) {
  if (paneSubscriptions.has(paneId)) return;
  const pending = subscribe(
    socketPath,
    `status_${paneId}`,
    [{ type: 'pane.agent_status_changed', pane_id: paneId }],
    (message) => emit(sanitizeEvent(message)),
  );
  paneSubscriptions.set(paneId, pending);
  try {
    const socket = await pending;
    sockets.add(socket);
  } catch (error) {
    paneSubscriptions.delete(paneId);
    throw error;
  }
}

async function verifyDetectedPane(record) {
  try {
    const result = await requestOnce(socketPath, {
      id: `verify_${requestSequence += 1}`,
      method: 'agent.get',
      params: { target: record.pane_id },
    });
    if (result?.type !== 'agent_info' || !result.agent) return;
    livePanes.add(record.pane_id);
    trackedPanes.add(record.pane_id);
    emit(sanitizeAgent(result.agent));
    await subscribePane(record.pane_id);
  } catch (error) {
    if (/pane_not_found|agent_not_found|not_found/.test(error.message)) return;
    throw error;
  }
}

async function agentStillPresent(paneId) {
  try {
    const result = await requestOnce(socketPath, {
      id: `present_${requestSequence += 1}`,
      method: 'agent.get',
      params: { target: paneId },
    });
    return result?.type === 'agent_info' && Boolean(result.agent);
  } catch (error) {
    if (/pane_not_found|agent_not_found|not_found/.test(error.message)) return false;
    throw error;
  }
}

async function handleLifecycle(message) {
  await initialReconciliation;
  const record = sanitizeEvent(message);
  if (!record) return;
  if (record.event === 'agent_detected') {
    if (livePanes.has(record.pane_id)) return;
    await verifyDetectedPane(record);
    return;
  }
  if (!trackedPanes.has(record.pane_id)) return;
  if (record.event === 'agent_released' && await agentStillPresent(record.pane_id)) return;

  emit(record);
  if (record.event === 'agent_released') {
    livePanes.delete(record.pane_id);
    const pending = paneSubscriptions.get(record.pane_id);
    pending?.then((socket) => socket.end()).catch(() => {});
    paneSubscriptions.delete(record.pane_id);
  }
  if (record.event === 'pane_closed' || record.event === 'pane_exited') {
    livePanes.delete(record.pane_id);
    trackedPanes.delete(record.pane_id);
    const pending = paneSubscriptions.get(record.pane_id);
    pending?.then((socket) => socket.end()).catch(() => {});
    paneSubscriptions.delete(record.pane_id);
  }
}

function closeAll() {
  for (const socket of sockets) socket.end();
}

try {
  const ping = await requestOnce(socketPath, {
    id: 'probe_ping',
    method: 'ping',
    params: {},
  });
  if (ping?.type !== 'pong') fail('Herdr ping 返回了未知结果');
  console.error('OK Herdr ping');

  const lifecycleSocket = await subscribe(
    socketPath,
    'lifecycle',
    [
      { type: 'pane.agent_detected' },
      { type: 'pane.closed' },
      { type: 'pane.exited' },
    ],
    (message) => {
      lifecycleQueue = lifecycleQueue
        .then(() => handleLifecycle(message))
        .catch((error) => fail(error.message));
    },
  );
  sockets.add(lifecycleSocket);
  console.error('OK Herdr lifecycle subscription');

  const result = await requestOnce(socketPath, {
    id: 'agents_initial',
    method: 'agent.list',
    params: {},
  });
  const agents = result?.type === 'agent_list' && Array.isArray(result.agents) ? result.agents : [];
  for (const agent of agents) {
    livePanes.add(agent.pane_id);
    trackedPanes.add(agent.pane_id);
    emit(sanitizeAgent(agent));
    await subscribePane(agent.pane_id);
  }

  const reconciled = await requestOnce(socketPath, {
    id: 'agents_reconcile',
    method: 'agent.list',
    params: {},
  });
  for (const agent of reconciled?.type === 'agent_list' && Array.isArray(reconciled.agents)
    ? reconciled.agents
    : []) {
    livePanes.add(agent.pane_id);
    trackedPanes.add(agent.pane_id);
    emit(sanitizeAgent(agent));
    await subscribePane(agent.pane_id);
  }
  releaseInitialReconciliation();

  console.error(`OK 已连接 Herdr protocol socket；安全采样 ${durationSeconds} 秒`);
  const timer = setTimeout(() => {
    closeAll();
    process.exit(0);
  }, durationSeconds * 1_000);
  process.once('SIGINT', () => {
    clearTimeout(timer);
    closeAll();
    process.exit(0);
  });
} catch (error) {
  closeAll();
  fail(error.message);
}
