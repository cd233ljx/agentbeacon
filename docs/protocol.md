# AgentBeacon 协议与状态规则 v1

更新：2026-09-11。本文定义 T-004 的正式协议，是发送端、Receiver、测试和演示模式实现的共同依据。

## 边界

协议分为两段：

1. Herdr → AgentBeacon 发送端：本机 Unix socket、Herdr protocol 20。
2. AgentBeacon 发送端 → Receiver：Tailscale 私网内 HTTP/JSON、本协议 `protocol_version: 1`。

Receiver 只需要总体状态，不接收 Agent 名称、任务内容、终端正文、工作目录、会话引用或凭据。`source_id` 是用户配置的设备标识，不是自动采集的主机名。

## 状态模型

### 单会话状态

发送端只纳入 Herdr `agent.list` 和生命周期事件确认仍然有效的 Agent：

| 状态 | 语义 |
| --- | --- |
| `blocked` | Herdr 已识别到需要用户回答、批准或授权的界面 |
| `working` | Agent 正在工作 |
| `done` | 后台工作完成且尚未被用户查看 |
| `idle` | Agent 可接受输入，且完成状态已被查看；或有效空闲 |
| `unknown` | Agent 存在，但 Herdr 无法可靠分类 |

不读取终端正文自行纠正 Herdr 状态。T-003 已确认屏幕检测可能漏掉新型提问 UI，例如 Agy 的普通交互式提问可能回落到 `idle`。

### 采集健康状态

发送端内部维护以下采集状态：

| 采集状态 | 总体输出 |
| --- | --- |
| `initializing` | `unknown` |
| `healthy` | 按当前有效会话聚合 |
| `unavailable` | `unknown` |
| `incompatible` | `unknown` |

只有成功完成 Herdr protocol 校验和初始 reconciliation 后才能进入 `healthy`。Socket 断开、请求/订阅失败或 schema/protocol 不兼容时，不能把缓存为空解释成 `idle`。

### 聚合优先级

采集健康时使用用户确认的优先级：

```text
blocked > working > unknown > done > idle
```

规则：

- 任一有效会话 `blocked`，总体为 `blocked`。
- 否则任一有效会话 `working`，总体为 `working`。
- 否则任一有效会话 `unknown`，总体为 `unknown`。
- 否则任一有效会话 `done`，总体为 `done`。
- 否则为 `idle`；这包括采集健康且没有有效会话的情况。
- `agent_released`、`pane_exited` 或 `pane_closed` 确认会话失效后，立即删除该会话并重新聚合，不保留其 `final_status`。
- 完成会话关闭后，按剩余有效会话重新聚合；没有其他有效会话时为 `idle`，灯灭。

示例：

| 会话集合 | 总体状态 |
| --- | --- |
| 空集合，采集健康 | `idle` |
| `done` | `done` |
| `done + unknown` | `unknown` |
| `working + unknown` | `working` |
| `blocked + working + unknown` | `blocked` |
| 采集失败，存在旧的 `working` 缓存 | `unknown` |

## Herdr socket 消费规则

发送端连接主 API socket，不连接 `herdr-client.sock`。默认 session 路径为 `~/.config/herdr/herdr.sock`，Herdr pane 内优先使用注入的 `HERDR_SOCKET_PATH`；命名 session 按 Herdr 规则解析。

启动或重连流程：

1. 用 `ping` 校验 server protocol；第一版只支持已验证的 protocol 20。
2. 建立 `pane.agent_detected`、`pane.exited`、`pane.closed` 生命周期订阅。
3. 调用 `agent.list` 获取当前有效 Agent。
4. 为每个 pane 建立 `pane.agent_status_changed` 订阅。
5. 再调用一次 `agent.list` reconciliation，补齐步骤 2～4 间的竞态。
6. 进入正常事件循环。

Herdr 0.8.2 会向新订阅者重放保留的历史生命周期事件。每条 detected/released/closed/exited 事件必须与当前 `agent.get` / `agent.list` 状态核对；`pane_not_found` 表示历史事件已失效，应静默丢弃。客户端兼容 schema 的下划线事件名和单 pane 订阅的点号事件名，忽略未知附加字段。

Socket 中断后立即把采集状态设为 `unavailable`，向 Receiver 发送最新的 `unknown` 快照，然后采用有上限的退避重新连接。成功后执行完整启动流程，不重放 AgentBeacon 自身积压的灯效事件。

## HTTP 接口

正式同步接口：

```text
POST /v1/state
Content-Type: application/json
```

请求体上限为 4096 bytes。Receiver 默认只监听 `127.0.0.1:8787`；私网联调必须显式绑定接收端具体 Tailscale IP，并配置唯一允许的 `source_id`。

### 快照结构

正常聚合快照：

```json
{
  "protocol_version": 1,
  "source_id": "home-server",
  "instance_id": "4c391ca8-82fd-4a51-9728-d74a4e94b2f1",
  "sequence": 42,
  "sent_at": "2026-09-11T06:30:00.000Z",
  "state": "working",
  "cause": "aggregate",
  "counts": {
    "blocked": 0,
    "working": 2,
    "unknown": 1,
    "done": 0,
    "idle": 1
  }
}
```

采集失败快照：

```json
{
  "protocol_version": 1,
  "source_id": "home-server",
  "instance_id": "4c391ca8-82fd-4a51-9728-d74a4e94b2f1",
  "sequence": 43,
  "sent_at": "2026-09-11T06:30:02.000Z",
  "state": "unknown",
  "cause": "collector_unavailable"
}
```

字段约束：

| 字段 | 约束 |
| --- | --- |
| `protocol_version` | 必填整数，第一版必须为 `1` |
| `source_id` | 必填；稳定配置值，1～64 个 ASCII 小写字母、数字、点、下划线或连字符，首字符必须是字母或数字 |
| `instance_id` | 必填；发送进程每次启动生成的新 UUID；进程生命周期内不变 |
| `sequence` | 必填安全整数，范围 `1..9007199254740991`；同一 instance 严格递增 |
| `sent_at` | 必填 RFC 3339 UTC 时间；仅用于日志诊断，不参与顺序或超时判断 |
| `state` | 必填；五态之一 |
| `cause` | 必填；`aggregate`、`initializing`、`collector_unavailable` 或 `protocol_incompatible` |
| `counts` | `cause=aggregate` 时必填；五个键都必须存在且为非负安全整数；其他 cause 时禁止发送 |

一致性约束：

- `cause=aggregate` 时，Receiver 用本文聚合规则复算 `counts`，结果必须与 `state` 相同。
- `counts` 全零只能得到 `idle`。
- `cause` 不是 `aggregate` 时，`state` 必须为 `unknown`。
- 未知顶层字段允许忽略，以支持向后兼容；未知状态、cause、缺失字段或错误类型必须拒绝。

### 接收顺序

Receiver 为配置的 `source_id` 保存当前 `instance_id`、最高 `sequence`、已退休 instance 集合和最近一次接受时间：

- 第一个有效 instance：接受。
- 当前 instance 且 sequence 更大：接受。
- 当前 instance 且 sequence 相同、协议字段内容相同：记为 `duplicate`，不重新应用灯效，也不刷新存活时间。比较解析并校验后的已知协议字段，不比较原始 JSON 字节或对象键顺序。
- 当前 instance 且 sequence 相同、内容不同：`409 sequence_conflict`。
- 当前 instance 且 sequence 更小：记为 `stale`，不应用、不刷新存活时间。
- 新 instance：接受并退休旧 instance；新 instance 的 sequence 可从 1 开始。
- 已退休 instance 的迟到包：记为 `retired_instance`，不应用、不刷新存活时间。第一版在 Receiver 进程生命周期内保留全部已见 instance ID，不能因定长淘汰让旧 instance 重新成为“新”实例。
- Receiver 重启后内存顺序状态清空；第一条有效包成为新基线。发送请求必须有界超时，避免跨越很长时间的旧请求残留。

已接受的新 sequence 即使状态没变化，也刷新存活时间，但不重复调用 WLED preset。`sent_at` 不可信，超时全部使用 Receiver 本地单调时钟计算。

### 响应

有效请求统一返回 HTTP 200，并说明处置：

```json
{
  "protocol_version": 1,
  "disposition": "applied",
  "source_id": "home-server",
  "instance_id": "4c391ca8-82fd-4a51-9728-d74a4e94b2f1",
  "sequence": 42
}
```

`disposition` 取值：

- `applied`：接受且总体状态改变，已请求应用新 preset。
- `refreshed`：接受且状态不变，只刷新存活时间。
- `duplicate`：同一 sequence 的相同包，不刷新存活时间。
- `stale`：旧 sequence，不刷新存活时间。
- `retired_instance`：已退休进程的迟到包，不刷新存活时间。

错误响应使用 JSON `{ "error": { "code": "...", "message": "..." } }`：

| HTTP | 场景 |
| --- | --- |
| 400 | JSON 无法解析或请求结构错误 |
| 403 | `source_id` 不在配置允许范围 |
| 409 | 同一 instance/sequence 的内容冲突 |
| 413 | 请求体超过 4096 bytes |
| 415 | Content-Type 不是 JSON |
| 422 | 协议版本、枚举、字段约束或 state/counts 一致性错误 |
| 500/503 | Receiver 在接受快照前发生内部错误或暂时不可用；已接受快照后的 WLED 失败由 Receiver 自行重试，不把已接受请求改报失败 |

## 心跳、超时与发送队列

工程初值：

| 参数 | 默认值 | 要求 |
| --- | --- | --- |
| `heartbeat_interval_ms` | 5000 | 可配置；状态不变也发送新 sequence |
| `receiver_timeout_ms` | 15000 | 可配置；必须至少为心跳间隔的 3 倍 |
| `request_timeout_ms` | 2000 | 可配置；必须小于心跳间隔 |

发送规则：

- 状态变化立即排队发送；稳定状态每个心跳周期发送一次新快照。
- 同一发送进程的 sequence 在快照创建时分配。请求失败且没有新状态时，可用同一 sequence 重试；若有更新快照，丢弃旧重试并发送最新 sequence。
- 最多一个逻辑发送槽；新快照合并替换尚未开始的旧快照。Receiver 的 sequence 检查是防止旧请求覆盖新状态的最终保护。
- 网络错误和 5xx 使用有界指数退避；确定性的 4xx 不热循环重试，应记录错误并等待配置修复或下一次心跳诊断。
- Receiver 超过 `receiver_timeout_ms` 没有接受新 sequence 时，本地切换为 `unknown` 并应用黄色 preset。后续有效快照立即恢复。
- Receiver 到 WLED 失败不改变最近收到的服务器状态，但 Receiver 保持期望 preset，按 T-006 的有界重试规则补发；不得让旧 preset 覆盖新状态。

## Demo 隔离

注意：按键 TUI（`npm run demo`）走正式 `/v1/state`，不属于下面的隔离机制。它与真实 Sender 共用 source_id，新 instance 首包会退休旧 instance，没有固定 Demo/真实优先级；应退出当前发送器再启动另一个，恢复被退休的发送器须重启。

正式同步只使用 `/v1/state`。简化的 `POST /state`、`{"state":"blocked"}` 仅属于显式 Demo 模式：

- Demo 未启用时拒绝该接口。
- Demo 启用时，正式快照仍可校验、排序、刷新存活并缓存，但不得覆盖当前 Demo 灯效。
- 退出 Demo 时恢复最新且未超时的正式快照；没有有效快照则显示 `unknown`。

Receiver 配置 `demoEnabled: false` 时，`/state` 返回 404。显式启用后：

- `POST /state` + `{"state":"blocked"}`：进入 Demo 并切换到指定五态之一。
- `DELETE /state`：退出 Demo，返回并恢复当前未超时的正式状态；没有有效状态时恢复 `unknown`。
- `GET /health` 的 `demo_active` 表示 Demo 是否生效。

Demo 接口沿用 Receiver 的监听地址边界；演示结束后应退出 Demo 或停止 Receiver。

## 安全与兼容

- v1 不在 JSON 中传认证密钥。访问控制依靠回环默认监听、显式 Tailscale 地址、允许的 `source_id` 和 T-010 实测的私网访问策略。
- 日志不得记录请求中的未知扩展字段原值；只记录协议版本、source/instance、sequence、state、处置和错误码。
- Receiver 只接受 `protocol_version: 1`。未来不兼容升级使用新版本号和新文档，不静默改变 v1 语义。
- 发送端必须先验证 Herdr protocol 20；遇到其他版本进入 `protocol_incompatible`，不得猜测字段兼容性。

## T-006 / T-007 必测清单

- 五态、零会话、部分 unknown 和全局采集失败聚合。
- done 会话 release/exit/close 后清除；无其他会话时 idle。
- Herdr 历史事件重放、启动竞态、pane_not_found、socket 断开与 reconciliation。
- 同 instance 的递增、重复、冲突、乱序；新 instance 与 retired instance 迟到包。
- 心跳只刷新存活而不重启灯效；15 秒超时进入 unknown；恢复后补发期望 preset。
- Content-Type、4096-byte 上限、字段类型、枚举、counts 一致性、未知字段和错误响应。
- 新状态替换旧重试，旧请求不能覆盖新状态。
