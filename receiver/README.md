# Receiver（待实现）

跨平台 Node.js 原生 HTTP 服务。Android Termux 为主，Windows 为备用。正式同步使用 `POST /v1/state`；简化的 `POST /state` 只在显式 Demo 模式启用。实现心跳超时、去重、WLED 恢复和 dry-run，具体规则见 [协议与状态规则](../docs/protocol.md)。

config.example.json 是未接入的模板。开发监听 127.0.0.1；远程联调显式配置具体 Tailscale IP。WLED 地址是占位符，必须实测手机到热点 ESP32 的路径。

参考任务 T-005、T-006、T-008、T-010、T-011；不在核心逻辑中依赖 shell 或 systemd。
