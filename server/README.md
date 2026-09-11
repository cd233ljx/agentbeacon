# Herdr 聚合发送端

只通过 Herdr Unix socket 采集 Herdr 内启动的终端 Agent 状态，交给 shared 聚合后，经 Tailscale HTTP POST 到手机 Receiver。CLI 仅用于只读核实环境，不作为状态来源。

T-003 已核实 Herdr 0.8.2 / protocol 20 的主 API socket、原始状态和订阅行为。T-007 已实现两次 `agent.list` reconciliation、逐 pane 状态订阅、历史生命周期核对、断线重连、多会话聚合及 HTTP 心跳。参考示例不等于官方维护插件；startup hook 不作为常驻进程监督器。代码不请求终端正文，也不向 Receiver 发送 Agent 名称、pane ID 或会话信息。

先启动 Receiver，再启动发送端：

```bash
npm run receiver
npm run sender
```

默认发送端配置连接 `127.0.0.1:8787`，Herdr socket 优先使用 `herdrSocketPath`，其次使用 `HERDR_SOCKET_PATH`，最后使用默认 session 的 `~/.config/herdr/herdr.sock`。自定义配置使用 `npm run sender -- --config <path>`；远程 Receiver 地址必须显式填写具体 Tailscale IP。

快照、心跳、超时、重试、重连与旧状态淘汰规则以 [协议与状态规则](../docs/protocol.md) 为准。正式进程监督留给 T-012。
