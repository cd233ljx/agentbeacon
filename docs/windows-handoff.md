# Windows 使用说明

## 固件编译和上传

在连接 ESP32 的 Windows 电脑上克隆本项目；Python/PlatformIO 工具环境和热点配置应在本机创建，不复制其他机器的 .local、.pio 或私钥。完整 PowerShell 命令见 [固件接线与刷机指南](../firmware/WIRING.md)。

串口号以设备管理器和 PlatformIO device list 为准。历史设备的 COM 号不能用于其他机器。连接 CP2102 板子时如没有串口，应核对数据线及对应驱动。

## 作为备用 Receiver

Receiver 核心使用原生 Node.js，要求 >=24，可以在项目根目录用 npm run receiver 启动回环 dry-run。实际私网监听、Windows 防火墙和 Windows→ESP32 路径需在自己的网络确认。

本项目的主验收平台为 Android/Termux；Windows Receiver 完整链路尚未单独验收。Linux Sender 仍通过 Linux Herdr Unix socket 采集，不把 Windows 终端文本当状态来源。
