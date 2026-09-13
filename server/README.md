# Herdr Sender

从 Herdr Unix socket 采集状态，经聚合后向 Receiver 发送 v1 快照；不读取终端正文、提示词或 Agent 凭据。已验证 Herdr 0.8.2 / protocol 20。

## 配置和运行

默认目标为 http://127.0.0.1:8787/v1/state。复制 .env.example 为 .env.local，填写 AGENTBEACON_RECEIVER_URL 后直接 npm run sender；也可复制 server/config.example.json 为 server/config.json，修改 receiverUrl，然后显式运行：

```bash
npm run sender -- --config server/config.json
```

URL 优先级：显式配置 receiverUrl > 环境变量 AGENTBEACON_RECEIVER_URL > 回环默认值。npm 启动脚本从当前项目目录加载 .env.local，已导出的同名环境变量优先于该文件；直接 node scripts/run-sender.mjs 不自动加载文件。

Herdr socket 优先使用配置 herdrSocketPath，其次 HERDR_SOCKET_PATH，最后 ~/.config/herdr/herdr.sock。sourceId 必须与 Receiver allowedSourceId 一致。默认心跳 5000ms、HTTP 超时 2000ms，Ctrl+C 停止。

## 日志

首次、state/cause 变化和发送故障恢复时打印：

```text
Receiver 已确认快照 state=working cause=aggregate sequence=2 disposition=applied
```

稳定心跳安静。此日志不证明灯已亮；设备 HTTP 成功见手机输出日志。stale/retired_instance 打印“未采用快照”，相同处置不刷屏，检查是否同时运行其他 Sender/Demo。

## 与 Demo 切换

按键 Demo 也使用 /v1/state。新实例首次发包会退休旧实例，无固定 Demo/真实优先级；退出当前发送器再启动另一个，返回被退休的 Sender 需重启。

显式 HTTP Demo 是另一机制：启用后 POST /state 覆盖灯效，真实快照仍缓存；DELETE /state 恢复未过期状态，否则 unknown。详见 [协议](../docs/protocol.md)。
