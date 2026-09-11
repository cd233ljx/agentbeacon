import net from 'node:net';
import { createInterface } from 'node:readline';

export const AGENT_STATES = new Set(['idle', 'working', 'blocked', 'done', 'unknown']);

export function sanitizeAgent(agent, observedAt = new Date().toISOString()) {
  if (!agent || typeof agent !== 'object') return null;
  if (typeof agent.pane_id !== 'string' || typeof agent.workspace_id !== 'string') return null;
  if (!AGENT_STATES.has(agent.agent_status)) return null;

  return {
    observed_at: observedAt,
    event: 'snapshot',
    pane_id: agent.pane_id,
    workspace_id: agent.workspace_id,
    agent: typeof agent.agent === 'string' ? agent.agent : null,
    state: agent.agent_status,
    state_change_seq: Number.isSafeInteger(agent.state_change_seq)
      ? agent.state_change_seq
      : null,
    screen_detection_skipped: agent.screen_detection_skipped === true,
  };
}

export function sanitizeEvent(envelope, observedAt = new Date().toISOString()) {
  if (!envelope || typeof envelope !== 'object' || !envelope.data) return null;
  const event = envelope.event;
  const data = envelope.data;

  if (event === 'pane_agent_status_changed' || event === 'pane.agent_status_changed') {
    if (typeof data.pane_id !== 'string' || typeof data.workspace_id !== 'string') return null;
    if (!AGENT_STATES.has(data.agent_status)) return null;
    return {
      observed_at: observedAt,
      event: 'status_changed',
      pane_id: data.pane_id,
      workspace_id: data.workspace_id,
      agent: typeof data.agent === 'string' ? data.agent : null,
      state: data.agent_status,
    };
  }

  if (event === 'pane_agent_detected') {
    if (typeof data.pane_id !== 'string' || typeof data.workspace_id !== 'string') return null;
    return {
      observed_at: observedAt,
      event: data.released === true ? 'agent_released' : 'agent_detected',
      pane_id: data.pane_id,
      workspace_id: data.workspace_id,
      agent: typeof data.agent === 'string' ? data.agent : null,
      state: AGENT_STATES.has(data.final_status) ? data.final_status : null,
    };
  }

  if (event === 'pane_closed' || event === 'pane_exited') {
    if (typeof data.pane_id !== 'string' || typeof data.workspace_id !== 'string') return null;
    return {
      observed_at: observedAt,
      event: event === 'pane_closed' ? 'pane_closed' : 'pane_exited',
      pane_id: data.pane_id,
      workspace_id: data.workspace_id,
      agent: null,
      state: null,
    };
  }

  return null;
}

function openLines(socket, onMessage) {
  const lines = createInterface({ input: socket, crlfDelay: Infinity });
  lines.on('line', (line) => {
    try {
      onMessage(JSON.parse(line));
    } catch {
      // Ignore malformed or partial protocol lines; the probe never prints raw data.
    }
  });
  return lines;
}

export function requestOnce(socketPath, request, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('Herdr 请求超时'));
    }, timeoutMs);

    const lines = openLines(socket, (message) => {
      if (message.id !== request.id) return;
      clearTimeout(timeout);
      socket.end();
      if (message.error) reject(new Error(`Herdr API 错误：${message.error.code ?? 'unknown'}`));
      else resolve(message.result);
    });

    socket.once('connect', () => socket.write(`${JSON.stringify(request)}\n`));
    socket.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    socket.once('close', () => lines.close());
  });
}

export function subscribe(socketPath, id, subscriptions, onEvent, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    let acknowledged = false;
    let connected = false;
    let jsonLines = 0;
    let invalidLines = 0;
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(
        `Herdr 订阅确认超时（connected=${connected}, json_lines=${jsonLines}, invalid_lines=${invalidLines}）`,
      ));
    }, timeoutMs);

    const lines = openLines(socket, (message) => {
      jsonLines += 1;
      if (!acknowledged && message.error) {
        clearTimeout(timeout);
        socket.destroy();
        reject(new Error(`Herdr API 错误：${message.error.code ?? 'unknown'}`));
        return;
      }
      if (message.id === id) {
        clearTimeout(timeout);
        acknowledged = true;
        resolve(socket);
        return;
      }
      if (typeof message.event === 'string') onEvent(message);
    });

    lines.on('line', (line) => {
      try {
        JSON.parse(line);
      } catch {
        invalidLines += 1;
      }
    });

    socket.once('connect', () => {
      connected = true;
      socket.write(`${JSON.stringify({
        id,
        method: 'events.subscribe',
        params: { subscriptions },
      })}\n`);
    });
    socket.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    socket.once('close', () => {
      lines.close();
      if (!acknowledged) {
        clearTimeout(timeout);
        reject(new Error(
          `Herdr 在确认订阅前关闭连接（connected=${connected}, json_lines=${jsonLines}, invalid_lines=${invalidLines}）`,
        ));
      }
    });
  });
}
