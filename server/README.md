# Herdr 聚合发送端

只通过 Herdr Unix socket 采集 Herdr 内启动的终端 Agent 状态，交给 shared 聚合后，经 Tailscale HTTP POST 到手机 Receiver。CLI 仅用于只读核实环境，不作为状态来源。

T-003 已核实 Herdr 0.8.2 / protocol 20 的主 API socket、原始状态和订阅行为。T-007 已实现两次 `agent.list` reconciliation、逐 pane 状态订阅、历史生命周期核对、断线重连、多会话聚合及 HTTP 心跳。参考示例不等于官方维护插件；startup hook 不作为常驻进程监督器。代码不请求终端正文，也不向 Receiver 发送 Agent 名称、pane ID 或会话信息。

先启动 Receiver，再启动发送端：

```bash
npm run receiver
npm run sender
```

默认发送端配置连接 vivo-phone 的 `http://100.91.207.103:8787/v1/state`。Herdr socket 优先使用 `herdrSocketPath`，其次使用 `HERDR_SOCKET_PATH`，最后使用默认 session 的 `~/.config/herdr/herdr.sock`。地址变化时可用 `npm run sender -- --config <path>` 覆盖；远程 Receiver 地址必须是具体 Tailscale IP。

快照、心跳、超时、重试、重连与旧状态淘汰规则以 [协议与状态规则](../docs/protocol.md) 为准。正式进程监督留给 T-012。

## Sender 日志与 Demo 切换

首次确认、state/cause 变化和发送故障恢复时打印 `Receiver 已确认快照 state=working cause=aggregate sequence=2 disposition=applied`，稳定心跳不刷屏。该日志只证明 Receiver 确认快照；真实设备输出以手机成功日志和灯效为准。stale/retired_instance 会打印“未采用快照”，相同状态与处置的重复心跳不重复提示。

按键 `npm run demo` 与 Sender 都使用 `/v1/state` 和同一 source_id，没有固定优先级；新 instance 第一次发包会退休旧 instance。先退出当前发送器再启动另一个；返回旧 Sender 时需要重启生成新 instance。按键 Demo 不发送持续心跳，退出或停留超时后会 unknown。

显式 HTTP Demo 是另一机制：启用 demoEnabled 后 POST /state 覆盖灯效，真实快照继续缓存；DELETE /state 后恢复最新未过期状态，否则 unknown。当前手机 demoEnabled=false。
