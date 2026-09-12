# 手机 SSH 操作入口

已于 2026-09-12 在本开发机持久化项目专用连接，别名为 `agentbeacon-phone`。在项目根目录执行：

```bash
ssh -F .local/ssh/config agentbeacon-phone
```

执行单条远程命令或传文件：

```bash
ssh -F .local/ssh/config agentbeacon-phone 'node --version'
scp -F .local/ssh/config dist/agentbeacon-receiver-0.1.0.tgz agentbeacon-phone:~/
```

从其他目录执行时，把 `-F` 后的路径换为 `/home/cd233/CODE/Linux_Exp/agentbeacon/.local/ssh/config`。

## 本地配置

| 文件 | 用途 |
| --- | --- |
| .local/ssh/config | 地址 100.91.207.103、端口 8022、用户 u0_a320、密钥及主机记录路径 |
| .local/ssh/termux | 专用私钥，权限 600；不输出、不传到手机、不入 Git |
| .local/ssh/termux.pub | 手机已授权的公钥 |
| .local/ssh/known_hosts | 与用户提供指纹核对后的主机公钥 |
| .local/phone-release | 当前手机 Receiver 安装目录 |

.local 已被 Git 忽略，不包含在 Receiver 安装包中；这些配置仅存在本机，重新克隆仓库不会自动取得密钥。仓库移动后需更新 config 中的绝对路径。没有修改全局 ~/.ssh/config 或全局认证。

配置启用了严格主机校验、仅指定密钥登录及 BatchMode；认证失败时直接报错，不等待密码。手机重装后若主机指纹变化，先在手机重新核对，不关闭严格校验。网络需保持 Tailscale 连通且 Termux sshd 运行。

## 当前 Receiver

安装目录为 `/data/data/com.termux/files/home/agentbeacon/releases/receiver-et6Qrz`，其下有 receiver.log、receiver.pid 和 receiver/config.json。

```bash
ssh -F .local/ssh/config agentbeacon-phone 'tail -n 30 ~/agentbeacon/releases/receiver-et6Qrz/receiver.log'
```

先前的 detached Node 进程已按用户手动演示安排停止；当前由用户在 Termux 前台执行 npm start。receiver.pid 可能仍为旧值；未配置开机自启或崩溃重启。停止前读取 receiver.pid，并核对该 PID 的命令仍是此目录的 Receiver；不要仅凭历史 PID 杀进程。更新部署后同步 .local/phone-release 及交接目录。手机 SSH 可用不代表灯环或后台稳定性已验收。

## 验证记录（T-012B）

`ssh -F .local/ssh/config agentbeacon-phone 'whoami; node --version'` 实测返回 u0_a320、v26.3.1，退出码 0。`ssh -G` 确认地址、端口、密钥、主机记录与严格校验生效。已修复任务表中先前插入 T-010A 时误拆的 T-012 行；任务表列数、任务 ID 唯一性、文档链接及 git diff --check 通过。本次未改业务代码或手机服务状态。
