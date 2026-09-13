import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const DEMO_KEYS = Object.freeze({
  1: { state: 'idle', label: '空闲 / 熄灯', color: '\x1b[90m' },
  2: { state: 'working', label: '工作中 / 蓝色', color: '\x1b[34m' },
  3: { state: 'blocked', label: '等待输入 / 红色', color: '\x1b[31m' },
  4: { state: 'done', label: '已完成 / 绿色', color: '\x1b[32m' },
  5: { state: 'unknown', label: '连接异常 / 黄色', color: '\x1b[33m' },
});

export const DEFAULT_DEMO_URL = 'http://127.0.0.1:8787/v1/state';

export function demoStateForKey(key) {
  return DEMO_KEYS[key]?.state ?? null;
}

export function createDemoSnapshot({ sourceId, instanceId, sequence, state, now = new Date() }) {
  const counts = Object.fromEntries(
    Object.values(DEMO_KEYS).map((item) => [item.state, item.state === state ? 1 : 0]),
  );
  return {
    protocol_version: 1,
    source_id: sourceId,
    instance_id: instanceId,
    sequence,
    sent_at: now.toISOString(),
    state,
    cause: 'aggregate',
    counts,
  };
}

export function parseDemoArguments(arguments_, { environment = process.env } = {}) {
  const values = {
    url: environment.AGENTBEACON_RECEIVER_URL || DEFAULT_DEMO_URL,
    sourceId: 'home-server',
    requestTimeoutMs: 5_000,
  };
  for (let index = 0; index < arguments_.length; index += 2) {
    const key = arguments_[index];
    const value = arguments_[index + 1];
    if (!value) throw new Error('参数必须成对提供');
    if (key === '--url') values.url = value;
    else if (key === '--source') values.sourceId = value;
    else if (key === '--timeout') values.requestTimeoutMs = Number(value);
    else throw new Error(`未知参数：${key}`);
  }
  const url = new URL(values.url);
  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/v1/state') {
    throw new Error('--url 必须是 http(s)://<具体地址>/v1/state');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('--url 不能包含凭据、查询参数或片段');
  }
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(values.sourceId)) throw new Error('--source 无效');
  if (!Number.isInteger(values.requestTimeoutMs) || values.requestTimeoutMs < 100 || values.requestTimeoutMs > 60_000) {
    throw new Error('--timeout 必须为 100..60000 毫秒');
  }
  return { ...values, url };
}

export async function postDemoState(targetUrl, snapshot, {
  fetchImpl = globalThis.fetch,
  requestTimeoutMs = 5_000,
} = {}) {
  const response = await fetchImpl(targetUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(snapshot),
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(`手机 Receiver 返回 HTTP ${response.status}（${result?.error?.code ?? 'unknown'}）`);
  }
  if (result.instance_id !== snapshot.instance_id || result.sequence !== snapshot.sequence) {
    throw new Error('手机 Receiver 响应与请求不匹配');
  }
  return result;
}

export async function runDemoTui(options, {
  input = process.stdin,
  output = process.stdout,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    throw new Error('Demo TUI 必须在交互式终端中运行');
  }
  const instanceId = randomUUID();
  let currentState = 'idle';
  let message = `目标：${options.url.href}`;
  let sequence = 0;
  let stopping = false;
  let pending = Promise.resolve();
  let finish;
  const done = new Promise((resolveDone) => { finish = resolveDone; });

  const render = () => {
    const current = Object.values(DEMO_KEYS).find(({ state }) => state === currentState);
    output.write('\x1b[2J\x1b[H');
    output.write('AgentBeacon 手机 Demo\n\n');
    for (const [key, item] of Object.entries(DEMO_KEYS)) {
      output.write(`${item.color}[${key}] ${item.label}\x1b[0m\n`);
    }
    output.write('\n[q] 发送 idle 并退出\n\n');
    output.write(`当前：${current.color}${current.label}\x1b[0m\n${message}\n`);
  };

  const queueState = (state) => {
    const snapshot = createDemoSnapshot({
      sourceId: options.sourceId,
      instanceId,
      sequence: ++sequence,
      state,
    });
    pending = pending.catch(() => {}).then(async () => {
      const result = await postDemoState(options.url, snapshot, {
        fetchImpl,
        requestTimeoutMs: options.requestTimeoutMs,
      });
      message = `已发送 ${state}，sequence=${snapshot.sequence}，${result.disposition}`;
      render();
    });
    return pending;
  };

  const cleanup = async () => {
    if (stopping) return;
    stopping = true;
    input.off('data', onKey);
    input.setRawMode(false);
    input.pause();
    currentState = 'idle';
    message = '正在发送 idle…';
    render();
    await queueState('idle');
    output.write('\x1b[2J\x1b[HDemo 已退出，手机状态已切换为 idle。\n');
    finish();
  };

  const reportFailure = (error) => {
    message = `发送失败：${error.message}`;
    render();
  };

  const onKey = (buffer) => {
    const key = buffer.toString();
    if (key === 'q' || key === '\u0003') {
      void cleanup().catch((error) => {
        output.write(`\n退出失败：${error.message}\n`);
        process.exitCode = 1;
        finish();
      });
      return;
    }
    const state = demoStateForKey(key);
    if (!state) return;
    currentState = state;
    message = `正在发送 ${state}…`;
    render();
    void queueState(state).catch(reportFailure);
  };

  input.setRawMode(true);
  input.resume();
  input.on('data', onKey);
  render();
  return { cleanup, done };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const tui = await runDemoTui(parseDemoArguments(process.argv.slice(2)));
  await tui.done;
}
