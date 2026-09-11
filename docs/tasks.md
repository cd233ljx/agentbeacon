# 任务看板

更新：2026-09-11。未列实测证据的能力均未验证。负责人“—”表示尚未领取。

| ID | 任务 | 状态 | 依赖 | 负责人 | 验收条件 / 证据 |
| --- | --- | --- | --- | --- | --- |
| T-001 | 初始化仓库 | done | 无 | 初始化 Agent | Node/npm/Git/Herdr/Tailscale 可用；npm ci、doctor、check 通过；仅骨架 |
| T-002 | 当前方案与 Agent 管理入口 | done | T-001 | 文档 Agent | 当前架构、规则、任务、决策和交接齐全；本轮文档检查见 handoff |
| T-003 | Herdr Unix socket 接口与状态验证 | done | 无 | Codex | 已确认 0.8.2 / protocol 20、socket 权限、NDJSON/订阅接口、历史重放、采集进程生命周期；实测 idle/working/done/blocked/agent release；证据 docs/evidence/T-003.md |
| T-004 | 协议与状态规则 | done | T-003 | Codex | docs/protocol.md 已定义 v1 包、来源实例、顺序/重启、心跳/超时、清除、unknown 聚合、Demo 隔离及示例；D-007 经用户确认 |
| T-005 | 手机接收可行性探针 | todo | 用户可操作手机 | — | 最小 Receiver 在 Termux 打印服务器模拟状态；热点+Tailscale 共存；记录锁屏和恢复结果；不要求硬件 |
| T-006 | Receiver 与模拟 WLED | todo | T-004 | — | 校验/请求体限制/超时/映射/去重/恢复测试通过；dry-run 可操作；默认回环监听 |
| T-007 | 聚合与 Herdr 发送端 | todo | T-003、T-004 | — | 多会话优先级、心跳、采集失败、重连新快照、旧状态淘汰测试通过 |
| T-008 | 独立 Demo 模式 | todo | T-006 | — | 可切换五态；真实同步不覆盖 Demo；退出恢复有效快照或 unknown |
| T-009 | 硬件定型与 WLED 配置 | todo | 用户采购与设备操作 | — | 核实板型/供电/引脚；五个 preset 实测；备份不含 Wi-Fi 凭据的 preset 配置 |
| T-010 | Android 真机全链路 | todo | T-005～T-009 | — | 真实 working→blocked→done 常亮；多 Agent、超时黄灯和恢复；手机访问热点 ESP32；记录延迟与限制 |
| T-011 | Windows 备用验证 | todo | T-006、T-008；用户 Windows 环境 | — | 原生 Node 启动、模拟链路和停止流程实测；真实 WLED 未测则明确标注 |
| T-012 | 运行管理与交付 | todo | T-010 | — | Linux 进程管理、Termux 启停/后台说明、演示脚本、故障排查和回滚齐全；部署需实际授权 |

独立起点：T-003 与 T-005；没有手机或硬件访问时可推进模拟器、协议中已明确部分和测试，不伪造设备结果。
