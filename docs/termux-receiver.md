# 手机完整版 Receiver 运行指南

适用：Android / Termux，Node.js >=24。当前使用 ESP32 单颗 RGB 自研固件，兼容 WLED preset 接口。当前手机的单文件 probe 仅用于打印状态；本包包含正式协议校验、来源和顺序检查、15 秒超时、WLED 输出及 HTTP Demo。无第三方运行依赖，无需 npm install。

运行包已在手机安装验证；用户确认服务器 Demo 真灯五态及超时恢复通过。长期后台稳定性、真实 Herdr 多 Agent 全链路与可选 WLED 硬件仍待验收。

## 1. 生成与传入手机

Agent 在项目根目录运行：

```bash
npm run package:receiver
```

产物为 `dist/agentbeacon-receiver-0.1.0.tgz` 及同名 `.sha256` 文件。只打包明确列出的 Receiver、shared、启动入口、示例配置和本说明，不带服务器代码、本机 config.json、日志或 Wi-Fi 凭据。版本取自项目 package.json；版本变化时同步替换以下文件名。重复打包会更新 dist 中同版本的产物，不影响运行中的服务。

将两个文件通过你现有的文件传输方式放到手机下载目录。这里不要求开放下载服务。

在 Termux 中先检查：

```bash
node --version
npm --version
```

Node 主版本至少 24；若不满足，先处理 Termux 的 Node 环境，不继续启动。已有的手机探针环境可以复用。

首次需要访问手机下载目录时运行 `termux-setup-storage`，按 Android 提示允许存储访问。随后执行：

```bash
cd ~/storage/downloads
sha256sum -c agentbeacon-receiver-0.1.0.tgz.sha256
mkdir -p ~/agentbeacon/releases
release_dir=$(mktemp -d ~/agentbeacon/releases/receiver-XXXXXX)
tar -xzf agentbeacon-receiver-0.1.0.tgz -C "$release_dir" --strip-components=1
cd "$release_dir"
pwd
cp receiver/config.termux.example.json receiver/config.json
```

校验应为 `OK`。记下 `pwd` 输出的完整目录；每次解包创建新目录，保留旧版用于回滚。程序放在 Termux 私有目录中运行。

## 2. 配置与前台启动

用手机现有的文本编辑器打开 `receiver/config.json`。手机示例已填入上次验证的 Tailscale IP `100.91.207.103`；先在 Tailscale 应用中确认仍是此地址。

| 字段 | 当前值及用途 |
| --- | --- |
| host | `100.91.207.103`，只监听手机具体 Tailscale 地址；变化后同步更新服务器目标 |
| port | `8787` |
| allowedSourceId | `home-server`，与 Sender 和按键 Demo 默认来源一致；它不是身份认证，网络访问仍须受 Tailscale 策略限制 |
| dryRun | `true`，硬件未到时只打印灯效，不访问 WLED |
| wledBaseUrl | `http://192.168.1.100` 仅是占位，接硬件时改为热点内 ESP32 的实际地址 |
| receiverTimeoutMs | `15000`，正式快照超时显示 unknown |
| requestTimeoutMs | `2000`，WLED 单次请求超时 |
| demoEnabled | `false`，默认关闭简化 HTTP Demo；不影响服务器按键 TUI |

先到旧探针所在的 Termux 会话按 Ctrl+C，避免它继续占用 8787。不要用批量杀 Node 进程的方式停止其他程序。然后在新包目录启动：

```bash
npm start
```

预期先打印 `DRY-RUN WLED state=unknown preset=5`，随后打印监听地址和 `dry-run=true`。没有有效快照时 unknown 是正常初始状态。仓库内开发入口默认读取回环示例；本运行包的 `npm start` 明确读取 `receiver/config.json`，缺失则报错。

在另一个 Termux 会话检查（地址变化时替换）：

```bash
curl --noproxy '*' http://100.91.207.103:8787/health
```

返回应包含 `status:"ok"`、`state:"unknown"`、`dry_run:true`、`demo_active:false`。`/health` 表示接收服务和当前期望状态，不证明 WLED 已成功应用或灯已亮。

## 3. 无硬件验收

服务器和手机必须在已允许互通的 Tailscale 网络中。一次只运行一种发送器：Herdr Sender 与按键 TUI 使用相同 source_id，同时运行会争夺实例状态。

1. 手机上保持上述完整版 Receiver 前台运行，`dryRun=true`。
2. 服务器项目目录运行 `npm run demo`，依次按 1～5。手机应打印 idle/working/blocked/done/unknown，对应 preset 1/2/3/4/5；重复相同状态可能因去重不再打印。
3. 按键 TUI 使用正式 `/v1/state`，仅按键时发送，不持续发送心跳。不按键超过约 15～16 秒后，手机应变为 unknown，health 的 `timed_out` 为 true。再按 2 应恢复 working。
4. 按 q 发送 idle 后退出。退出后没有其他发送器，仍会在约 15～16 秒后变为 unknown，这是通信超时规则。
5. 如需验证持续状态，退出 TUI 后在服务器运行 `npm run sender`。它每 5 秒发送真实 Herdr 状态；没有会话时可以是 idle，不保证一定出现 working。正常心跳下，done 不会因停留 15 秒而消失。停止 Sender 后应超时 unknown，重启后恢复当前有效状态。

若手机 IP 改变，TUI 使用 `npm run demo -- --url http://手机实际IP:8787/v1/state`；Sender 在其配置文件中修改 receiverUrl，再用 `npm run sender -- --config server/config.json` 启动。

需要固定停留的手动灯效时，可以将 `demoEnabled` 改为 true 并重启，在手机调用：

```bash
curl --noproxy '*' -X POST http://100.91.207.103:8787/state -H 'Content-Type: application/json' -d '{"state":"done"}'
curl --noproxy '*' -X DELETE http://100.91.207.103:8787/state
```

POST 激活独立 HTTP Demo，正式心跳继续缓存但不覆盖显示；DELETE 退出并恢复有效正式状态，否则 unknown。HTTP Demo 激活期间不能用灯效验证正式心跳超时。验证结束关闭 demoEnabled 并重启。

## 4. 停止、日志与后台

前台按 Ctrl+C 停止 Receiver；需要再次运行时进入记下的运行包目录，执行 `npm start`。停止服务不会自动给灯发送熄灭指令，灯可能保留最后效果。

需要保存诊断日志时可直接运行等价的 Node 命令：

```bash
node scripts/run-receiver.mjs --config receiver/config.json >> receiver.log 2>&1
```

仍在当前会话前台运行，可按 Ctrl+C 停止；另一个会话进入同目录后用 `tail -n 80 receiver.log` 查看。日志会追加，长期运行前需另行安排轮转。dry-run 打印 `DRY-RUN WLED state=working preset=2`；真实输出在设备 HTTP 成功响应且响应体读取完成后打印 `WLED 已应用 state=working preset=2`。重复相同状态的有效心跳不重复请求或打印；失败仍打印警告，重试或后续心跳恢复成功时打印成功日志。成功日志证明 HTTP 请求成功，不替代肉眼检查灯效。

演示优先保持 Termux 会话和手机亮屏。需要测试锁屏时，可先执行 `termux-wake-lock`，结束后执行 `termux-wake-unlock`；不要关闭承载服务的 Termux 会话。唤醒锁不提供崩溃重启，也不证明厂商后台限制已解决。当前只验证过旧探针约 20 秒锁屏，完整版需要重新测试。后台自启、守护和 Linux 进程管理仍属于后续 T-012。

## 5. 硬件到货后的切换

先确认具体 ESP32、灯环、GPIO 和供电，再刷 WLED。不要照占位配置直接接线。

| Preset | 状态 | 需在 WLED 保存并实测的效果 |
| --- | --- | --- |
| 1 | idle | 熄灯 |
| 2 | working | 蓝色呼吸 |
| 3 | blocked | 红色提示，节奏现场调整 |
| 4 | done | 绿色常亮 |
| 5 | unknown | 黄色慢闪 |

让 ESP32 连接手机热点，确认手机能访问其 WLED 页面并手动调用全部 preset。停止 Receiver，备份 config.json，填写实际 wledBaseUrl，将 dryRun 改为 false，再启动。Receiver 启动时会尝试应用 unknown/preset 5。按第 3 节重复验证并观察真灯；保存不含 Wi-Fi 凭据的 preset 备份和结果记录。

设备到货后仍需验证手机访问热点客户端、多 Agent、断线恢复、实际延迟及供电稳定性。Receiver 崩溃、手机进程被暂停、ESP32 断网或断电时，不能保证黄色提示。

## 6. 排查与回滚

| 现象 | 排查方式 |
| --- | --- |
| EADDRINUSE | 回到旧探针或旧 Receiver 会话按 Ctrl+C；只停止明确识别的本项目进程 |
| EADDRNOTAVAIL | 确认 Tailscale 已连接，host 是手机当前拥有的具体地址；不要改成 0.0.0.0 |
| health 访问失败 | 先在手机访问同一个具体监听地址，再从服务器访问；检查进程、目标地址、端口和 Tailscale 访问策略 |
| 配置读取失败 | 确认处于解包目录、config.json 存在且是合法 JSON |
| 状态请求被拒绝 | 检查响应 error.code、source_id、协议结构及实例/序号；不要重放旧包代替恢复 |
| 按键后约 15 秒黄灯 | TUI 没有周期心跳；持续验证用 Sender，固定演示用显式 HTTP Demo |
| health 正常但灯不变 | 确认 dry_run=false、demo_active 符合预期、WLED 地址和 preset 正确，再查日志中的超时或 HTTP 错误 |
| 服务器 curl 不通 | 使用 `--noproxy '*'` 避免代理截获私网请求；Node fetch 在此前环境中可直连 |

升级时在新目录解包，将旧版 receiver/config.json 复制到新版，停止旧进程后从新目录启动。升级失败时停止新版，回到原目录按原命令启动；旧版文件和配置不覆盖。若回退到单文件 probe，只恢复打印能力，不包含超时或灯光控制，不能算完整链路正常。

验收回传：Node 版本、实际监听地址、启动输出、五态与超时恢复结果、health 响应、是否锁屏及持续时间。不要提供 Wi-Fi 密码或 Agent 终端正文。

Termux 命令依据：[官方工具手册](https://github.com/termux/termux-tools/blob/master/doc/termux.1.md.in)、[官方存储设置脚本](https://github.com/termux/termux-tools/blob/master/scripts/termux-setup-storage.in)。
