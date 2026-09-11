import { randomUUID } from 'node:crypto';

const arguments_ = process.argv.slice(2);
function option(name, fallback) {
  const index = arguments_.indexOf(name);
  return index === -1 ? fallback : arguments_[index + 1];
}

const target = option('--url');
const sourceId = option('--source', 'home-server');
const intervalMs = Number(option('--interval', '2000'));
const states = option('--states', 'working,blocked,done').split(',');
const allowedStates = new Set(['blocked', 'working', 'unknown', 'done', 'idle']);
if (!target) throw new Error('用法：node scripts/probe-phone.mjs --url <http://phone:8787/v1/state>');
const targetUrl = new URL(target);
if (!['http:', 'https:'].includes(targetUrl.protocol) || targetUrl.pathname !== '/v1/state') {
  throw new Error('--url 必须是 http(s)://<具体地址>/v1/state');
}
if (targetUrl.username || targetUrl.password || targetUrl.search || targetUrl.hash) {
  throw new Error('--url 不能包含凭据、查询参数或片段');
}
if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(sourceId)) throw new Error('--source 无效');
if (!Number.isInteger(intervalMs) || intervalMs < 0 || intervalMs > 30_000) throw new Error('--interval 无效');
if (states.length === 0 || states.some((state) => !allowedStates.has(state))) throw new Error('--states 无效');

const instanceId = randomUUID();
for (const [index, state] of states.entries()) {
  const counts = Object.fromEntries([...allowedStates].map((candidate) => [candidate, 0]));
  counts[state] = 1;
  const snapshot = {
    protocol_version: 1,
    source_id: sourceId,
    instance_id: instanceId,
    sequence: index + 1,
    sent_at: new Date().toISOString(),
    state,
    cause: 'aggregate',
    counts,
  };
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(snapshot),
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`手机探针返回 HTTP ${response.status}`);
  const result = await response.json();
  if (result.instance_id !== instanceId || result.sequence !== snapshot.sequence) {
    throw new Error('手机探针响应与请求不匹配');
  }
  console.log(`OK ${state} sequence=${snapshot.sequence} disposition=${result.disposition}`);
  if (index + 1 < states.length && intervalMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
