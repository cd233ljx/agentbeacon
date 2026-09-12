import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('请使用 npm run package:receiver');
if (process.argv.length > 2) throw new Error('用法：npm run package:receiver');
const destination = resolve(root, 'dist');
const staging = await mkdtemp(join(tmpdir(), 'agentbeacon-receiver-'));
// 明确列出文件，避免将本机配置、日志、凭据或服务器代码收入运行包。
const files = [
  'receiver/config.mjs', 'receiver/server.mjs', 'receiver/state-store.mjs',
  'receiver/wled-output.mjs', 'receiver/config.example.json',
  'receiver/config.termux.example.json', 'shared/protocol.mjs',
  'shared/aggregation.mjs', 'scripts/run-receiver.mjs',
];
try {
  for (const file of files) {
    await mkdir(dirname(join(staging, file)), { recursive: true });
    await copyFile(join(root, file), join(staging, file));
  }
  await copyFile(join(root, 'docs/termux-receiver.md'), join(staging, 'README.md'));
  const { version, engines } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  await writeFile(join(staging, 'package.json'), `${JSON.stringify({
    name: 'agentbeacon-receiver', version, private: true, type: 'module', engines,
    scripts: { start: 'node scripts/run-receiver.mjs --config receiver/config.json' },
  }, null, 2)}\n`);
  await mkdir(destination, { recursive: true });
  const result = JSON.parse(execFileSync(process.execPath, [npmCli, 'pack', '--json',
    '--ignore-scripts', '--pack-destination', destination], { cwd: staging, encoding: 'utf8' }));
  const filename = result[0].filename;
  const archive = join(destination, filename);
  const checksum = createHash('sha256').update(await readFile(archive)).digest('hex');
  await writeFile(`${archive}.sha256`, `${checksum}  ${filename}\n`);
  console.log(`运行包：${archive}\nSHA-256：${checksum}`);
} finally {
  await rm(staging, { recursive: true, force: true });
}
