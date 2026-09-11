# Herdr 适配层（待实现）

只通过 Herdr Unix socket 采集 Herdr 内启动的终端 Agent 状态，交给 shared 聚合后，经 Tailscale HTTP POST 到手机 Receiver。CLI 仅用于只读核实环境，不作为状态来源。

T-003 已核实 Herdr 0.8.2 / protocol 20 的主 API socket、原始状态和订阅行为。参考示例不等于官方维护插件；startup hook 不作为常驻进程监督器。不要读取 agent 认证或终端正文。

实现快照、心跳、超时、重试、重连与旧状态淘汰；具体规则以 [协议与状态规则](../docs/protocol.md) 为准。
