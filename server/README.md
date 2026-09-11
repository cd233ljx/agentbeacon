# Herdr 适配层（待实现）

只通过 Herdr Unix socket 采集 Herdr 内启动的终端 Agent 状态，交给 shared 聚合后，经 Tailscale HTTP POST 到手机 Receiver。CLI 仅用于只读核实环境，不作为状态来源。

按 T-003 核实安装版本的官方接口、原始状态和插件运行机制。参考示例不等于官方维护插件；startup hook 不作为常驻进程监督器。不要读取 agent 认证或终端正文。

实现快照、心跳、超时、重试、重连与旧状态淘汰；具体协议以 docs/protocol.md 后续定稿为准。
