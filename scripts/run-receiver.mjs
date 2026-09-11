import { resolve } from 'node:path';
import { loadReceiverConfig } from '../receiver/config.mjs';
import { createReceiverService, listenReceiver } from '../receiver/server.mjs';

function configPathFromArgs(arguments_) {
  if (arguments_.length === 0) return resolve('receiver/config.example.json');
  if (arguments_.length === 2 && arguments_[0] === '--config') return resolve(arguments_[1]);
  throw new Error('用法：node scripts/run-receiver.mjs [--config <path>]');
}

const config = await loadReceiverConfig(configPathFromArgs(process.argv.slice(2)));
const service = createReceiverService(config);
service.server.on('error', (error) => {
  console.error(`Receiver 服务错误：${error.message}`);
  process.exitCode = 1;
});
const address = await listenReceiver(service);
console.log(`Receiver 已监听 http://${address.address}:${address.port}（dry-run=${config.dryRun}）`);

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  service.server.close((error) => {
    if (error) {
      console.error(`Receiver 停止失败：${error.message}`);
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', stop);
process.once('SIGTERM', stop);
