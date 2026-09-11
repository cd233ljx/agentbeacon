export const PROTOCOL_VERSION = 1;
export const AGENT_STATES = Object.freeze(['blocked', 'working', 'unknown', 'done', 'idle']);
export const SNAPSHOT_CAUSES = Object.freeze([
  'aggregate',
  'initializing',
  'collector_unavailable',
  'protocol_incompatible',
]);

const STATE_SET = new Set(AGENT_STATES);
const CAUSE_SET = new Set(SNAPSHOT_CAUSES);
const SOURCE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UTC_RFC3339_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/;

export class ProtocolError extends Error {
  constructor(code, message, status = 422) {
    super(message);
    this.name = 'ProtocolError';
    this.code = code;
    this.status = status;
  }
}

function fail(code, message, status) {
  throw new ProtocolError(code, message, status);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateSentAt(value) {
  if (typeof value !== 'string') fail('invalid_sent_at', 'sent_at 必须是 RFC 3339 UTC 字符串');
  const match = UTC_RFC3339_PATTERN.exec(value);
  if (!match) fail('invalid_sent_at', 'sent_at 必须使用 RFC 3339 UTC 的 Z 时区格式');

  const [, year, month, day, hour, minute, second] = match;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || Number(second) > 59) {
    fail('invalid_sent_at', 'sent_at 不是有效时间');
  }
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== Number(year)
    || parsed.getUTCMonth() + 1 !== Number(month)
    || parsed.getUTCDate() !== Number(day)
    || parsed.getUTCHours() !== Number(hour)
    || parsed.getUTCMinutes() !== Number(minute)
    || parsed.getUTCSeconds() !== Number(second)
  ) fail('invalid_sent_at', 'sent_at 不是有效时间');
}

export function aggregateCounts(counts) {
  for (const state of AGENT_STATES) {
    if ((counts[state] ?? 0) > 0) return state;
  }
  return 'idle';
}

export function validateSourceId(value) {
  if (typeof value !== 'string' || !SOURCE_ID_PATTERN.test(value)) {
    fail('invalid_source_id', 'source_id 格式无效');
  }
  return value;
}

function validateCounts(value) {
  if (!isPlainObject(value)) fail('invalid_counts', 'counts 必须是对象');
  const keys = Object.keys(value);
  if (keys.length !== AGENT_STATES.length || keys.some((key) => !STATE_SET.has(key))) {
    fail('invalid_counts', 'counts 必须且只能包含五个状态键');
  }

  const normalized = {};
  for (const state of AGENT_STATES) {
    const count = value[state];
    if (!Number.isSafeInteger(count) || count < 0) {
      fail('invalid_counts', `counts.${state} 必须是非负安全整数`);
    }
    normalized[state] = count;
  }
  return normalized;
}

export function validateSnapshot(value, { allowedSourceId } = {}) {
  if (!isPlainObject(value)) fail('invalid_request', '请求体必须是 JSON 对象', 400);
  if (value.protocol_version !== PROTOCOL_VERSION) {
    fail('unsupported_protocol', 'protocol_version 必须为 1');
  }
  validateSourceId(value.source_id);
  if (allowedSourceId !== undefined && value.source_id !== allowedSourceId) {
    fail('source_not_allowed', 'source_id 不被允许', 403);
  }
  if (typeof value.instance_id !== 'string' || !UUID_PATTERN.test(value.instance_id)) {
    fail('invalid_instance_id', 'instance_id 必须是 UUID');
  }
  if (!Number.isSafeInteger(value.sequence) || value.sequence < 1) {
    fail('invalid_sequence', 'sequence 必须是大于零的安全整数');
  }
  validateSentAt(value.sent_at);
  if (!STATE_SET.has(value.state)) fail('invalid_state', 'state 不是支持的状态');
  if (!CAUSE_SET.has(value.cause)) fail('invalid_cause', 'cause 不是支持的原因');

  let counts;
  if (value.cause === 'aggregate') {
    counts = validateCounts(value.counts);
    if (aggregateCounts(counts) !== value.state) {
      fail('state_counts_mismatch', 'state 与 counts 聚合结果不一致');
    }
  } else {
    if ('counts' in value) fail('unexpected_counts', '非 aggregate 快照不能包含 counts');
    if (value.state !== 'unknown') fail('invalid_failure_state', '采集异常快照必须为 unknown');
  }

  return {
    protocol_version: PROTOCOL_VERSION,
    source_id: value.source_id,
    instance_id: value.instance_id.toLowerCase(),
    sequence: value.sequence,
    sent_at: value.sent_at,
    state: value.state,
    cause: value.cause,
    ...(counts ? { counts } : {}),
  };
}

export function canonicalSnapshot(snapshot) {
  return JSON.stringify(snapshot);
}
