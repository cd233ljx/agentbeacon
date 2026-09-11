import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { validateSourceId } from '../shared/protocol.mjs';

export const DEFAULT_SENDER_CONFIG = Object.freeze({
  heartbeatIntervalMs: 5_000,
  requestTimeoutMs: 2_000,
  herdrRequestTimeoutMs: 10_000,
});

function integer(name, value, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} 必须是 ${minimum}..${maximum} 的整数`);
  }
  return value;
}

export function validateSenderConfig(input, { environment = process.env } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('发送端配置必须是 JSON 对象');
  }
  const config = { ...DEFAULT_SENDER_CONFIG, ...input };
  validateSourceId(config.sourceId);
  integer('heartbeatIntervalMs', config.heartbeatIntervalMs, 250, 3_600_000);
  integer('requestTimeoutMs', config.requestTimeoutMs, 100, 60_000);
  integer('herdrRequestTimeoutMs', config.herdrRequestTimeoutMs, 100, 60_000);
  if (config.requestTimeoutMs >= config.heartbeatIntervalMs) {
    throw new Error('requestTimeoutMs 必须小于 heartbeatIntervalMs');
  }

  let receiverUrl;
  try {
    receiverUrl = new URL(config.receiverUrl);
  } catch {
    throw new Error('receiverUrl 必须是有效 URL');
  }
  if (!['http:', 'https:'].includes(receiverUrl.protocol)) {
    throw new Error('receiverUrl 只支持 http 或 https');
  }
  if (receiverUrl.username || receiverUrl.password || receiverUrl.search || receiverUrl.hash) {
    throw new Error('receiverUrl 不能包含凭据、查询参数或片段');
  }
  if (receiverUrl.pathname !== '/v1/state') {
    throw new Error('receiverUrl 路径必须是 /v1/state');
  }

  const herdrSocketPath = config.herdrSocketPath
    ?? environment.HERDR_SOCKET_PATH
    ?? join(homedir(), '.config', 'herdr', 'herdr.sock');
  if (typeof herdrSocketPath !== 'string' || herdrSocketPath.length === 0) {
    throw new Error('herdrSocketPath 必须是非空字符串');
  }

  return {
    sourceId: config.sourceId,
    receiverUrl: receiverUrl.href,
    herdrSocketPath,
    heartbeatIntervalMs: config.heartbeatIntervalMs,
    requestTimeoutMs: config.requestTimeoutMs,
    herdrRequestTimeoutMs: config.herdrRequestTimeoutMs,
  };
}

export async function loadSenderConfig(path, options) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new Error(`无法读取发送端配置：${error.message}`);
  }
  return validateSenderConfig(parsed, options);
}
