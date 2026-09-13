# 设计说明

首版开发与用户整体验收已完成。历史构想见 [原始方案](proposal-original.md)，当前行为以本文及 [协议](protocol.md)为准。

## 目标与结构

把 Linux Herdr 内的终端 Agent 状态变成桌面上的物理灯光：

```text
Herdr Unix socket → Linux Sender → Tailscale → Android Receiver
                                              ↓ 手机热点 HTTP
                                         ESP32 → 单颗 RGB 灯
```

Sender 校验 Herdr protocol 20，建立生命周期与状态订阅，通过两次快照 reconciliation 处理启动竞态和历史事件重放。Receiver 校验来源、实例和序号，维持期望状态及通信超时，输出 preset。固件负责 RGB PWM 灯效。

## 状态与恢复

blocked > working > unknown > done > idle。idle 熄灯；working 蓝色呼吸；blocked 红色闪烁；done 绿色常亮；unknown 黄色慢闪。done 没有自动熄灭计时器，但上游状态或通信超时仍可替换它。Herdr 的后台完成未查看与前台 idle 语义详见协议。

状态变化发送最新快照，默认心跳 5 秒、接收超时 15 秒。状态未变不重复下发 preset。网络失败有界重试，新快照替换旧积压；设备侧断电和手机暂停的边界见 [限制](limitations.md)。

按键 Demo 使用正式协议、无持续心跳，与真实 Sender 交替运行。显式 HTTP Demo 可缓存真实状态并暂时覆盖显示，退出后恢复有效快照。两者不是同一种机制。

## 硬件与范围

实物为 classic ESP32 32E、共阴四脚 RGB、IO25/26/27 每路 220Ω，USB 供电。固件兼容 POST /json/state 的 preset 1～5，不是完整 WLED。示例输出默认禁用，真实配置本地填写。电气与面包板示例见 [接线](../firmware/WIRING.md)。

不包含 Herdr 外部 Agent、数据库、网页管理端、蓝牙、多服务器合并或公网服务。WLED 灯环和 Windows Receiver 保留兼容路径，未作为此次实物交付的验证承诺；正式进程守护也不属于首版范围。

## 验证

协议、聚合、异常和模拟集成由自动测试覆盖；Android→ESP32 真灯、Demo 与真实 Herdr 链路由实际操作验收。证据见 [T-010](evidence/T-010.md)，平台边界见 [limitations](limitations.md)。
