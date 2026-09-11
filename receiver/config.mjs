import { readFile } from 'node:fs/promises';
import { validateSourceId } from '../shared/protocol.mjs';

export const DEFAULT_RECEIVER_CONFIG = Object.freeze({
  host: '127.0.0.1',
  port: 8787,
  receiverTimeoutMs: 15_000,
  requestTimeoutMs: 2_000,
  dryRun: true,
  demoEnabled: false,
  presets: Object.freeze({ idle: 1, working: 2, blocked: 3, done: 4, unknown: 5 }),
});

function requireInteger(name, value, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} 必须是 ${minimum}..${maximum} 的整数`);
  }
  return value;
}

export function validateReceiverConfig(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Receiver 配置必须是 JSON 对象');
  }
  const config = { ...DEFAULT_RECEIVER_CONFIG, ...input };
  if (typeof config.host !== 'string' || config.host.length === 0) {
    throw new Error('host 必须是非空字符串');
  }
  if (config.host === '0.0.0.0' || config.host === '::') {
    throw new Error('禁止通配监听；请使用 127.0.0.1 或具体 Tailscale IP');
  }
  requireInteger('port', config.port, 1, 65_535);
  requireInteger('receiverTimeoutMs', config.receiverTimeoutMs, 1, 3_600_000);
  requireInteger('requestTimeoutMs', config.requestTimeoutMs, 1, 60_000);
  if (typeof config.allowedSourceId !== 'string') {
    throw new Error('allowedSourceId 必须配置');
  }
  validateSourceId(config.allowedSourceId);
  if (typeof config.dryRun !== 'boolean' || typeof config.demoEnabled !== 'boolean') {
    throw new Error('dryRun 和 demoEnabled 必须是布尔值');
  }
  if (typeof config.wledBaseUrl !== 'string') throw new Error('wledBaseUrl 必须配置');
  let wledUrl;
  try {
    wledUrl = new URL(config.wledBaseUrl);
  } catch {
    throw new Error('wledBaseUrl 必须是有效 URL');
  }
  if (!['http:', 'https:'].includes(wledUrl.protocol)) {
    throw new Error('wledBaseUrl 只支持 http 或 https');
  }
  if (wledUrl.username || wledUrl.password || wledUrl.search || wledUrl.hash) {
    throw new Error('wledBaseUrl 不能包含凭据、查询参数或片段');
  }

  if (config.presets === null || typeof config.presets !== 'object' || Array.isArray(config.presets)) {
    throw new Error('presets 必须是对象');
  }
  const knownStates = Object.keys(DEFAULT_RECEIVER_CONFIG.presets);
  if (Object.keys(config.presets).some((state) => !knownStates.includes(state))) {
    throw new Error('presets 包含未知状态');
  }
  const presets = { ...DEFAULT_RECEIVER_CONFIG.presets, ...config.presets };
  for (const [state, preset] of Object.entries(presets)) {
    requireInteger(`presets.${state}`, preset, 1, 250);
  }
  return {
    host: config.host,
    port: config.port,
    allowedSourceId: config.allowedSourceId,
    receiverTimeoutMs: config.receiverTimeoutMs,
    requestTimeoutMs: config.requestTimeoutMs,
    dryRun: config.dryRun,
    demoEnabled: config.demoEnabled,
    wledBaseUrl: wledUrl.href.replace(/\/$/, ''),
    presets,
  };
}

export async function loadReceiverConfig(path) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new Error(`无法读取 Receiver 配置：${error.message}`);
  }
  return validateReceiverConfig(parsed);
}
