import http from 'node:http';
import { pathToFileURL } from 'node:url';

const STATES = new Set(['blocked', 'working', 'unknown', 'done', 'idle']);
const MAX_BODY_BYTES = 4_096;

function send(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  response.end(body);
}

async function readBody(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > MAX_BODY_BYTES) throw new Error('body_too_large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function createProbeServer({ sourceId, onState = console.log }) {
  let instanceId = null;
  let sequence = 0;
  return http.createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      send(response, 200, { status: 'ok', probe: 'termux' });
      return;
    }
    if (request.method !== 'POST' || request.url !== '/v1/state') {
      request.resume();
      send(response, 404, { error: { code: 'not_found' } });
      return;
    }
    if (request.headers['content-type']?.split(';', 1)[0].trim() !== 'application/json') {
      request.resume();
      send(response, 415, { error: { code: 'unsupported_media_type' } });
      return;
    }

    try {
      const snapshot = JSON.parse(await readBody(request));
      if (
        snapshot?.protocol_version !== 1
        || snapshot.source_id !== sourceId
        || typeof snapshot.instance_id !== 'string'
        || !Number.isSafeInteger(snapshot.sequence)
        || snapshot.sequence < 1
        || !STATES.has(snapshot.state)
      ) {
        send(response, snapshot?.source_id === sourceId ? 422 : 403, {
          error: { code: snapshot?.source_id === sourceId ? 'invalid_snapshot' : 'source_not_allowed' },
        });
        return;
      }

      let disposition = 'applied';
      if (instanceId === snapshot.instance_id && snapshot.sequence <= sequence) disposition = 'stale';
      else {
        instanceId = snapshot.instance_id;
        sequence = snapshot.sequence;
        onState(`STATE ${snapshot.state} sequence=${snapshot.sequence}`);
      }
      send(response, 200, {
        protocol_version: 1,
        disposition,
        source_id: snapshot.source_id,
        instance_id: snapshot.instance_id,
        sequence: snapshot.sequence,
      });
    } catch (error) {
      send(response, error.message === 'body_too_large' ? 413 : 400, {
        error: { code: error.message === 'body_too_large' ? 'body_too_large' : 'invalid_json' },
      });
    }
  });
}

function parseArguments(arguments_) {
  const values = { host: '127.0.0.1', port: 8787, sourceId: 'home-server', duration: 300 };
  for (let index = 0; index < arguments_.length; index += 2) {
    const key = arguments_[index];
    const value = arguments_[index + 1];
    if (!value) throw new Error('参数必须成对提供');
    if (key === '--host') values.host = value;
    else if (key === '--port') values.port = Number(value);
    else if (key === '--source') values.sourceId = value;
    else if (key === '--duration') values.duration = Number(value);
    else throw new Error(`未知参数：${key}`);
  }
  if (!Number.isInteger(values.port) || values.port < 1 || values.port > 65_535) throw new Error('port 无效');
  if (!Number.isInteger(values.duration) || values.duration < 30 || values.duration > 1_800) throw new Error('duration 必须为 30..1800 秒');
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(values.sourceId)) throw new Error('source 无效');
  return values;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArguments(process.argv.slice(2));
  const server = createProbeServer({ sourceId: options.sourceId });
  server.listen(options.port, options.host, () => {
    if (options.host === '0.0.0.0' || options.host === '::') {
      console.log('WARN 临时通配监听仅用于本次探针，到时会自动关闭');
    }
    console.log(`READY http://${options.host}:${options.port} duration=${options.duration}s`);
  });
  server.once('error', (error) => {
    console.error(`FAIL ${error.code ?? error.message}`);
    process.exitCode = 1;
  });
  const timer = setTimeout(() => server.close(), options.duration * 1_000);
  process.once('SIGINT', () => {
    clearTimeout(timer);
    server.close();
  });
}
