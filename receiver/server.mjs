import http from 'node:http';
import { ProtocolError, validateSnapshot } from '../shared/protocol.mjs';
import { validateReceiverConfig } from './config.mjs';
import { ReceiverStateStore } from './state-store.mjs';
import { WledOutput } from './wled-output.mjs';

const MAX_BODY_BYTES = 4_096;

class HttpRequestError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function sendJson(response, status, body) {
  const encoded = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(encoded),
    'cache-control': 'no-store',
  });
  response.end(encoded);
}

async function readBody(request) {
  const declaredLength = Number(request.headers['content-length']);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    request.resume();
    throw new HttpRequestError(413, 'body_too_large', '请求体超过 4096 bytes');
  }

  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > MAX_BODY_BYTES) {
      request.resume();
      throw new HttpRequestError(413, 'body_too_large', '请求体超过 4096 bytes');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function errorResponse(error) {
  if (error instanceof ProtocolError || error instanceof HttpRequestError) {
    return { status: error.status, code: error.code, message: error.message };
  }
  if (error instanceof SyntaxError) {
    return { status: 400, code: 'invalid_json', message: '请求体不是有效 JSON' };
  }
  return { status: 500, code: 'internal_error', message: 'Receiver 内部错误' };
}

export function createReceiverService(rawConfig, { output, clock, logger = console } = {}) {
  const config = validateReceiverConfig(rawConfig);
  const stateOutput = output ?? new WledOutput({
    baseUrl: config.wledBaseUrl,
    presets: config.presets,
    dryRun: config.dryRun,
    requestTimeoutMs: config.requestTimeoutMs,
    logger,
  });
  const store = new ReceiverStateStore({
    allowedSourceId: config.allowedSourceId,
    timeoutMs: config.receiverTimeoutMs,
    output: stateOutput,
    clock,
  });

  const server = http.createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      sendJson(response, 200, {
        protocol_version: 1,
        status: 'ok',
        state: store.displayedState,
        timed_out: store.timedOut,
        dry_run: config.dryRun,
      });
      return;
    }
    if (request.method !== 'POST' || request.url !== '/v1/state') {
      request.resume();
      sendJson(response, 404, { error: { code: 'not_found', message: '接口不存在' } });
      return;
    }

    const contentType = request.headers['content-type']?.split(';', 1)[0].trim().toLowerCase();
    if (contentType !== 'application/json') {
      request.resume();
      sendJson(response, 415, {
        error: { code: 'unsupported_media_type', message: 'Content-Type 必须是 application/json' },
      });
      return;
    }

    try {
      const body = await readBody(request);
      const snapshot = validateSnapshot(JSON.parse(body), {
        allowedSourceId: config.allowedSourceId,
      });
      sendJson(response, 200, store.accept(snapshot));
    } catch (error) {
      const failure = errorResponse(error);
      if (failure.status === 500) logger.error?.(error);
      sendJson(response, failure.status, {
        error: { code: failure.code, message: failure.message },
      });
    }
  });

  const timeoutPoll = setInterval(
    () => store.checkTimeout(),
    Math.max(50, Math.min(1_000, Math.floor(config.receiverTimeoutMs / 3))),
  );
  timeoutPoll.unref();
  server.once('close', () => {
    clearInterval(timeoutPoll);
    stateOutput.close?.();
  });

  return { config, output: stateOutput, server, store };
}

export async function listenReceiver(service) {
  await new Promise((resolve, reject) => {
    service.server.once('error', reject);
    service.server.listen(service.config.port, service.config.host, () => {
      service.server.off('error', reject);
      resolve();
    });
  });
  return service.server.address();
}
