# Receiver

跨平台 Node.js HTTP 接收端，负责协议校验、快照排序、超时及 preset 输出。Android/Termux 为真机验收平台；Windows 完整链路未单独验收。

```bash
npm run receiver
```

源仓库默认读取 receiver/config.example.json，在 127.0.0.1:8787 运行 dry-run。真实设备先复制配置为 receiver/config.json，填写自己的 host/wledBaseUrl，再运行：

```bash
npm run receiver -- --config receiver/config.json
```

GET /health 返回期望状态；POST /v1/state 接受正式快照。独立手机包和启停说明见 [Termux 指南](../docs/termux-receiver.md)。

本机按键演示要显式指定地址：

```bash
npm run demo -- --url http://127.0.0.1:8787/v1/state
```

按 1～5 切换五态，q 发送 idle 并退出；没有持续心跳，停留超时 unknown。按键 Demo 的 URL 优先级为 --url > AGENTBEACON_RECEIVER_URL > 回环默认值。npm run demo 自动读取项目 .env.local。

显式 HTTP Demo 需 demoEnabled=true；POST /state 进入、DELETE /state 退出，与按键 Demo 不同。协议和覆盖规则见 [protocol](../docs/protocol.md)。
