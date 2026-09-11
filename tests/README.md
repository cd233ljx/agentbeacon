# 测试

使用 Node.js 内置 `node:test`，运行：

```bash
npm test
```

当前覆盖 Herdr 被动探针、v1 协议校验、Receiver 配置、顺序/重启/超时、HTTP 限制，以及本地模拟 WLED 的 preset 映射、去重、重试和恢复。模拟结果不替代 Android、Windows 或真实 WLED 验收。
