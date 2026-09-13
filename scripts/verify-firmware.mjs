import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import assert from 'node:assert/strict';
import { WledOutput } from '../receiver/wled-output.mjs';
import { DEFAULT_RECEIVER_CONFIG } from '../receiver/config.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'agentbeacon-firmware-test-'));
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}
try {
  const binary = join(temporary, process.platform === 'win32' ? 'core.exe' : 'core');
  run(process.env.CXX || 'g++', ['-std=c++11', '-Wall', '-Wextra', '-Werror',
    '-fsanitize=address,undefined', '-I', 'firmware/include', 'firmware/test/core.cpp', '-o', binary]);
  run(binary, []);
  // Exercise the actual Receiver encoder over loopback HTTP, then feed the exact
  // bytes it sent to the same C++ parser compiled into the device firmware.
  const states = [];
  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();
    const result = spawnSync(binary, [body], { encoding: 'utf8' });
    const valid = request.url === '/json/state' && request.method === 'POST' &&
      request.headers['content-type'] === 'application/json' && result.status === 0;
    if (valid) states.push(result.stdout);
    response.writeHead(valid ? 200 : 422, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ success: valid }));
  });
  let output;
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject); server.listen(0, '127.0.0.1', resolve);
    });
    output = new WledOutput({ baseUrl: `http://127.0.0.1:${server.address().port}`,
      presets: DEFAULT_RECEIVER_CONFIG.presets, retryDelaysMs: [] });
    for (const state of ['idle', 'working', 'blocked', 'done', 'unknown']) {
      output.ensureState(state); await output.waitForIdle();
    }
    assert.deepEqual(states, ['idle', 'working', 'blocked', 'done', 'unknown']);
    console.log('PASS: actual Receiver HTTP payloads accepted by firmware C++ parser');
  } finally {
    output?.close();
    await new Promise((resolve) => server.close(resolve));
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
