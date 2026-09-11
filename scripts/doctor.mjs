import { spawnSync } from 'node:child_process';

const supported = Number(process.versions.node.split('.')[0]) >= 24;
console.log(`${supported ? 'OK' : 'FAIL'} Node.js ${process.version} (要求 >=24)`);
if (!supported) process.exitCode = 1;
for (const [command, args, required] of [
  ['npm', ['--version'], true],
  ['git', ['--version'], true],
  ['herdr', ['--version'], false],
  ['tailscale', ['version'], false],
]) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 5000 });
  const ok = !result.error && result.status === 0;
  console.log(`${ok ? 'OK' : required ? 'FAIL' : 'OPTIONAL'} ${command}: ${ok ? result.stdout.trim().split('\n')[0] : '不可用'}`);
  if (!ok && required) process.exitCode = 1;
}
console.log('仅检查工具可用性；不启动服务，也不验证 Tailscale 连接或硬件状态。');
