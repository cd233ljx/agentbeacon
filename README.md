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

已完成 Herdr Unix socket 验证、v1 协议、Receiver、模拟 WLED、聚合发送端，以及 Android/Termux 的 Tailscale、热点和短时锁屏可行性验证。下一步可推进 T-008 Demo；ESP32/WLED 硬件和 Windows 尚未联调。当前无第三方依赖。

```bash
cd /home/cd233/CODE/Linux_Exp/agentbeacon
npm ci
npm run doctor
npm run check
npm test
```

安全回环链路可依次运行 `npm run receiver` 和 `npm run sender`；Receiver 默认只监听 `127.0.0.1:8787`。

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

配置模板 receiver/config.example.json 尚未接入代码。开发默认回环监听；私网联调使用接收端具体 Tailscale IP。
