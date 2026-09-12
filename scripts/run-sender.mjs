import { resolve } from 'node:path';
import { createSenderApp } from '../server/app.mjs';
import { loadSenderConfig } from '../server/config.mjs';

function configPathFromArgs(arguments_) {
  if (arguments_.length === 0) return resolve('server/config.example.json');
  if (arguments_.length === 2 && arguments_[0] === '--config') return resolve(arguments_[1]);
  throw new Error('用法：node scripts/run-sender.mjs [--config <path>]');
}

const config = await loadSenderConfig(configPathFromArgs(process.argv.slice(2)));
const app = createSenderApp(config);
app.start();
console.log(`AgentBeacon 发送端已启动（source=${config.sourceId}, receiver=${config.receiverUrl}, heartbeat=${config.heartbeatIntervalMs}ms）`);

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  try {
    await app.stop();
  } catch (error) {
    console.error(`发送端停止失败：${error.message}`);
    process.exitCode = 1;
  }
}

process.once('SIGINT', stop);
process.once('SIGTERM', stop);
