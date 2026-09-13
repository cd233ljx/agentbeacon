# 任务看板

更新：2026-09-13。未列实测证据的能力均未验证。负责人“—”表示尚未领取。

| ID | 任务 | 状态 | 依赖 | 负责人 | 验收条件 / 证据 |
| --- | --- | --- | --- | --- | --- |
| T-001 | 初始化仓库 | done | 无 | 初始化 Agent | Node/npm/Git/Herdr/Tailscale 可用；npm ci、doctor、check 通过；仅骨架 |
| T-002 | 当前方案与 Agent 管理入口 | done | T-001 | 文档 Agent | 当前架构、规则、任务、决策和交接齐全；本轮文档检查见 handoff |
| T-003 | Herdr Unix socket 接口与状态验证 | done | 无 | Codex | 已确认 0.8.2 / protocol 20、socket 权限、NDJSON/订阅接口、历史重放、采集进程生命周期；实测 idle/working/done/blocked/agent release；证据 docs/evidence/T-003.md |
| T-004 | 协议与状态规则 | done | T-003 | Codex | docs/protocol.md 已定义 v1 包、来源实例、顺序/重启、心跳/超时、清除、unknown 聚合、Demo 隔离及示例；D-007 经用户确认 |
| T-005 | 手机接收可行性探针 | done | 用户可操作手机 | Codex | vivo-phone/Termux 在热点+Tailscale 下接收 working/blocked/done；锁屏 20 秒期间三次均成功，恢复后 idle 成功；证据 docs/evidence/T-005.md |
| T-006 | Receiver 与模拟 WLED | done | T-004 | Codex | 23 项测试通过；v1 校验/4096-byte 限制/顺序/15 秒超时/preset 映射/去重/有界重试与恢复均覆盖；回环 dry-run 实测，证据 docs/evidence/T-006.md |
| T-007 | 聚合与 Herdr 发送端 | done | T-003、T-004 | Codex | 默认向 vivo-phone 发送；覆盖 protocol 20、双快照 reconciliation、历史重放、pane_not_found、生命周期清除、多会话优先级、心跳、合并重试、断线 unknown 与重连；证据 docs/evidence/T-007.md |
| T-008 | 独立 Demo 模式 | done | T-006 | Codex | HTTP Demo 隔离/恢复完成；按键 TUI 不读 Herdr、默认向 vivo-phone 发送手动五态；48 项测试、本机端到端及手机复验通过，证据 docs/evidence/T-008.md |
| T-009 | 单颗 RGB 硬件定型与接线 | doing | 用户设备操作；D-010 | Codex | 用户实物 32E，Windows CP2102 驱动安装后 COM3，Python 3.13.0；用户已提供 firmware.bin 生成日志，未刷机；Windows Codex 接续见 docs/windows-handoff.md；已核实官方共阴和三根 220Ω 方案；仍需核对实物朝向、GPIO 和供电；单路限流点亮；WLED 灯环改为可选 |
| T-010A | 手机完整版 Receiver 部署 | done | T-012A、手机 SSH | Codex | 公钥 SSH、包校验、完整版后台进程与远程 working 接收通过；用户前台 Demo 打印复验通过；证据 docs/evidence/T-010A.md；真实灯环仍待 T-010 |
| T-010 | Android 真机全链路 | todo | T-005～T-009 | — | 真实 working→blocked→done 常亮；多 Agent、超时黄灯和恢复；手机访问热点 ESP32；单颗 RGB 真灯；记录延迟与限制 |
| T-011 | Windows 备用验证 | todo | T-006、T-008；用户 Windows 环境 | — | 原生 Node 启动、模拟链路和停止流程实测；真实 WLED 未测则明确标注 |
| T-012A | 手机 Receiver 运行包与使用说明 | done | T-006、T-008 | Codex | 白名单包独立 npm start、模拟 WLED 五态/15 秒超时/恢复/去重、dry-run 与停止通过；48 项测试通过；证据 docs/evidence/T-012A.md；手机部署与真机验证仍属 T-010 |
| T-012B | 持久化手机 SSH 连接配置 | done | T-010A | Codex | 项目别名 agentbeacon-phone 登录通过；严格主机校验、独立密钥生效；证据及操作见 docs/phone-ssh.md |
| T-012 | 运行管理与交付 | todo | T-010 | — | Linux 进程管理、Termux 启停/后台说明、演示脚本、故障排查和回滚齐全；部署需实际授权 |
| T-013 | 单颗 RGB 自研固件及学习说明 | review | classic ESP32；D-010/D-011 | Codex | 已完成五态/HTTP/配置源码、IO25/26/27 接线和刷机指南、目标编译、C++ 故障测试和 Receiver 协议联测；证据 docs/evidence/T-013.md；等待用户 review，真机未验收 |

| T-014 | GitHub 私有仓库与 Windows 克隆交接 | doing | 用户授权；GitHub 登录 | Codex | 私有仓库创建、源码提交推送、远端校验；不上传密钥/本地配置/缓存 |

独立起点：T-003 与 T-005；没有手机或硬件访问时可推进模拟器、协议中已明确部分和测试，不伪造设备结果。
