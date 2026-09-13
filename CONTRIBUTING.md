# 贡献指南

欢迎通过 Issue 描述可复现的问题，或通过 Pull Request 提交范围明确的改动。项目使用 Apache-2.0，见 [LICENSE](LICENSE)。

## 本地开发

需要 Node.js >=24。安装和检查：

```bash
npm ci
npm test
npm run check
```

Node 链路使用原生 ESM 和内置模块，没有第三方运行依赖。固件测试与工具链见 [开发说明](docs/development.md)。

## 提交改动

说明问题、修改后行为及验证结果。业务变更覆盖相关边界和故障；文档变更检查链接与命令。设备相关结果写明板型和实测平台，模拟测试不能冒充真机验收。

保持 Receiver 核心跨平台，不引入 bash/systemd 依赖。Herdr 状态仅来自正式 Unix socket API，不读取 Agent 凭据、提示词或终端正文。新增依赖请说明必要性并更新锁文件。

不要提交 .env、本地配置、SSH 密钥、私人地址、日志正文、构建缓存或含 Wi-Fi 凭据的固件。安全问题按 [SECURITY.md](SECURITY.md) 处理。
