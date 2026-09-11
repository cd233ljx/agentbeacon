# AgentBeacon

基于 Linux 与 IoT 的 AI Coding Agent 物理状态指示系统。

Linux / Herdr 内终端 Agent → 状态聚合 → Tailscale → Android / Termux Receiver → 手机热点 → ESP32 / WLED → RGB 灯环。

Windows 为备用接收端。完成显示绿色常亮。软件开发由 Agent 执行，项目规则和任务进度统一维护在仓库中。

## 开始开发

Agent 先读 [AGENTS.md](AGENTS.md)，再按 [任务看板](docs/tasks.md) 领取工作。

- [当前执行方案](docs/proposal.md)
- [项目管理规则](docs/project-management.md)
- [协议与状态规则](docs/protocol.md)
- [决策与待确认事项](docs/decisions.md)
- [最新交接](docs/handoff.md)
- [原始方案存档](docs/proposal-original.md)（历史参考）

## 当前进度

已完成 Herdr Unix socket 验证、v1 协议、Receiver、模拟 WLED、聚合发送端、独立 Demo，以及 Android/Termux 的 Tailscale、热点和短时锁屏验证。软件模拟链路已经闭合；下一步 T-009 需要确认和采购 ESP32/灯环，真实 WLED 和 Windows 尚未联调。当前无第三方依赖。

```bash
cd /home/cd233/CODE/Linux_Exp/agentbeacon
npm ci
npm run doctor
npm run check
npm test
```

安全回环链路可依次运行 `npm run receiver` 和 `npm run sender`；Receiver 默认只监听 `127.0.0.1:8787`。

课堂展示可直接运行 `npm run demo`。这个极简 TUI 不连接 Herdr、不读取真实 Agent 状态；按 `1`～`5` 手动切换 idle、working、blocked、done、unknown，按 `q` 切回 idle 并退出。默认示例为 dry-run；接真实 WLED 时使用 `npm run demo -- --config <path>`。

## 目录

| 目录 | 职责 |
| --- | --- |
| server/ | Herdr 适配、远程发送 |
| receiver/ | 跨平台 HTTP 接收、WLED preset 映射 |
| shared/ | 状态协议与聚合 |
| tests/ | 后续单元与模拟集成测试 |
| scripts/ | 环境与语法检查 |
| systemd/ | Linux 服务器后续进程管理 |
| docs/ | 方案、任务、决策、交接与验收证据 |

开发默认回环监听；私网联调使用接收端具体 Tailscale IP。
