# AgentBeacon

把 AI Coding Agent 的工作状态变成桌面上的一颗灯。

AgentBeacon 从 **Linux 上的 Herdr** 获取终端 Agent 状态，经 Tailscale 发送到 **Android/Termux**，再通过手机热点控制 **ESP32 + 单颗 RGB 灯**。首版开发和真机用户验收已完成。

```text
Herdr → Linux Sender → Tailscale → 手机 Receiver → 热点 → ESP32 → RGB 灯
```

| 状态 | 灯效 |
| --- | --- |
| idle | 熄灭 |
| working | 蓝色呼吸 |
| blocked | 红色闪烁，等待必要输入或授权 |
| done | 绿色常亮，后台完成尚未查看 |
| unknown | 黄色慢闪，状态未知或通信超时 |

多个 Agent 按 `blocked > working > unknown > done > idle` 聚合。正常心跳不会反复重启灯效。Herdr 当前页面中的任务完成可能直接回到 idle；done 没有独立的自动熄灭计时器。

## 准备什么

- Linux 上运行 Herdr：本项目已验证 **0.8.2 / socket protocol 20**。
- Node.js **>=24**；Node 链路无第三方运行依赖。
- Android 手机：Termux、Node.js、Tailscale 和可供 ESP32 连接的 2.4GHz 热点。
- classic ESP32 开发板、共阴四脚 RGB 灯、三根 220Ω 电阻、面包板和 USB 线。

实物使用 ESP32 32E，GPIO25/26/27 分别连接红/绿/蓝，每路串联一个电阻。WLED 是可选兼容路径，本固件不是完整 WLED。

## 先在电脑上试用

```bash
git clone https://github.com/cd233ljx/agentbeacon.git
cd agentbeacon
npm ci
npm test
npm run receiver
```

Receiver 默认在 `127.0.0.1:8787` 运行 dry-run，不连接灯。在另一个交互式终端运行：

```bash
npm run demo -- --url http://127.0.0.1:8787/v1/state
```

按 1～5 切换五态，Receiver 会打印 state/preset；重复相同状态不刷屏。按 q 发送 idle 并退出。按键 Demo 不持续发心跳，停留约 15～16 秒会进入 unknown。

Sender 和按键 Demo 默认连接回环地址。远程使用可复制 `.env.example` 为 `.env.local`，设置 `AGENTBEACON_RECEIVER_URL`；`npm run sender` 和 `npm run demo` 会自动读取它。`.env.local` 不入 Git。Demo 的 `--url`、Sender 显式配置中的 receiverUrl 优先于环境变量。

## 连接真实灯

1. 按 [硬件接线与刷机](firmware/WIRING.md) 配置热点并上传固件。示例输出默认禁用，确认接线后在本地配置启用。
2. 按 [Termux Receiver 指南](docs/termux-receiver.md) 安装运行包，填写手机 Tailscale IP、设备热点 IP；先 dry-run，再切换真实输出。
3. 在 Linux 可以用上述 `.env.local` 后直接运行 `npm run sender`；或复制 `server/config.example.json` 为 `server/config.json`，把 receiverUrl 改为自己的 `http://手机TailscaleIP:8787/v1/state`，然后运行：

```bash
npm run sender -- --config server/config.json
```

Sender 默认每 5 秒同步，Receiver 默认 15 秒无新快照变 unknown。日志中的“Receiver 已确认”表示接收端确认快照；手机的“WLED 已应用”表示设备 HTTP 请求成功，实际灯效以设备观察为准。

**按键 Demo 与真实 Sender 交替运行。** 两者没有固定优先级，新实例首包会退休旧实例；切回时重新启动所需发送器。显式 HTTP Demo 的隔离机制见 [协议](docs/protocol.md)。

## 文档与验证

- [文档导航](docs/README.md)
- [固件原理](firmware/README.md)与[接线指南](firmware/WIRING.md)
- [状态协议](docs/protocol.md)、[Sender](server/README.md)、[Receiver](receiver/README.md)
- [兼容性与已知限制](docs/limitations.md)
- [用户真机验收记录](docs/evidence/T-010.md)
- [贡献指南](CONTRIBUTING.md)与[开发测试](docs/development.md)

Android 真灯和真实 Herdr 联调已获用户验收；Windows Receiver、长期后台运行、真实 WLED 硬件不在已验证承诺中。手机进程暂停或设备重启时的显示行为见已知限制。

## 许可证

[Apache License 2.0](LICENSE)。第三方工具和平台保留各自许可。开源发布准备与历史清理边界见 [发布说明](docs/release.md)。
