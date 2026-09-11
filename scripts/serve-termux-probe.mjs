import http from 'node:http';
import { readFile } from 'node:fs/promises';

const arguments_ = process.argv.slice(2);
const host = arguments_[arguments_.indexOf('--host') + 1];
const duration = Number(arguments_[arguments_.indexOf('--duration') + 1] || 600);
const port = Number(arguments_[arguments_.indexOf('--port') + 1] || 8790);
if (!host || host === '0.0.0.0' || host === '::') throw new Error('--host 必须是具体地址');
if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('--port 无效');
if (!Number.isInteger(duration) || duration < 30 || duration > 1_800) throw new Error('--duration 必须为 30..1800 秒');

const body = await readFile(new URL('./termux-receiver-probe.mjs', import.meta.url));
const server = http.createServer((request, response) => {
  if (request.method !== 'GET' || request.url !== '/termux-receiver-probe.mjs') {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, {
    'content-type': 'text/javascript; charset=utf-8',
    'content-length': body.length,
    'cache-control': 'no-store',
  });
  response.end(body);
});
server.listen(port, host, () => {
  console.log(`READY http://${host}:${port}/termux-receiver-probe.mjs duration=${duration}s`);
});
const timer = setTimeout(() => server.close(), duration * 1_000);
process.once('SIGINT', () => {
  clearTimeout(timer);
  server.close();
});
