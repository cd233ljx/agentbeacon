import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { loadReceiverConfig } from '../receiver/config.mjs';
import { WledOutput } from '../receiver/wled-output.mjs';

export const DEMO_KEYS = Object.freeze({
  1: { state: 'idle', label: '空闲 / 熄灯', color: '\x1b[90m' },
  2: { state: 'working', label: '工作中 / 蓝色', color: '\x1b[34m' },
  3: { state: 'blocked', label: '等待输入 / 红色', color: '\x1b[31m' },
  4: { state: 'done', label: '已完成 / 绿色', color: '\x1b[32m' },
  5: { state: 'unknown', label: '连接异常 / 黄色', color: '\x1b[33m' },
});

export function demoStateForKey(key) {
  return DEMO_KEYS[key]?.state ?? null;
}

function configPathFromArgs(arguments_) {
  if (arguments_.length === 0) return resolve('receiver/config.example.json');
  if (arguments_.length === 2 && arguments_[0] === '--config') return resolve(arguments_[1]);
  throw new Error('用法：node scripts/demo-tui.mjs [--config <path>]');
}

export async function runDemoTui(configPath, {
  input = process.stdin,
  output = process.stdout,
} = {}) {
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    throw new Error('Demo TUI 必须在交互式终端中运行');
  }
  const config = await loadReceiverConfig(configPath);
  let currentState = 'idle';
  let message = config.dryRun ? 'dry-run：不会连接真实 WLED' : 'WLED 模式';
  let stopping = false;
  let finish;
  const done = new Promise((resolveDone) => { finish = resolveDone; });

  const render = () => {
    const current = Object.values(DEMO_KEYS).find(({ state }) => state === currentState);
    output.write('\x1b[2J\x1b[H');
    output.write('AgentBeacon Demo\n\n');
    for (const [key, item] of Object.entries(DEMO_KEYS)) {
      output.write(`${item.color}[${key}] ${item.label}\x1b[0m\n`);
    }
    output.write('\n[q] 退出并熄灯\n\n');
    output.write(`当前：${current.color}${current.label}\x1b[0m\n${message}\n`);
  };

  const logger = {
    info(value) { message = value; render(); },
    warn(value) { message = value; render(); },
  };
  const wled = new WledOutput({
    baseUrl: config.wledBaseUrl,
    presets: config.presets,
    dryRun: config.dryRun,
    requestTimeoutMs: config.requestTimeoutMs,
    logger,
  });

  const cleanup = async () => {
    if (stopping) return;
    stopping = true;
    input.off('data', onKey);
    input.setRawMode(false);
    input.pause();
    wled.ensureState('idle');
    await wled.waitForIdle();
    wled.close();
    output.write('\x1b[2J\x1b[HDemo 已退出，状态已切换为 idle。\n');
    finish();
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
    message = `已选择 ${state}`;
    wled.ensureState(state);
    render();
  };

  input.setRawMode(true);
  input.resume();
  input.on('data', onKey);
  wled.ensureState('idle');
  render();
  return { cleanup, done };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const tui = await runDemoTui(configPathFromArgs(process.argv.slice(2)));
  await tui.done;
}
