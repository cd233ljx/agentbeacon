# 最新交接

日期：2026-09-12
当前阶段：T-003～T-008、T-012A、T-010A、T-012B 完成。用户选择先用 WLED 跑通，再规划自研固件。硬件尚未到货，型号/灯数/供电未提供。完整版 Receiver 已通过 SSH 部署到手机，当前等待硬件到货后配置 WLED 并实测灯光。

## 运行包准备记录（手机部署前）

- 新增 scripts/package-receiver.mjs、receiver/config.termux.example.json、docs/termux-receiver.md、docs/evidence/T-012A.md；同步 package.json、.gitignore、README、receiver/README、proposal、tasks、decisions 和交接。
- `npm run package:receiver` 生成 dist/agentbeacon-receiver-0.1.0.tgz 和同名 .sha256；dist 不入版本管理。包只含 11 个所需文件，运行无需 npm install；手机启动入口 `npm start` 明确使用 receiver/config.json。
- 示例监听手机上次验证的 100.91.207.103:8787，dryRun=true；安装前核对手机当前 Tailscale IP。仓库默认开发监听仍为回环。
- 本机 Linux / Node v24.18.0 / npm 11.16.0：解包后独立 npm start、模拟 WLED 五态、去重、实际默认 15 秒超时及恢复通过；直接 Node 启动 dry-run 并 SIGINT 退出码 0。48 项测试、npm run check、git diff --check 和 Markdown 相对链接检查通过。详细证据见 [T-012A](evidence/T-012A.md)。
- 未修改 Receiver 业务逻辑，未新增依赖，未连接手机或读取真实 Herdr 会话，未开放下载服务或改动常驻进程；测试服务和临时目录已清理。
- 纠正操作说明：按键 TUI 不发持续心跳，停留超过约 15 秒会 unknown；固定显示使用显式 HTTP Demo，持续真实状态使用 Sender。TUI 与 Sender 不应同时运行。

## 最新运行状态：已停止后台实例

用户准备在 Termux 前台启动并查看 Demo 打印。已通过 SSH 核对 PID 16384 的命令和 cwd 确属 receiver-et6Qrz，发送 SIGTERM 后确认进程消失、8787 health 不可访问。当前没有由本任务保留的 Receiver 后台服务；receiver.pid 中的 16384 是历史值，不能据此直接杀进程。用户随后在手机前台启动并运行服务器 Demo，回复“可以了”，确认手机打印正常。当前前台服务是否继续运行以用户会话为准。下一步等待硬件到货，核实板型、灯数和供电后执行 T-009 的 WLED 配置，再完成 T-010 真实灯环联调。此前部署记录中的“运行中”仅代表当时状态。

## 手机 SSH 配置（T-012B）

用户要求持久化登录配置，已创建本机 .local/ssh/config，别名 agentbeacon-phone。项目根目录使用 `ssh -F .local/ssh/config agentbeacon-phone`；SCP 同样支持 `-F`。指定专用密钥和已核对的 known_hosts，开启严格校验，未修改全局 SSH 设置。实测 whoami/node --version 返回 u0_a320/v26.3.1。详见 [手机 SSH 操作入口](phone-ssh.md)。.local 不入 Git，不输出其中私钥；仓库迁移需更新配置中的绝对路径。本轮同时修复任务表 T-012 行误拆，文档和任务表一致性检查通过。

## 下一步与限制

手机安装目录：`/data/data/com.termux/files/home/agentbeacon/releases/receiver-et6Qrz`；PID 16384（操作前须重新核对 PID 与命令），日志 receiver.log，配置 receiver/config.json。当前 detached Node 进程在 SSH 断开后仍运行，不具备自动重启；未配置 wake-lock 或自启。重启可进入该目录执行 `npm start`；停止时先检查 receiver.pid 指向的命令，再给本项目 Receiver 发送 SIGTERM。SSH 使用 u0_a320@100.91.207.103:8022；项目专用密钥和经用户核对的 known_hosts 位于 .local/ssh/，不入库。用户已添加公钥；不要输出私钥或更改全局认证。

手机 Node v26.3.1 / npm 11.17.0；安装包 SHA-256 校验通过，远程 working 快照 applied，health 为 working/timed_out=false/dry_run=true。仅进行一次接收检查，未重复完整模拟测试。证据见 [T-010A](evidence/T-010A.md)。硬件未到，保留 dryRun=true，不向占位 WLED 地址发送请求。

T-009 等硬件到货后核实板型、灯数、供电/GPIO，再配置 WLED preset；T-010 完成真机链路。T-011 Windows 备用及 T-012 进程管理和最终交付未完成。此前 T-005 仅证明旧探针网络及约 20 秒锁屏，不能外推到完整 Receiver 后台稳定性。真实 WLED/ESP32、Windows 未验证。新一轮自研固件尚未启动。

## 先前结果（截至 2026-09-11）

- 为课堂展示新增极简按键 TUI：不连接 Herdr、不读取真实 Agent 状态；`npm run demo` 默认把 `1`～`5` 的手动五态选择发送给 vivo-phone `100.91.207.103:8787`，`q` 发送 idle 并退出，地址变化时才需 `--url`。原版误做成本机 WLED dry-run，现已按手机链路修正并由用户复验通过。
- 手机当前运行的 `termux-receiver-probe.mjs` 只是入站联调探针，仅校验并打印 v1 状态；它不是完整 Receiver，不含 WLED 输出、状态超时、Demo API 或配置加载。接真实硬件前需将完整版 Receiver 部署到 Termux。
- Herdr Sender 的默认 Receiver 地址也已改为 vivo-phone `100.91.207.103:8787/v1/state`；手机探针启动后直接运行 `npm run sender` 即可转发真实 Herdr 状态，地址变化时仍可用自定义配置覆盖。
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

## 先前验证

本轮 `npm test`：48 项通过、0 项失败；`npm run check`、`git diff --check` 和 Markdown 相对链接检查通过。TUI 已与本机同款 Termux 探针端到端验证 working 和退出 idle，并在手机服务重启后由用户确认正常。T-005 已取得早前真机网络和短时锁屏证据，但仍不代表真实 WLED 或长时间后台通过。
T-003 提交为 `962b6eb`，T-004 为 `ea410ae`，T-006 为 `9490b97`，T-007 为 `e1d7bb7`，T-005 为 `8851916`，T-008 基础实现为 `ed6a2ee`。无远程仓库配置。
