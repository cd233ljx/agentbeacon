# 最新交接

日期：2026-09-11
当前阶段：T-003～T-008 均已完成；软件模拟链路闭合。下一项 T-009 需要确认/采购 ESP32、灯环和供电；Android/Termux 网络已验证，Windows 和真实 WLED 尚未联调。

## 本轮结果

- 为课堂展示新增 `npm run demo` 极简按键 TUI：不连接 Herdr、不读取真实 Agent 状态、不启动 HTTP 服务；`1`～`5` 手动切换五态，`q` 恢复 idle 并退出。默认使用 dry-run，传入真实 Receiver 配置即可直接控制 WLED preset。
- T-008：实现显式 Demo 模式；配置启用后 `POST /state` 切换五态，`DELETE /state` 退出，证据见 docs/evidence/T-008.md。
- Demo 期间正式 `/v1/state` 继续校验、排序和刷新，但不覆盖 Demo；退出恢复未超时正式状态，否则 unknown。默认 `demoEnabled=false`，未启用时接口返回 404。
- T-005：vivo-phone 的 Termux 单文件 Receiver 已通过 Tailscale 接收服务器 v1 状态；热点同时开启，证据见 docs/evidence/T-005.md。
- 短时锁屏约 20 秒期间，以 10 秒间隔发送 working、blocked、done 均成功；测试后 idle 也成功。该结果不外推为长时间后台稳定。
- 本次按用户明确授权让手机临时监听 `0.0.0.0:8787`；正式 Receiver 仍拒绝通配监听。服务器单文件下载服务只绑定具体 Tailscale IP，现已停止。
- 服务器 curl 需使用 `--noproxy '*'` 才直连 Tailscale 地址；Node.js fetch 直连无此问题。8787 不是特权低端口。
- T-007：实现 Herdr protocol 20 客户端、双快照 reconciliation、历史生命周期核对、逐 pane 状态订阅、多会话聚合、断线重连和 HTTP 心跳发送，证据见 docs/evidence/T-007.md。
- 发送端启动时先发送 initializing/unknown；采集健康后发送 counts 聚合。Herdr 断线或 schema 失败立即输出 unknown，重连后重新订阅和获取完整快照，不重放灯效积压。
- Snapshot sender 每进程生成 instance UUID，sequence 严格递增；失败可同 sequence 有界重试，新状态替换未开始的旧重试，稳定状态默认每 5 秒发送新 sequence。
- 已用模拟 Herdr 完整验证 working → blocked → release 后 idle → 订阅断线 unknown 经真实回环 HTTP 到 Receiver；未读取真实用户会话。
- T-006：实现跨平台 Node.js Receiver、v1 协议校验、请求体限制、来源限制、顺序/重启处理、心跳超时、dry-run 和 WLED 输出，证据见 docs/evidence/T-006.md。
- Receiver 默认只监听 `127.0.0.1:8787`，并明确拒绝 `0.0.0.0` / `::`；远程联调需显式填写具体 Tailscale IP。
- WLED 输出按官方 JSON API 向 `/json/state` POST `{"ps": preset}`；成功状态不重复发送，失败有界重试，后续心跳可恢复，更新状态会取消旧状态尚未发出的重试。
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

本轮 `npm test`：45 项通过、0 项失败；`npm run check`、`git diff --check` 和 Markdown 相对链接检查通过。TUI 另经伪终端实际验证 `2` 切换 working、`q` 恢复 idle 并正常退出。T-005 已取得真机网络和短时锁屏证据，但仍不代表真实 WLED 或长时间后台通过；临时下载服务已确认停止。
T-003 提交为 `962b6eb`，T-004 为 `ea410ae`，T-006 为 `9490b97`，T-007 为 `e1d7bb7`，T-005 为 `8851916`，T-008 基础实现为 `ed6a2ee`。无远程仓库配置。

## 下一步

开始 T-009 前向用户确认现有硬件或采购清单，只核实具体 ESP32 板型、灯环灯数、5V 供电和 GPIO；没有硬件时不伪造 WLED 实测。若暂不采购，可先做 T-011 Windows 备用验证。

## 限制

当前开发 Agent 不在 Herdr 托管 pane 内，未越权读取用户 Herdr 会话；真实样本由用户在 Herdr shell pane 内运行白名单采样器取得。Agy 的普通提问 UI 在 0.8.2 下未识别为 blocked。pane_closed 未单独落日志，但 Agent release 已验证，用户确认无需补采。无手机/Windows/ESP32/真实 WLED 实测证据；硬件未购买。dry-run Receiver 已停止；未启动常驻服务、未安装插件、未改全局环境或网络。
