import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HerdrApi, HerdrProtocolError } from '../server/herdr-api.mjs';

async function serveProtocol(context, protocol) {
  const directory = await mkdtemp(join(tmpdir(), 'agentbeacon-herdr-api-'));
  const socketPath = join(directory, 'herdr.sock');
  context.after(() => rm(directory, { recursive: true, force: true }));
  const server = net.createServer((socket) => {
    socket.once('data', (data) => {
      const request = JSON.parse(data.toString().trim());
      socket.end(`${JSON.stringify({
        id: request.id,
        result: { type: 'pong', version: '0.8.2', protocol },
      })}\n`);
    });
  });
  await new Promise((resolve) => server.listen(socketPath, resolve));
  context.after(() => server.close());
  return socketPath;
}

test('Herdr API accepts the verified protocol 20 pong', async (context) => {
  const api = new HerdrApi(await serveProtocol(context, 20));
  assert.equal((await api.ping()).protocol, 20);
});

test('Herdr API rejects other protocol versions', async (context) => {
  const api = new HerdrApi(await serveProtocol(context, 21));
  await assert.rejects(api.ping(), HerdrProtocolError);
});
