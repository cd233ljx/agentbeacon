# AgentBeacon 当前执行方案

更新：2026-09-12。本文是当前方案的唯一依据；原始讨论保留在 proposal-original.md。
状态：单颗 RGB 自研固件已刷入实物，Demo、真实 Herdr 联调及最终接线已获用户整体验收；证据与未测边界见 evidence/T-010.md。未决事项见 decisions.md。

## 目标与范围

在 Linux 家用服务器上获取 Herdr 内启动的终端 Coding Agent 状态，聚合后经 Tailscale 发送至 Android 手机。手机在 Termux 中运行 Node.js Receiver，通过手机热点内 HTTP 调用 ESP32-WROOM-32D 自研固件，驱动一颗四脚 RGB 灯。设备兼容现有 /json/state preset 请求；WS2812B 灯环/WLED 作为可选路径。

Windows 笔记本作为备用 Receiver。软件由 Agent 开发；用户负责确认产品规则、手机配置、硬件采购接线及最终实物验收。

第一版不包含 Herdr 外部任务、数据库、前端、蓝牙通信、多服务器汇总或公网服务。按 D-010 提前开发 ESP32-WROOM-32D + 单颗普通 RGB 灯固件，供人工 review；原 WLED/灯环路径保留为可选方案。

## 架构与职责

```text
Linux 家用服务器
  Herdr 内终端 Agent
    → Herdr Unix socket 状态接口
    → AgentBeacon 适配、聚合、同步
            ↓ HTTP/JSON，经 Tailscale
Android 手机
  Termux / Node.js Receiver
    → 手机热点内 HTTP
    → ESP32 / 自研固件 → 单颗四脚 RGB 灯

备用：Windows / Node.js Receiver（需单独验证其到 WLED 的局域网路径）
```

Herdr 负责原始状态识别，server 通过 Herdr Unix socket 采集状态，shared 负责聚合规则，server 负责远程同步，receiver 负责状态接收与 preset 映射，设备固件负责灯效；现有 Receiver 输出模块仍沿用 WLED 命名以保持兼容。Unix socket 是唯一预期状态来源；CLI 仅用于只读核实版本、帮助和 socket 配置，不以 CLI 输出或终端正文代替状态接口。

Herdr 插件接口和真实状态映射必须按安装版本验证。官方文档引用的 Telegram Notify 是参考示例，非官方维护插件。startup hook 不等同于受监督的常驻服务；采集发送端已实现为独立长驻进程，正式监督方式留给 T-012。

## 状态与显示

| 状态 | 含义 | 灯效 | Preset |
| --- | --- | --- | --- |
| blocked | 等待必要输入或授权 | 红色提示，具体闪烁节奏联调调整 | 3 |
| working | 正在工作 | 蓝色呼吸 | 2 |
| done | 已完成且暂无更高优先级状态 | 绿色常亮，不自动超时熄灭 | 4 |
| idle | 初始无任务或有效空闲 | 熄灭 | 1 |
| unknown | 无有效初始状态、采集失败或心跳超时 | 黄色慢闪 | 5 |

正常状态聚合：blocked > working > unknown > done > idle。多个 Agent 中仍有工作者时保持蓝色；有阻塞者时红色；没有更高优先级活动而部分会话无法分类时显示黄色。正常等待下一条新任务不能直接认定为 blocked。

绿灯不设 10 秒之类的完成计时器；新工作、阻塞或通信故障可以改变显示。已完成会话关闭后清除该会话的完成状态，按剩余有效会话重新聚合；若无其他有效任务则 idle 熄灯（D-004）。采集失败或心跳超时仍显示 unknown，不因缓存为空误判空闲。部分会话 unknown 的优先级按 D-007 执行。完整包结构、顺序与恢复规则见 [protocol.md](protocol.md)。

## 同步与恢复

- 状态变化立即发送，另外周期性发送当前快照，供 Receiver 判断存活。
- 建议初始心跳 5 秒，接收超时 15 秒，均可配置；属于工程初值，非已实测指标。
- Receiver 启动为 unknown；有效新快照恢复正常显示。
- 心跳刷新存活时间，状态未变不重复应用 preset，避免重启灯效。
- 断线重连发送最新快照，不重放积压灯效；WLED 重连后应补发当前期望 preset。
- 请求设超时和有界重试；新状态应能取代旧状态，不能让旧请求覆盖新状态。
- 正式协议使用版本、来源、发送进程实例标识和序列号处理重启、重复与乱序；接收端以本地经过时间检测超时，不依赖两端时钟严格同步。具体规则见 [protocol.md](protocol.md)。
- 最小手动 Demo 包为 POST /state，JSON 如 {"state":"blocked"}；它与正式的 `POST /v1/state` 隔离，规则见 [protocol.md](protocol.md)。

开发仅监听 127.0.0.1:8787；远程联调显式绑定接收端具体 Tailscale IP。访问限制依靠私网范围和实际访问策略验证，不把“安装了 Tailscale”当作访问控制已经完成。

## 演示与故障边界

提供显式 Demo 模式，可手动切换所有 preset；HTTP Demo 期间真实心跳不覆盖演示状态，退出后恢复最新有效状态，过期则 unknown。另提供不读取 Herdr 状态的极简按键 TUI，由服务器把人工选择的五态发送给手机 Receiver。

服务器到手机失联且手机到 WLED 正常时，可显示黄色。Receiver 崩溃、手机休眠暂停进程、WLED 断网或掉电时，无法承诺黄色，可能保留旧灯效或熄灭。自研版可在自身 Wi-Fi 断开时显示 unknown，但没有设备心跳看门狗；手机进程停止且热点仍在时可能保留旧色。设备重启后需手机重新发状态；当前不保证自动同步。

## 手机与硬件验证

Android 手机为主接收端，需同时运行 Termux、Tailscale 和热点。先实测服务器可访问 Receiver；购买硬件后实测手机可访问热点客户端 ESP32。验证锁屏、后台限制和网络恢复。演示可保持亮屏；无法稳定后台运行时记录操作限制。

用户提供套件开发板模块型号 ESP32-WROOM-32D，拟使用套件四脚 RGB 灯。已确认共阴，按 D-011 使用 IO25/26/27 分别控制红绿蓝，每路 220Ω，阴极接 GND、USB 供电；固件默认禁用输出，断电接线核对后由本地配置启用。具体说明见 [固件 review 指南](../firmware/README.md)。

原灯环路径候选（当前无需额外采购）：ESP32-WROOM-32 DevKit、WS2812B 16 灯环、合适的 5V 电源与数据线、接线材料、SN74AHCT125 电平转换器。

具体板型、GPIO、灯环电流和供电路径在采购前核对。先低亮度测试并共地；不默认任意开发板的 USB→5V 引脚都能可靠承载灯环。手机通信与灯环供电分开考虑。

## 执行顺序与验收

1. 采样 Herdr Unix socket 的真实状态并核实路径、权限、协议及插件生命周期。
2. 无硬件验证服务器 → 手机 Receiver 打印模拟状态。
3. 编写聚合、接收、模拟 WLED 和故障测试。
4. 单颗 RGB 固件先完成 review；硬件到货后确认灯脚、GPIO 和电阻，刷机并接通手机 → 灯。可选 WLED 路径另行配置。
5. 完成真实多 Agent 全链路、断线恢复和独立 Demo。
6. 完成 Linux 进程管理、Termux/Windows 使用说明及答辩材料。Termux 运行包和说明（T-012A）可先于硬件到货完成，设备验收仍依赖 T-010。

按 2026-09-12 最新 D-010，立即开发单颗 RGB 自研固件，不等待 WLED 或硬件到货。设备输出接收现有 preset 1～5 请求；接线与刷机需硬件信息确认后验收。

具体验收、依赖和证据见 tasks.md。没有真机证据不算完成全链路。

## 参考资料

- [Herdr 插件文档](https://github.com/herdrdev/herdr/blob/master/docs/next/website/src/content/docs/plugins.mdx)：开发时还需核实安装版本。
- [WLED JSON API](https://kno.wled.ge/interfaces/json-api/)
- [WLED 快速入门](https://kno.wled.ge/basics/getting-started/)
- [WLED 电平转换器](https://kno.wled.ge/basics/compatible-hardware/#levelshifters)
