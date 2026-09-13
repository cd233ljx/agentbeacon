# 最新交接

日期：2026-09-13。当前 T-013 为 review：用户要求先写自研固件供人工审阅、边学边做。已完成源码、目标构建与桌面验证；不要因缺少硬件重新阻止软件 review。

## 最新接续：转交 Windows 本地 Codex

用户决定复制完整项目到 Windows 工作区，让当地 Codex 操作 USB/COM3。优先阅读 [Windows 接续说明](windows-handoff.md)：保留桌面现有 Windows venv、工具缓存及可能已填写的 config.local.h；不要复制 Linux .local/.pio，不自动迁移手机私钥。用户随后提供 Windows 编译日志，已成功生成 firmware.bin（RAM 43528 bytes / Flash 759573 bytes），尚未刷机。完整源码包包含未提交固件，排除本地配置和 Git 历史。后续开发命令由 Windows Codex 执行，用户负责物理接线和观察。

## 2026-09-13 实物进展

用户反馈硬件已到，模块标识为 32E；USB 接 Windows，CP2102 起初有黄色感叹号，安装驱动后自动识别为 COM3，无需重新插拔。用户报告 py --version 为 Python 3.13.0，Windows 尚无项目源码。已生成 dist/agentbeacon-firmware-windows.zip（白名单 7 个固件文件及入口说明、忽略规则）供下载；未包含密钥、凭据或构建缓存，ZIP 完整性检查通过。下一步用户下载解压，在 Windows 创建项目本地 PlatformIO 环境，再设置热点并编译。尚未在 Windows 编译、未刷机、未接灯，不改手机服务。

## 当前产品方向

D-010 优先于之前“先 WLED 后自研”的安排。用户提供套件 ESP32-WROOM-32D 型号，并选择套件中一颗四脚普通 RGB 灯展示五态。无需为本方案额外购买灯环；WLED/WS2812B 留为可选路径。用户随后确认四脚共阴，并提供 Keyes KE3069 官方教程：项目06 使用三根 220Ω 电阻；示意图从图示方向为 R/公共阴极/G/B，实物朝向仍待核对。教程采用 GPIO0/2/15；现按 D-011 选定 IO25/26/27 分别接红绿蓝，每路 220Ω，公共阴极 GND。方案已定，等待实物核对和验收。官方页称 32E、商家称 32D 的差异已记录。

自研固件复用手机 Receiver 已有 POST /json/state {"ps":1..5}，不改服务端/手机业务逻辑。设备状态初始 unknown；Wi-Fi 断开显示 unknown，重连恢复缓存期望状态。没有设备无请求看门狗，因为现有手机输出对相同状态去重；手机进程停止但热点仍在可能保留旧颜色，设备重启后也不保证手机主动重发。详见固件 README 的故障边界。

## 本轮交付

- firmware/README.md：面向初学者的阅读顺序、PWM/电阻说明、HTTP 合同、构建命令和 review 要点。
- firmware/include/beacon.h：可在桌面验证的解析和灯效；firmware/src/main.cpp：Wi-Fi、HTTP 和 PWM。
- firmware/include/config.example.h：空凭据、输出禁用、GPIO=25/26/27；本地 config.local.h 与 .pio 均忽略。
- firmware/platformio.ini：固定 espressif32 6.10.0 和 Arduino 2.0.17；构建目标 esp32dev 为通用 classic ESP32 4MB，不代表实际引脚布局已核实。
- scripts/verify-firmware.mjs 与 npm run test:firmware：C++ ASan/UBSan 故障测试，加真实 Receiver 请求正文到 C++ 解析器的回环联测。
- README、proposal、decisions、tasks 已同步单灯方案。证据 [T-013](evidence/T-013.md)。用户已于 2026-09-13 授权本轮提交并推送 GitHub 私有仓库，固件仍为 review，提交不代表真机验收。

本机工具：.local/firmware-tools 为 Python venv/PlatformIO 6.1.18，.local/platformio 为缓存，无全局安装。执行：

```bash
npm run test:firmware
PLATFORMIO_CORE_DIR="$PWD/.local/platformio" .local/firmware-tools/bin/pio run -d firmware
npm test
npm run check
```

结果：ESP32 编译 SUCCESS，RAM 43520 bytes，Flash 759593 bytes；固件逻辑与协议联测通过，48 项 Node 测试通过，语法与文档检查通过。固件位于 firmware/.pio/build/esp32dev/，不含真实凭据、未刷机。没有硬件实测证据，不能把构建标为真灯验收。

## 用户 review 后的下一步

先收集用户 review 反馈。firmware/WIRING.md 已提供接线表、面包板原理、Windows/Linux 上传步骤和手机联调；硬件到货后执行 T-009，核对实物与方案一致，再在本地配置启用 GPIO 并刷机。T-010 再完成手机 → 自研固件 → 真灯及真实 Agent 全链路。Windows T-011 和运行管理 T-012 仍未完成。不得擅自重启手机服务来验证纯固件改动。

## 已有手机连接与运行现场

SSH 配置已持久化在本机 .local/ssh/config，别名 agentbeacon-phone，地址 100.91.207.103:8022、用户 u0_a320。项目根目录使用 `ssh -F .local/ssh/config agentbeacon-phone`；SCP 也用 -F。专用私钥、核对后的 known_hosts 位于 .local/ssh，不入 Git，不输出私钥，未改全局 SSH 设置。见 [手机 SSH 指南](phone-ssh.md)。

手机 Node v26.3.1 / npm 11.17.0。Receiver 安装目录 `/data/data/com.termux/files/home/agentbeacon/releases/receiver-et6Qrz`，配置 receiver/config.json，日志 receiver.log。先前后台 PID 16384 已核对后 SIGTERM 停止，receiver.pid 可能为历史值；不要直接据此杀进程。用户后来在手机前台 npm start，并运行服务器 npm run demo，反馈“可以了”；当前运行状态以用户会话为准，本轮未操作手机。

手机仍为 dryRun=true，硬件启用后需将 wledBaseUrl（沿用旧字段名）改为设备地址、dryRun=false 并重启。按键 TUI 不发持续心跳，停留约 15 秒后手机显示 unknown；固定停留演示使用显式 HTTP Demo，持续状态使用 Sender。TUI 和 Sender 不应同时运行争夺同一 source_id。

## 既有证据与限制

T-003～T-008、T-010A、T-012A、T-012B 已完成。手机打包部署与公钥登录的上一提交为 7c6bedf；用户已授权本次创建并推送 GitHub 私有仓库（D-012）。接续时先 git status，保留已有文档与本轮修改。

Herdr 实测版本 0.8.2/protocol 20，Unix socket 为唯一状态来源；生命周期有历史重放，不能把事件流当作全新状态。普通 UI 未识别时不读取终端正文猜测状态。服务器与手机默认 source_id=home-server，手机 Tailscale IP 为上述地址。细节见 evidence/T-003.md、T-007.md。

T-005 只验证旧探针网络和约 20 秒锁屏，不能外推完整版长期后台稳定。T-010A 为完整 Receiver 手机接收与用户前台 Demo 打印，不代表真灯、ESP32 Wi-Fi 或 Windows 验收。

最新教程核对已追加到 firmware/README.md；仅更新说明，没有启用 GPIO 或改变业务代码。教程 setColor 的 255-r/g/b 与共阴高电平点亮说明矛盾，保留固件当前共阴不反转逻辑。本轮文档链接与 diff 检查通过。

D-011 实现：config.example.h 设 R=25/G=26/B=27、共阴、每路 220Ω，输出默认 false。完成启用输出配置和默认禁用配置的目标构建；未填写热点密码、未刷机、未操作手机。源码及指南仍待用户 review。
