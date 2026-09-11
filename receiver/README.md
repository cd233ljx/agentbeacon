# Receiver

跨平台 Node.js 原生 HTTP 服务。Android Termux 为主，Windows 为备用。正式同步使用 `POST /v1/state`；配置 `demoEnabled: true` 后可用独立 Demo 接口。已实现心跳超时、去重、WLED 恢复和 dry-run，具体规则见 [协议与状态规则](../docs/protocol.md)。

默认示例以 dry-run 监听回环地址，不会访问配置中的占位 WLED：

```bash
npm run receiver
curl http://127.0.0.1:8787/health
```

自定义配置使用 `npm run receiver -- --config <path>`。`host` 禁止 `0.0.0.0` 和 `::`；远程联调必须填接收端具体 Tailscale IP。将 `dryRun` 改为 `false` 前必须确认 `wledBaseUrl` 和五个 preset，Receiver 会按 WLED JSON API 向 `/json/state` 发送 `{"ps": preset}`。

Demo 最小操作：

```bash
curl -X POST http://127.0.0.1:8787/state -H 'Content-Type: application/json' -d '{"state":"blocked"}'
curl -X DELETE http://127.0.0.1:8787/state
```

只做现场展示、不需要读取真实状态时，可以跳过 Herdr 和 Sender。在手机启动 Receiver 后，于服务器运行按键 TUI：

```bash
npm run demo -- --url http://<手机地址>:8787/v1/state
```

按 `1`～`5` 分别向手机发送 idle、working、blocked、done、unknown，按 `q` 发送 idle 并退出。TUI 不连接 Herdr，只生成合法的手动 v1 快照；手机 Receiver 仍负责后续 WLED 输出。

Demo 期间正式快照继续缓存但不覆盖灯效，退出后恢复未超时的正式状态，否则显示 unknown。`GET /health` 返回聚合状态、超时、dry-run 和 Demo 标志，不返回任务或 Agent 信息。

参考任务 T-005、T-006、T-008、T-010、T-011；不在核心逻辑中依赖 shell 或 systemd。
