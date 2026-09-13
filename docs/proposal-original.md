> 历史构想存档，不代表当前交付范围。当前架构见 [设计说明](proposal.md)，使用入口见 [README](../README.md)。

可以，完整方案现在已经比较稳定了。整体思路就是：**尽量复用成熟开源组件，把主要工作放在“业务映射、远程状态传输、物理反馈”上，而不是自己造底层轮子。**

# 项目名称

**AgentBeacon：基于 Linux 与 IoT 的 AI Coding Agent 物理状态指示系统**

一句话描述：

> 运行在家用 Linux 服务器上的 AI Coding Agent，其状态经 Herdr 获取并通过 Tailscale 私有网络发送到本地电脑，再由本地电脑控制 ESP32 + WLED RGB 灯环，实现桌面环境光状态反馈。

---

# 一、最终整体架构

```text
                     家用服务器
              ┌────────────────────┐
              │   Ubuntu Server    │
              │                    │
              │ Claude / Codex ... │
              │        ↓           │
              │      Herdr         │
              │        ↓           │
              │ AgentBeacon Plugin │
              └─────────┬──────────┘
                        │
                        │ HTTP / JSON
                        │
                  Tailscale 私有网络
                        │
                        ▼
                   你的笔记本
              ┌────────────────────┐
              │ Ubuntu / Linux     │
              │                    │
              │ AgentBeacon        │
              │ Receiver           │
              └─────────┬──────────┘
                        │
                  本地 Wi-Fi / HTTP
                        │
                        ▼
              ┌────────────────────┐
              │ ESP32 + WLED       │
              │        ↓           │
              │ WS2812B RGB Ring   │
              └────────────────────┘
```

核心思想是：

```text
Herdr 负责识别 Agent 状态
          ↓
你负责状态聚合和业务规则
          ↓
Tailscale 负责远程传输
          ↓
WLED 负责灯效
```

每一层都有明确职责。

---

# 二、软件部分

## 服务器端

服务器上已经运行：

```text
Herdr
Claude / Codex / 其他 Coding Agent
Tailscale
```

新增一个很薄的：

```text
AgentBeacon Herdr Plugin
```

不重新实现 Herdr 客户端。

直接参考 Herdr 官方插件示例，例如 Telegram Notify，把原来的：

```text
Agent 状态改变
      ↓
发送 Telegram
```

改成：

```text
Agent 状态改变
      ↓
计算总体状态
      ↓
HTTP POST 到你的电脑
```

例如：

```json
{
  "state": "blocked"
}
```

---

# 三、多 Agent 状态聚合

这是项目真正属于你的业务逻辑。

例如服务器上同时有：

```text
Codex      working
Claude     blocked
OpenCode   done
```

不能简单显示最后一个 Agent 的状态。

定义总体优先级：

```text
blocked > working > done > idle
```

因此：

```text
只要任意 Agent blocked
→ 整体 blocked

没有 blocked，但有 working
→ 整体 working

没有 blocked / working，但有 done
→ 整体 done

否则
→ idle
```

可以把这一部分在报告中称为：

> **多智能体注意力状态聚合策略**

它解决的是：

> 用户真正关心的不是每个 Agent 在干什么，而是“现在有没有 Agent 需要我处理”。

---

# 四、Tailscale

Tailscale 是远程服务器和笔记本之间的通信层。

不让 ESP32 接 Tailscale。

结构是：

```text
服务器
  │
Tailscale
  │
笔记本
  │
本地 Wi-Fi
  │
ESP32
```

这样做最大的优点是：

**ESP32 完全不暴露公网。**

服务器也完全不需要知道 ESP32 的：

```text
192.168.x.x
```

它只知道你的笔记本：

```text
笔记本的 Tailscale IP
```

或者 MagicDNS 名称。

---

# 五、本地 Receiver

你的笔记本运行一个非常简单的小服务：

```text
agentbeacon-receiver
```

Node.js 就够。

例如：

```text
监听：

0.0.0.0:8787
```

收到：

```json
{"state":"working"}
```

之后转换：

```text
working
 ↓
WLED preset 2
```

然后向：

```text
http://ESP32-IP/json/state
```

发送请求。

因此 Receiver 实际上只有两个职责：

```text
接收服务器状态
       ↓
转换成 WLED Preset
```

不需要数据库。

不需要前端。

不需要复杂框架。

---

# 六、ESP32 不写代码

这里是整个方案省事的关键。

ESP32 直接刷：

**WLED**

因此你不需要：

```text
Arduino IDE
ESP32 C++
RGB 驱动
PWM
Wi-Fi 程序
HTTP Server
灯效代码
```

全部由 WLED 提供。

ESP32 只负责：

```text
收到 HTTP API
      ↓
控制 WS2812B
```

---

# 七、灯效设计

在 WLED 中提前保存几个 Preset：

| Agent 状态       | 灯效      | WLED Preset |
| -------------- | ------- | ----------: |
| idle           | 微弱白光或熄灭 |           1 |
| working        | 蓝色呼吸    |           2 |
| blocked        | 红色快速闪烁  |           3 |
| done           | 绿色提示效果  |           4 |
| unknown / 网络异常 | 黄色慢闪    |           5 |

业务含义非常直观。

### 蓝色

```text
AI 正在工作
不用管
```

### 红色

```text
AI 等待人工输入
需要处理
```

### 绿色

```text
任务完成
```

### 白色 / 熄灭

```text
当前空闲
```

### 黄色

```text
状态获取异常 / 服务器离线
```

---

# 八、硬件最终方案

第一版硬件控制在非常简单的范围。

| 硬件  | 推荐                       |
| --- | ------------------------ |
| 主控  | ESP32-WROOM-32 DevKit    |
| RGB | WS2812B 16灯 RGB Ring     |
| 供电  | ESP32 USB 5V             |
| 数据  | ESP32 GPIO → WS2812B DIN |
| 网络  | Wi-Fi                    |
| 固件  | WLED                     |
| 调试  | USB-C 数据线                |
| 连接  | 杜邦线 + 小面包板               |
| 备用  | SN74AHCT125 电平转换器        |
| 外观  | 后期增加半透明灯罩                |

接线第一版甚至只有：

```text
ESP32              WS2812B

5V   ─────────────→ 5V

GND  ─────────────→ GND

GPIO16 ───────────→ DIN
```

先这样测试。

如果出现：

```text
随机闪烁
颜色错乱
数据不稳定
```

再加入：

```text
SN74AHCT125
```

做 3.3V → 5V 数据电平转换。

---

# 九、实际使用场景

比如你人在学校。

桌面放：

```text
笔记本
+
AgentBeacon 灯
```

而 Agent 实际跑在：

```text
家里 Ubuntu Server
```

此时：

```text
家里服务器
Codex 正在工作
        ↓
Herdr → working
        ↓
Tailscale
        ↓
笔记本 Receiver
        ↓
WLED
        ↓
桌面蓝色呼吸
```

然后 Codex 执行到：

```text
需要用户确认
```

Herdr：

```text
blocked
```

桌面灯立即：

```text
蓝色呼吸
   ↓
红色闪烁
```

这就是整个项目最核心的用户体验。

---

# 十、答辩 Demo

最终答辩不用演示太多东西。

最值得演示的是四种情况：

| 操作         | 灯    |
| ---------- | ---- |
| Agent 开始工作 | 蓝色呼吸 |
| Agent 等待输入 | 红色闪烁 |
| Agent 完成任务 | 绿色提示 |
| 服务器 / 网络异常 | 黄色慢闪 |

其中最关键的一幕就是：

```text
Agent working
     ↓
blocked
     ↓
桌面灯立刻由蓝色变红色
```

老师很容易一下理解项目价值。

---

# 十一、开发阶段

按下面顺序做最稳：

1. **先刷 ESP32 WLED**，确保网页能控制灯环。
2. Linux 上直接 `curl` WLED API，让灯能切换 preset。
3. 写本地 Receiver，手动向 Receiver POST `working / blocked`，验证能控制灯。
4. 在家用服务器上写 Herdr Plugin，把 Agent 状态 POST 到 Receiver。
5. 加入多 Agent 状态聚合。
6. 最后再做 systemd、自启动、异常状态和外壳。

这里有一个原则：

> **先从灯往 Herdr 反向打通。**

不要一开始就同时调 Herdr、Tailscale、Node、ESP32、WLED 五层。

---

# 十二、建议保留一个 Demo / 测试接口

Receiver 最好支持：

```bash
curl -X POST \
  http://localhost:8787/state \
  -H "Content-Type: application/json" \
  -d '{"state":"blocked"}'
```

这样即使答辩现场：

```text
家里服务器掉线
Tailscale 出问题
Herdr 出问题
```

你仍然能完整展示：

```text
idle
working
blocked
done
```

绝对不要让最终演示完全依赖远程服务器。

---

# 十三、最终代码量其实不会很大

仓库甚至可以只有：

```text
agentbeacon/
│
├── server/
│   ├── herdr-plugin.toml
│   └── beacon.mjs
│
├── receiver/
│   ├── receiver.mjs
│   └── config.json
│
├── systemd/
│   └── agentbeacon.service
│
├── docs/
│   ├── architecture.png
│   └── wiring.png
│
└── README.md
```

你真正原创的代码可能就：

```text
服务器插件       100～200 行
Receiver        100～200 行
状态聚合          几十行
```

这完全没有问题。

因为作品的价值是：

> **把 Linux、AI Agent、Tailscale、IoT 和实体交互组合成一个真正能工作的系统。**

不是比谁代码行数多。

---

# 十四、课设里怎么突出“Linux应用开发”

报告和答辩不要一直讲 ESP32。

重点应该放在：

```text
Linux Server
Herdr
Linux 应用进程
JSON
HTTP
Tailscale 网络
systemd
日志
配置文件
远程状态同步
服务异常恢复
开源软件集成
```

ESP32 只是：

> **Linux 应用最终控制的物理执行终端。**

这样课程主题仍然完全合理。

---

# 最终版本一句话定稿

你的课设最终就是：

> **在家用 Linux 服务器中利用 Herdr 获取多个 AI Coding Agent 的运行状态，通过自定义状态聚合策略判断当前是否需要用户注意，并经 Tailscale 私有网络实时同步至用户笔记本，由本地 Linux Receiver 调用 WLED API 控制 ESP32 + WS2812B RGB 灯环，实现远程 AI Agent 状态的物理环境光反馈。**

项目结构可以浓缩成：

```text
Herdr
  ↓
AgentBeacon Plugin
  ↓
Tailscale
  ↓
Linux Receiver
  ↓
WLED
  ↓
ESP32
  ↓
WS2812B
```

这个版本已经足够作为你的**最终执行方案**了。下一步实际应该做的不是继续设计，而是先把 **ESP32 + WS2812B + WLED** 这一段买齐并跑通。
