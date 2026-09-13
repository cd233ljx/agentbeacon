# 首版完成记录

更新：2026-09-13。首版开发与用户验收已完成。以下保留历史任务编号；延期项是范围外能力，不代表当前版本未完成。未列证据的能力不作已验证承诺。

| ID | 任务 | 状态 | 依赖 | 负责人 | 验收条件 / 证据 |
| --- | --- | --- | --- | --- | --- |
| T-001 | 初始化仓库 | done | 无 | 初始化 Agent | Node/npm/Git/Herdr/Tailscale 可用；npm ci、doctor、check 通过；仅骨架 |
| T-002 | 当前方案与 Agent 管理入口 | done | T-001 | 文档 Agent | 当前架构、规则、任务、决策和交接齐全；本轮文档检查见 handoff |
| T-003 | Herdr Unix socket 接口与状态验证 | done | 无 | Codex | 已确认 0.8.2 / protocol 20、socket 权限、NDJSON/订阅接口、历史重放、采集进程生命周期；实测 idle/working/done/blocked/agent release；证据 docs/evidence/T-003.md |
| T-004 | 协议与状态规则 | done | T-003 | Codex | docs/protocol.md 已定义 v1 包、来源实例、顺序/重启、心跳/超时、清除、unknown 聚合、Demo 隔离及示例；D-007 经用户确认 |
| T-005 | 手机接收可行性探针 | done | 用户可操作手机 | Codex | Android 测试手机/Termux 在热点+Tailscale 下接收 working/blocked/done；锁屏 20 秒期间三次均成功，恢复后 idle 成功；证据 docs/evidence/T-005.md |
| T-006 | Receiver 与模拟 WLED | done | T-004 | Codex | 23 项测试通过；v1 校验/4096-byte 限制/顺序/15 秒超时/preset 映射/去重/有界重试与恢复均覆盖；回环 dry-run 实测，证据 docs/evidence/T-006.md |
| T-007 | 聚合与 Herdr 发送端 | done | T-003、T-004 | Codex | 默认向 Android 测试手机 发送；覆盖 protocol 20、双快照 reconciliation、历史重放、pane_not_found、生命周期清除、多会话优先级、心跳、合并重试、断线 unknown 与重连；证据 docs/evidence/T-007.md |
| T-008 | 独立 Demo 模式 | done | T-006 | Codex | HTTP Demo 隔离/恢复完成；按键 TUI 不读 Herdr、默认向 Android 测试手机 发送手动五态；48 项测试、本机端到端及手机复验通过，证据 docs/evidence/T-008.md |
| T-009 | 单颗 RGB 硬件定型与接线 | done | 用户设备操作；D-010 | Codex | ESP32 32E、共阴 RGB、IO25/26/27 各串 220Ω；最终面包板坐标已由用户确认成功；见 docs/evidence/T-010.md |
| T-010A | 手机完整版 Receiver 部署 | done | T-012A、手机 SSH | Codex | 公钥 SSH、包校验、完整版后台进程与远程 working 接收通过；用户前台 Demo 打印复验通过；证据 docs/evidence/T-010A.md；单颗 RGB 真灯已在 T-010 验收 |
| T-010 | Android 真机全链路 | done | T-005～T-009 | Codex | 用户最终确认全部完成；Demo 五态/超时恢复、真实 Herdr 联调和最终接线通过；按用户整体验收收口，逐项证据边界见 docs/evidence/T-010.md |
| T-011 | Windows 备用验证 | deferred | T-006、T-008；用户 Windows 环境 | — | 原生 Node 启动、模拟链路和停止流程实测；真实 WLED 未测则明确标注 |
| T-012A | 手机 Receiver 运行包与使用说明 | done | T-006、T-008 | Codex | 白名单包独立 npm start、模拟 WLED 五态/15 秒超时/恢复/去重、dry-run 与停止通过；48 项测试通过；证据 docs/evidence/T-012A.md；手机部署与真机验收见 T-010 |
| T-012B | 持久化手机 SSH 连接配置 | done | T-010A | Codex | 项目别名 agentbeacon-phone 登录通过；严格主机校验、独立密钥生效；证据及操作见 docs/phone-ssh.md |
| T-012 | 自动运行管理（首版范围外） | deferred | T-010 | — | Linux 进程管理、Termux 启停/后台说明、演示脚本、故障排查和回滚齐全；部署需实际授权 |
| T-013 | 单颗 RGB 自研固件及学习说明 | done | classic ESP32；D-010/D-011 | Codex | 固件已刷入实物，用户确认真灯运行与最终接线正常；本轮未更换 GPIO 或修改固件；证据 docs/evidence/T-013.md、docs/evidence/T-010.md |
| T-014 | GitHub 私有仓库与 Windows 克隆交接 | done | 用户授权；GitHub 登录 | Codex | cd233ljx/agentbeacon 创建为 PRIVATE；main 推送成功；GitHub 可见性已校验；源码不含本地密钥/配置/缓存；见 handoff |
| T-015 | 手机真实输出成功日志 | done | T-010A；手机 SSH | Codex | 成功显示 state/preset；重复心跳不刷屏；失败不报成功、恢复可见；3 项对应测试和 check 通过；receiver-example 已更新，手机真实五态、三次心跳去重、超时及恢复通过；证据 docs/evidence/T-015.md |
| T-016 | Sender 状态与处置日志 | done | T-007 | Codex | 首次/状态变化/故障恢复可见，重复心跳安静；退休实例不误报同步成功；6 项发送端/应用测试及 check 通过；用户手动重启后观察真实日志；证据 docs/evidence/T-016.md |

| T-017 | 开源文档与发布准备 | done | 首版验收 | Codex | 公开指南、Apache-2.0、当前文件脱敏、环境变量保留演示；51 项测试/check/链接/打包与校验通过；历史仍待发布决策；不自动发布 |
