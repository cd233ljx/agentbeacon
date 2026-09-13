# AgentBeacon 单颗 RGB 固件：第一版 review 稿

目标：ESP32-WROOM-32D 开发板 + 一颗四脚 RGB 灯。让你在硬件到货前阅读、理解并 review 源码。固件不读取 Agent 数据，只接收手机转发的灯效编号。无需先完成 WLED 版。

**当前不能照默认配置直接接灯：输出默认关闭，GPIO 已定为 R=25/G=26/B=27，Wi-Fi 配置为空。** 编译成功只证明代码能构建成 ESP32 程序，接线、Wi-Fi、PWM 真实波形及颜色需要设备验收。

具体操作从 [接线、刷机与演示指南](WIRING.md) 开始；下面解释固件原理。

## 先理解三个部分

```text
手机完整版 Receiver
    POST /json/state {"ps":2}
            ↓
main.cpp：收 HTTP 请求、检查长度、交给解析器
            ↓
beacon.h：2 对应 working，计算当前时刻蓝光亮度
            ↓
main.cpp：把亮度交给 ESP32 的三路 PWM
            ↓
三个限流电阻 → 一颗 RGB 灯
```

这里的 preset 是状态编号，已经与现有手机 Receiver 一致。固件内固定映射，不需要在设备上保存 WLED preset：1 idle 熄灯，2 working 蓝色呼吸，3 blocked 红色闪烁，4 done 绿色常亮，5 unknown 黄色慢闪。它只是兼容这一条请求，不是完整 WLED，也不支持 WLED 网页、OTA 或 LED strip API。

## 推荐阅读顺序

1. [config.example.h](include/config.example.h)：先看用户需要填写什么。空 Wi-Fi 密码表示开放热点，并非自动配置；SSID 为空时不连接。不要把真实热点密码发给我或提交 Git。
2. [beacon.h](include/beacon.h) 的 State/name：理解 1～5 到状态名的映射。
3. 同文件的 color：理解“状态 + 已经过的时间 → RGB 亮度”。它不需要 ESP32，可以在电脑上直接测试。
4. 同文件的 parsePreset：只接受约定的短请求；非法输入不改变状态。
5. [main.cpp](src/main.cpp) 的 setup/loop：理解开机初始化和持续运行，再阅读 HTTP handler。
6. [core.cpp](test/core.cpp)：用边界和失败例子检查上述理解。

## 灯效怎么实现

RGB 灯有三个发光通道，共用另一根脚。PWM 可以理解为让一个颜色快速开关，通过开通时间的比例改变平均亮度；不是输出任意电压。

我们设定 5 kHz、8 位 PWM。8 位表示逻辑亮度范围 0～255，默认把上限限制为 32，供初期低亮度测试。**降低 PWM 亮度不能替代限流电阻**，每个颜色仍要串自己的电阻。

- working：2 秒完成一次线性渐亮、渐暗。不是靠 delay 等两秒，而是每次按当前时间算蓝色亮度。
- blocked：红色亮 500 ms、灭 500 ms。
- done：绿色持续保持上限，不设置自动灭灯计时器。
- unknown：红绿同时亮 1000 ms、灭 1000 ms；实际黄色情况取决于灯珠和电阻，待真机调整。
- 重复收到同一个状态，不重置动画起点。状态切换才重新计时。

以上节奏和亮度是供 review 的工程初值，不是用户已验收的效果。`millis()` 的无符号减法能处理一次计数回绕，不会因大约 49.7 天的计数溢出永久停灯。

共阴灯的公共脚接地，控制值增大通常越亮；共阳灯的逻辑相反，pwm() 把控制值反转。这里仅说明原理，**不是这套未知灯珠的具体接线图**。还需核实公共脚位置、允许电流、压降及开发板引脚。尤其不能未经核实就把公共脚接 5V、同时让 ESP32 GPIO 直接连接灯脚。

## 手机到设备的协议

| 请求 | 处理 |
| --- | --- |
| POST /json/state，Content-Type: application/json，正文 `{"ps":1}`～`{"ps":5}` | 保存最新期望状态，返回 200 `{"success":true}` |
| GET /health | 返回 device、desired_state、led_enabled；不返回 Wi-Fi 密码 |
| 空正文或声明长度超过 64 bytes | 413，关闭连接，不更新状态 |
| 不支持的 Content-Type | 415，关闭连接 |
| 无效编号、重复字段、额外字段、截断 JSON、尾随数据 | 422，不更新状态 |
| 接收中断或 socket 读取超时 | 关闭连接，不更新状态 |

这是刻意收窄的 JSON 子集：允许 JSON 空白，编号只能是一位 1～5，不接受 1.0、1e0 或字符串；字段名必须直接写成 "ps"。Content-Type 接受 `application/json` 或 `application/json; charset=utf-8`，没有实现所有等价大小写/参数排列。当前 Receiver 发出的格式完全符合。请求必须有 Content-Length，不支持 chunked 上传。

HTTP 服务使用 ESP-IDF 自带 esp_http_server，无第三方 JSON 库。最大两个连接，单次 socket 收发等待 1 秒；这是每次 I/O 的超时，不承诺整个请求总时长只有 1 秒。HTTP 任务独立于灯光 loop，使用原子变量传递最新状态，避免两个任务同时修改 PWM。响应表示请求已接受，不保证响应前肉眼已看到灯变色；多次快速请求可以合并到最新状态。

仅启用 Wi-Fi STA，连接用户配置的手机热点，不创建开放 AP，不在开发机开放服务。设备 HTTP 服务没有应用层认证，同热点的可达客户端也能控制灯，不应做公网端口转发。

## 当前故障边界：review 时重点看

1. 开机默认 unknown。没配置 Wi-Fi 时也保持 unknown，输出禁用则仅日志说明。
2. Wi-Fi 断开时，显示 unknown；每 10 秒发起一次重连尝试，底层同时允许自动重连。重新连上后恢复内存里最后期望状态。断线期间新状态可能尚未收到，因此恢复并不表示数据一定新鲜。
3. **没有设备端“15 秒未收到 HTTP 就黄灯”的看门狗。** 手机目前会对相同状态去重，正常绿色常亮时也可能很久不发设备请求；不能把这种正常行为判成失联。服务器到手机的 15 秒超时仍由手机负责并发送 preset 5。
4. 手机进程停止但 ESP32 仍连着热点时，可能保持旧颜色。设备重启后默认 unknown，手机若缓存了已成功状态，也不保证立即重发。现阶段可重启 Receiver 或切换状态强制同步；后续若要求自动恢复，需一起设计设备心跳/重启检测和 Receiver 改动，不能只在固件偷偷加入超时。
5. 没有保存状态到 flash，避免重启后错误展示旧绿灯；但 Wi-Fi 凭据会编进固件镜像，包含本地凭据的构建产物不能公开分享。

## 本机编译与测试

使用项目内工具环境，未全局安装：PlatformIO Core 6.1.18、platform-espressif32 6.10.0、Arduino-ESP32 2.0.17（包 3.20017.241212）。选择固定版本是为了 API 可复核，不声称它们是最新版本。Arduino 3.x 改了 LEDC API，不能直接按最新示例混用。

在项目根目录运行已有工具：

```bash
npm run test:firmware
PLATFORMIO_CORE_DIR="$PWD/.local/platformio" .local/firmware-tools/bin/pio run -d firmware
npm test
npm run check
```

`test:firmware` 需要本机 g++ 和 AddressSanitizer/UBSan（可用 CXX 指定兼容编译器）。这是桌面 C++ 逻辑测试，不是 ESP32 模拟器。首次新机器需先建 Python venv，并在其中安装 `platformio==6.1.18`；工具和缓存留在 .local 下。

编译输出在 `.pio/build/esp32dev/`，Git 忽略；配置示例可以直接编译，但灯脚不会输出。`esp32dev` 是 classic ESP32 4MB 的通用构建目标，不代表红色开发板的物理排针布局已经确认。flash 容量到货核对；完整刷机步骤和端口识别见 [接线与首次演示指南](WIRING.md)。

## 硬件到货后启用

复制 include/config.example.h 为 include/config.local.h，填写热点 SSID/密码。已按 KE3069 官方板图选定 IO25/26/27、共阴和每路 220Ω。按接线指南断电接好并核对实物后，将 BEACON_LED_ENABLED 改为 true 并重新编译。GPIO 有保守白名单和互异检查，但编译通过仍不能替代板上布线核对。

刷机之后，从 115200 波特率串口查看设备取得的 IP。手机停止现有 Receiver，备份 receiver/config.json，将 wledBaseUrl 改为该 IP 的 HTTP 地址，dryRun 改为 false，再前台启动。字段名仍叫 wledBaseUrl，只是复用接口，不代表设备跑了 WLED。

按 Demo 的 1～5 观察实际灯效，再检查热点断开和重连；最后检查真实 Agent 链路。手机 TUI 本身不持续发心跳，停留 15 秒后会由手机超时转 unknown。无需修改已经运行的手机软件来 review 本固件，本轮不操作手机服务。

## 官方接口依据

- [PlatformIO 固定平台版本](https://github.com/platformio/platform-espressif32/blob/v6.10.0/platform.json)
- [Arduino 2.0.17 LEDC 声明](https://github.com/espressif/arduino-esp32/blob/2.0.17/cores/esp32/esp32-hal-ledc.h)
- [ESP-IDF 4.4 HTTP Server](https://docs.espressif.com/projects/esp-idf/en/v4.4.7/esp32/api-reference/protocols/esp_http_server.html)
- [ESP32-WROOM-32D 数据手册](https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32d_esp32-wroom-32u_datasheet_en.pdf)

## KE3069 官方教程核对（2026-09-12）

用户提供 [Keyes 项目06 RGB LED 教程](https://www.keyesrobot.cn/projects/KE3069/zh-cn/latest/docs/5.Arduino%20C%20%E6%95%99%E7%A8%8B%20Windows%20%E7%B3%BB%E7%BB%9F.html#rgb-led)。教程明确标注四脚共阴，元件清单为三根 220Ω 电阻；按该套件参考电路，红、绿、蓝每路各串一个 220Ω。用户反馈电阻数量为 12 根，具体各阻值数量未另核对。

官方灯珠示意图从图示方向左到右为 R、公共阴极（最长脚）、G、B。灯珠转向后左右会变化，实物需对照图的方向，不能把“左边第一脚”脱离朝向使用。公共阴极接 GND，固件 BEACON_COMMON_ANODE=false 与此匹配。

教程示例使用 GPIO0/2/15，均涉及 classic ESP32 启动配置，我们现有保守 GPIO 白名单不允许这三脚，不应直接照教程接线再刷本固件；后续根据实物板图选择其他可用输出脚并同步配置。当前按 D-011 选择 IO25/26/27，配置已同步，输出仍默认禁用。

示例文字写共阴且高电平点亮，但 setColor 实际用了 255-r/g/b，逻辑不一致；随机变色仍可能看起来能工作，却不能作为我们状态颜色控制的依据。固件维持共阴亮度不反转、共阳才反转的实现。
