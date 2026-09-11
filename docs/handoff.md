# 最新交接

日期：2026-09-11
当前阶段：T-003、T-004、T-006 已完成；下一项为 T-007 Herdr 聚合发送端。尚未进行手机、Windows 或硬件联调。

## 本轮结果

- T-006：实现跨平台 Node.js Receiver、v1 协议校验、请求体限制、来源限制、顺序/重启处理、心跳超时、dry-run 和 WLED 输出，证据见 docs/evidence/T-006.md。
- Receiver 默认只监听 `127.0.0.1:8787`，并明确拒绝 `0.0.0.0` / `::`；远程联调需显式填写具体 Tailscale IP。
- WLED 输出按官方 JSON API 向 `/json/state` POST `{"ps": preset}`；成功状态不重复发送，失败有界重试，后续心跳可恢复，更新状态会取消旧状态尚未发出的重试。
- `POST /state` 仍未实现且返回 404；`demoEnabled` 只是 T-008 预留配置，不能把它视为已完成 Demo。
- T-004：新增 docs/protocol.md，正式定义 AgentBeacon HTTP/JSON v1，包括来源/进程实例、递增序号、重复/乱序/重启、心跳/过期、错误响应、发送合并、WLED 恢复与 Demo 隔离。
- 用户确认 D-007：部分会话 unknown 时使用 `blocked > working > unknown > done > idle`；已知阻塞和工作优先，只有没有更高优先级活动时才显示采集异常。
- 聚合规则明确：采集健康且零会话为 idle；release/exit/close 后删除会话并重新聚合；全局采集初始化、失败或协议不兼容均为 unknown。
- 正式 Receiver 接口为 `POST /v1/state`；简化 `POST /state` 仅属显式 Demo。Receiver 默认回环监听，私网联调必须显式绑定具体 Tailscale IP 并限制 source_id。
- 工程默认心跳/过期为 5 秒/15 秒，仍需在 T-010 真机调优。顺序判断只用 instance_id 和 sequence；sent_at 仅供诊断，超时使用 Receiver 本地单调时钟。
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
- D-004 已由用户确认：关闭完成会话后清除其完成状态，按剩余会话重新聚合，无其他有效任务则熄灯；通信异常仍为 unknown。

## 验证

本轮 `npm test`：23 项通过、0 项失败；`npm run check` 与 `git diff --check` 通过。回环 dry-run 实测初始 unknown、接收 done、15 秒无新 sequence 后回到 unknown，服务随后已停止。本地模拟 WLED 实测接口、preset、去重、失败重试和恢复；不代表真实设备通过。
本地 Markdown 相对链接检查通过。T-003 提交为 `962b6eb`，T-004 提交为 `ea410ae`；T-006 修改尚未提交。无远程仓库配置。

## 下一步

领取 T-007，复用 shared 协议规则实现 Herdr 生命周期 reconciliation、多会话聚合、5 秒心跳、状态合并发送、断线 unknown 与重连。T-005 可在用户方便操作 Android/Termux 时进行，但没有真机结果不得标记完成。
T-005 需用户操作 Android 手机，先提供 Termux 环境检查和最小接收步骤；在用户回传结果前只标待验证。

## 限制

当前开发 Agent 不在 Herdr 托管 pane 内，未越权读取用户 Herdr 会话；真实样本由用户在 Herdr shell pane 内运行白名单采样器取得。Agy 的普通提问 UI 在 0.8.2 下未识别为 blocked。pane_closed 未单独落日志，但 Agent release 已验证，用户确认无需补采。无手机/Windows/ESP32/真实 WLED 实测证据；硬件未购买。dry-run Receiver 已停止；未启动常驻服务、未安装插件、未改全局环境或网络。
