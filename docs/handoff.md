# 最新交接

日期：2026-09-11
当前阶段：T-003 已完成；下一项为 T-004 协议与状态规则。尚无 Receiver、聚合或远程同步业务实现。

## 本轮结果

- T-003：确认 Herdr 0.8.2 / protocol 20 的主 API socket、权限、NDJSON 协议、五态和订阅接口，证据见 docs/evidence/T-003.md。
- Herdr pane 内实测 Agy 的 `idle → working → done → idle`，以及 Codex 的 `working → blocked → working → idle → agent_released`。
- 发现 0.8.2 生命周期订阅会重放历史事件，客户端必须用 `agent.list` / `agent.get` reconciliation；不能把订阅流当作仅含实时事件。
- Agy 普通交互式提问没有触发 blocked；Codex 交互式提问成功触发。未识别的上游 UI 不通过读取终端正文自行猜测。
- Agent 退出后的 release 已实测。用户随后关闭 pane；旧版 probe 因 release 后提前取消跟踪而漏记 pane_closed，代码已修正，用户确认无需重复采样。
- 新增安全被动采样器 scripts/probe-herdr.mjs 及 server/herdr-probe.mjs；只输出状态白名单字段，不读取终端正文。
- 新增 tests/herdr-probe.test.mjs，覆盖敏感字段过滤、两种状态事件拼写、退出/关闭、订阅确认、内部 probe 错误及非法输入。
- T-002：新增当前方案、根 AGENTS.md、项目管理、任务表和决策表。
- 原始附件迁移为 docs/proposal-original.md，保留历史内容。
- README 和各模块说明统一为 Android 主接收端、Windows 备用；绿色常亮，无自动完成计时器。
- D-004 已由用户确认：关闭完成会话后清除其完成状态，按剩余会话重新聚合，无其他有效任务则熄灯；通信异常仍为 unknown。方案、决策、共享模块说明和 T-004 验收已同步。

## 验证

本轮 `npm test`：6 项通过、0 项失败；`npm run check` 通过。非 Herdr 环境运行采样器按预期拒绝。可用工具：Node 24.18.0、npm 11.16.0、Git 2.53.0、Herdr 0.8.2、Tailscale 1.102.2；只是工具版本，不证明设备链路可用。
本地 Markdown 相对链接检查通过。所有项目文件目前仍未提交，无远程仓库配置。

## 下一步

领取 T-004，依据 T-003 的真实协议事实编写 docs/protocol.md：定义 AgentBeacon 包版本、来源实例、序列号、心跳、过期、清除、unknown、历史事件 reconciliation 和示例，再为共享状态规则添加 node:test。
T-005 需用户操作 Android 手机，先提供 Termux 环境检查和最小接收步骤；在用户回传结果前只标待验证。

## 限制

当前开发 Agent 不在 Herdr 托管 pane 内，未越权读取用户 Herdr 会话；真实样本由用户在 Herdr shell pane 内运行白名单采样器取得。Agy 的普通提问 UI 在 0.8.2 下未识别为 blocked。pane_closed 未单独落日志，但 Agent release 已验证，用户确认无需补采。无手机/Windows/ESP32 实测证据；硬件未购买。未启动常驻服务、未安装插件、未改全局环境或网络。
