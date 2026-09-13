# AgentBeacon

基于 Linux 与 IoT 的 AI Coding Agent 物理状态指示系统。

Linux / Herdr 内终端 Agent → 状态聚合 → Tailscale → Android / Termux Receiver → 手机热点 → ESP32 自研固件 → 单颗 RGB 灯（WLED/灯环为可选方案）。

Windows 为备用接收端。完成显示绿色常亮。软件开发由 Agent 执行，项目规则和任务进度统一维护在仓库中。

## 开始开发

Agent 先读 [AGENTS.md](AGENTS.md)，再按 [任务看板](docs/tasks.md) 领取工作。

- [当前执行方案](docs/proposal.md)
- [项目管理规则](docs/project-management.md)
- [协议与状态规则](docs/protocol.md)
- [决策与待确认事项](docs/decisions.md)
- [最新交接](docs/handoff.md)
- [手机 SSH 操作入口](docs/phone-ssh.md)
- [原始方案存档](docs/proposal-original.md)（历史参考）

## 当前进度

已完成 Herdr Unix socket 验证、v1 协议、Receiver、模拟 WLED、聚合发送端、独立 Demo，以及 Android/Termux 的 Tailscale、热点和短时锁屏验证。用户已确认服务器 Demo 控制 ESP32 单颗 RGB 真灯，五态和超时恢复通过；真实 Herdr 联调及最终接线已获用户整体验收，详见 [真机验收](docs/evidence/T-010.md)；长期后台稳定性和 Windows 尚待验证。Node.js 链路无第三方依赖；固件使用固定版本 PlatformIO/Arduino 工具链。

```bash
cd /home/cd233/CODE/Linux_Exp/agentbeacon
npm ci
npm run doctor
npm run check
npm test
```

`npm run receiver` 默认只监听本机 `127.0.0.1:8787`；`npm run sender` 则默认从 Herdr Unix socket 读取真实状态并发送至 vivo-phone 的 `100.91.207.103:8787`。

课堂展示直接运行 `npm run demo`，默认连接 vivo-phone 的 `100.91.207.103:8787`。这个极简 TUI 不连接 Herdr、不读取真实 Agent 状态，而是把按键选择手动发送给手机 Receiver；按 `1`～`5` 切换 idle、working、blocked、done、unknown，按 `q` 发送 idle 并退出。目标变化时可用 `--url` 覆盖。

## 单颗 RGB 自研固件

已完成 classic ESP32 单灯固件并由用户在 32E 实物刷机验收，阅读 [固件学习与 review 指南](firmware/README.md)。包含五态灯效、HTTP preset 兼容、极性配置和桌面测试。仓库示例 GPIO 输出默认禁用；本次实物最终接线坐标见 [验收记录](docs/evidence/T-010.md)。

## 手机运行包

运行 `npm run package:receiver` 生成 `dist/agentbeacon-receiver-0.1.0.tgz` 和 SHA-256 校验文件。手机无硬件时先用 dry-run；安装、启停、日志、超时验证和回滚见 [Termux 完整版 Receiver 指南](docs/termux-receiver.md)。

## 目录

| 目录 | 职责 |
| --- | --- |
| firmware/ | 单颗 RGB 自研固件、配置示例和 C++ 测试 |
| server/ | Herdr 适配、远程发送 |
| receiver/ | 跨平台 HTTP 接收、WLED preset 映射 |
| shared/ | 状态协议与聚合 |
| tests/ | 后续单元与模拟集成测试 |
| scripts/ | 环境与语法检查 |
| systemd/ | Linux 服务器后续进程管理 |
| docs/ | 方案、任务、决策、交接与验收证据 |

开发默认回环监听；私网联调使用接收端具体 Tailscale IP。
