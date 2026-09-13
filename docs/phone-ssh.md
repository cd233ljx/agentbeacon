# 可选：通过 SSH 管理 Termux

SSH 不是运行 Receiver 的必要条件。可以直接在手机安装运行包并前台启动，见 [Termux 指南](termux-receiver.md)。

如果需要远程维护，先在自己的 Termux 中安装和配置 OpenSSH，启用 sshd，并记录 whoami 输出的用户名及手机 Tailscale IP。Termux 常用 SSH 端口为 8022，以实际配置为准。

建议为项目单独配置密钥和 known_hosts，放在被 Git 忽略的 .local/ssh 目录。通过手机本地核对主机指纹，使用严格主机校验，不关闭验证或提交私钥。

例如，在自己的配置中创建 agentbeacon-phone 别名后：

```bash
ssh -F .local/ssh/config agentbeacon-phone
```

仓库不会附带可用的账号、密钥、手机地址或部署目录。不要直接使用历史验证记录中的示例值。停止进程前核对其命令与工作目录，不使用历史 PID，也不要批量停止所有 Node 进程。
