# Windows Codex 接续：COM3 刷机与单灯联调

日期：2026-09-13。最新：用户提供 Windows 编译日志，firmware.bin 已生成；RAM 43528 bytes，Flash 759573 bytes。尚无刷机证据。用户希望由 Windows 本地 Codex 直接操作，不再让用户逐条复制开发命令。先读根 AGENTS.md 和项目入口文档，再读本页、firmware/WIRING.md。范围是本机工具检查、编译、COM3 刷机和串口观察；用户负责插拔、接线及肉眼观察。不要重复安装已存在的工具或更改系统 Python。

## 已知设备与现场

- 用户确认开发板模块为 32E，属于 classic ESP32。CP2102 驱动已安装，Windows 自动识别 COM3，红色电源灯亮。
- Python 3.13.0。用户原先在 C:\Users\27248\Desktop 操作，firmware\platformio.ini 的 Test-Path 返回 True。
- 桌面项目局部虚拟环境应位于 C:\Users\27248\Desktop\.local\firmware-tools；用户报告路径检查 True，但贴出的命令格式曾缺反斜杠，先只读核实实际路径及 python -m platformio --version。
- 之前指示 PLATFORMIO_CORE_DIR 为桌面 .local\platformio，用户现已提供编译结束日志：成功链接 ELF 并生成 firmware.bin；可复用工具链，迁移源码或配置后按需增量构建。
- 曾指导复制桌面 firmware\include\config.example.h 为 config.local.h，并填写热点凭据；尚未确认实际填写情况。新工作区若没有本地配置，优先检查桌面原文件，复制时不在日志输出其内容、不覆盖已有新配置，不要求用户把密码发到聊天。
- 尚无上传 COM3、接灯或真灯验证证据。当前阶段灯输出应保持 false，先做开发板联网。

## GitHub 克隆入口

私有仓库 https://github.com/cd233ljx/agentbeacon 已创建并推送 main；Windows 使用有权限的 GitHub 登录后克隆。源码包含本轮固件和交接，不含桌面工具环境、Wi-Fi 本地配置或手机私钥。优先克隆，而非使用此前源码 ZIP。

## 工作区迁移

Linux .local 含 Linux Python 环境、工具链缓存及手机 SSH 私钥，不复制为 Windows 工具环境。firmware/.pio 也不要跨系统复用。提供的完整源码 ZIP 包含当前未提交固件和项目文档，但不含 .git 历史、.local、.pio、dist、node_modules 和本地配置。

Windows 现有桌面虚拟环境可以先按原绝对路径调用，无需移动。将 PLATFORMIO_CORE_DIR 指向已下载的桌面缓存以避免重复下载；源码参数 -d 指向新工作区 firmware。虚拟环境不宜直接搬目录；后续若要整理到工作区，另建 Windows venv 后再清理旧环境，未经检查不要删桌面内容。Linux 尚未提交的固件已在源码包中，不能只拉取旧 Git 提交。

## 最短接续顺序

1. 只读核实工作区、桌面 venv/缓存、原 config.local.h 和 COM3 当前设备身份。通过 PlatformIO 帮助及本地安装工具核实命令。不要碰其他串口或其他 Python 包。
2. 保持输出禁用，确认热点为 2.4GHz；本地私有配置填写后编译。工具下载不是编译成功，以构建退出码和日志为准。
3. 核对 classic ESP32/flash 容量并确认 COM3 对应目标板后，使用 pio run -d firmware --target upload --upload-port COM3 上传（源目录按实际位置）。用户当前正在推进首次刷机，可继续这一已说明的项目操作；若需插拔/按 BOOT 才询问用户做该物理动作。
4. 串口 115200 查看联网 IP，不输出热点密码。上传前关闭占用 COM3 的串口监视器，避免端口冲突。
5. 联网确认后让用户断开 USB，再按 WIRING.md 接 IO25→220Ω→R、IO26→220Ω→G、IO27→220Ω→B、公共阴极→GND。核对接线后启用本地配置 LED_ENABLED=true 并重新编译上传。
6. 手机 Receiver 的 wledBaseUrl 改为实际设备 IP，dryRun=false，再测五态。Windows 没有手机 SSH 私钥，不假设 Linux 项目 SSH 路径能直接使用；可由 Linux 原任务处理手机配置，或另行建立 Windows 授权，不自动复制私钥。真机结果记录到 tasks/evidence/handoff。

## 已验证与边界

Linux 已通过两种输出配置的目标编译、C++ ASan/UBSan 与真实 Receiver 编码联测、48 项 Node 测试。Windows 无 g++/sanitizer 时不要为复跑桌面 C++ 测试强行安装全局编译器，先完成设备任务并明确平台验证范围。

固件兼容 POST /json/state {"ps":1..5}，初始 unknown；自身 Wi-Fi 断开 unknown，重连恢复内存中最后状态。没有设备端心跳看门狗，手机去重可能导致设备重启后没有立即重发；切换状态或重启 Receiver 可重新同步。TUI 不持续发心跳，停留约 15 秒变黄属于手机超时。

手机安装目录 /data/data/com.termux/files/home/agentbeacon/releases/receiver-et6Qrz，地址 100.91.207.103；运行情况以当前检查为准，不使用历史 PID 16384 操作进程。服务器真实 Herdr 采集仍属于 Linux 环境，不在 Windows 上猜测 socket 来源。
