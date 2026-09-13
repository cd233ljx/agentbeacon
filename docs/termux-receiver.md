# Android / Termux Receiver

本指南适用于生成的独立 Receiver 包，Node.js >=24。无第三方运行依赖，无需 npm install。源仓库也可运行 Receiver，入口差异见下文。

## 生成和安装

在源仓库运行：

```bash
npm run package:receiver
```

生成 dist/agentbeacon-receiver-0.1.0.tgz 及同名 .sha256 文件。包只包含 Receiver、shared、启动入口、配置示例、此指南和 Apache-2.0 许可文件，不包含本地配置或服务器代码。

通过自己的文件传输方式将两个文件放到手机。以下假设已位于存放包的目录，在 Termux 执行：

```bash
sha256sum -c agentbeacon-receiver-0.1.0.tgz.sha256
mkdir -p ~/agentbeacon/releases
release_dir=$(mktemp -d ~/agentbeacon/releases/receiver-XXXXXX)
tar -xzf agentbeacon-receiver-0.1.0.tgz -C "$release_dir" --strip-components=1
cd "$release_dir"
cp receiver/config.termux.example.json receiver/config.json
pwd
```

记下实际安装目录。若从 Android 下载目录读文件，需要先在 Termux 授予存储访问；程序放在 Termux 私有目录中运行。

## 配置

**Termux 示例默认回环监听，远程部署必须填写手机自己的 Tailscale IP。** 启动前编辑 receiver/config.json：

| 字段 | 配置要求 |
| --- | --- |
| host | 手机自己的具体 Tailscale IPv4；本机测试可为 127.0.0.1，不用 0.0.0.0 |
| port | 默认 8787 |
| allowedSourceId | 默认 home-server，须与 Sender 一致；不是身份认证 |
| wledBaseUrl | 自己的 ESP32 热点 IP，格式 http://设备IP |
| dryRun | 初次 true，仅打印；确认设备可达后改 false |
| demoEnabled | 默认 false；只有要用显式 HTTP Demo 时启用 |
| receiverTimeoutMs | 默认 15000 |
| requestTimeoutMs | 默认 2000 |
| presets | idle=1、working=2、blocked=3、done=4、unknown=5 |

复制示例不会自动配置热点，也不会发现 ESP32。设备 IP 从固件串口或自己的热点客户端信息确认。wledBaseUrl 沿用兼容字段名，不表示设备运行 WLED。

## 启动和停止

独立包目录运行：

```bash
npm start
```

源仓库中对应命令为 `npm run receiver -- --config receiver/config.json`；源仓库无参数的 receiver 命令读取回环 dry-run 示例。

前台 Ctrl+C 停止。一次只启动一个 Receiver，不要批量杀死所有 Node 进程。需要日志文件时使用等价入口：

```bash
node scripts/run-receiver.mjs --config receiver/config.json >> receiver.log 2>&1
```

这仍是前台进程。另一个会话可运行 `tail -f receiver.log`。本版不自动安装后台守护、日志轮转或开机自启。

## 验证

以下命令中的“手机TailscaleIP”必须替换成自己的地址：

```bash
curl --noproxy '*' http://手机TailscaleIP:8787/health
```

health 包含 state、timed_out、dry_run、demo_active；它说明当前期望状态，不证明灯已亮。

服务器交互式终端运行 `npm run demo -- --url http://手机TailscaleIP:8787/v1/state`，按 1～5 验证。dry-run 日志为 `DRY-RUN WLED state=working preset=2`；真实输出成功为 `WLED 已应用 state=working preset=2`。同状态心跳不重复打印，失败保留警告，恢复后打印成功。

停止 Demo 后按发送端指南配置 Sender，再运行 `npm run sender -- --config server/config.json`。正常心跳下状态持续，停 Sender 后约 15～16 秒 unknown，重新启动后恢复。Herdr done 是后台完成未查看，前台完成可能直接 idle。

按键 Demo 无持续心跳，不适合固定停留展示。若启用了 demoEnabled，可用 POST /state 固定灯效，DELETE /state 恢复最新有效真实状态：

```bash
curl --noproxy '*' -X POST http://手机TailscaleIP:8787/state -H 'Content-Type: application/json' -d '{"state":"done"}'
curl --noproxy '*' -X DELETE http://手机TailscaleIP:8787/state
```

HTTP Demo 激活时，真实状态只缓存、不覆盖灯效；退出后过期则 unknown。演示后退出该模式。

## 故障与升级

| 现象 | 检查 |
| --- | --- |
| EADDRINUSE | 同端口已有 Receiver，回到其会话正常停止 |
| EADDRNOTAVAIL | host 必须是手机当前拥有的地址，检查 Tailscale |
| health 正常但灯不变 | dryRun、设备 IP、输出失败日志、固件 led_enabled、接线 |
| 稳定心跳却突然超时 | 手机后台暂停、网络路径、Sender 日志中的 retired_instance |
| 设备重启后黄灯 | 核对设备 IP，重启 Receiver 或切换状态重新同步 |
| 新状态被忽略 | 退出其他 Demo/Sender，再重启要使用的发送器 |

升级解包到新目录，复制自己的 config.json，停止旧进程后从新目录启动；保留旧目录用于回滚。不把新版默认配置直接覆盖自己的设备配置。

Android 厂商后台限制不同，演示时可保持亮屏；termux-wake-lock 不能保证进程永不暂停。长期后台稳定性未作统一保证。Receiver 停止但热点仍在时设备可能保留旧色；本系统只用于状态提示，不用于安全联锁。
