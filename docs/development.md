# 开发与测试

首版功能已完成，当前进入维护阶段。读者从 [README](../README.md) 开始；修改代码前阅读 [协议](protocol.md)与相关目录说明。

## Node 链路

Node.js >=24，无第三方运行依赖。项目目录执行：

```bash
npm ci
npm test
npm run check
npm run package:receiver
```

npm test 使用 node:test，覆盖协议校验、聚合、订阅与重连、顺序、超时、HTTP 输出、日志去重和 Demo。check 检查 .mjs 语法，不替代业务测试。package:receiver 生成带校验文件的白名单运行包，不发布到 npm。

npm run doctor 是本机环境诊断；仅开发 Receiver 时缺少 Herdr/Tailscale 不影响回环测试。任何测试都不应借用真实设备地址作为模拟目标。

## 固件

固定 PlatformIO Core 6.1.18、espressif32 6.10.0 和 Arduino-ESP32 2.0.17。首次工具安装与上传见 [WIRING](../firmware/WIRING.md)。

```bash
npm run test:firmware
```

桌面测试需要 g++（或通过 CXX 指定兼容编译器）及 ASan/UBSan，覆盖灯效、解析和 Receiver 请求正文联测。它不刷机；开发板构建和真机验证属于不同验证层次。

## 项目约定

默认只在回环地址开发；私网设备用显式配置。业务改动运行相关测试及 check；纯文档做本地链接和一致性检查。维护本地配置与受版本控制的示例之间的隔离。

项目历史见 [tasks](tasks.md) 和 [evidence](evidence/T-010.md)。Agent 维护流程见 [AGENTS](../AGENTS.md)，也欢迎人工贡献者按 [贡献指南](../CONTRIBUTING.md) 操作。
