# 最新交接

日期：2026-09-13。用户确认“全部搞定完成，提交吧”。本轮收口日志修复和实物验收，创建本地 Git 提交；不推送、不启停服务。

## 已完成

- Receiver 真实 HTTP 成功后打印 state/preset，稳定心跳不刷屏；实际手机副本已更新并验证，见 [T-015](evidence/T-015.md)。
- Sender 首次、状态/原因变化及故障恢复打印确认日志；stale/retired_instance 明确未采用，重复处置去重，见 [T-016](evidence/T-016.md)。
- 用户完成 Demo 五态/超时恢复、真实 Herdr 联调和面包板接线，并最终确认全部完成。T-009/T-010/T-013 按用户整体验收收口；具体直接证据、最终坐标及未测边界见 [T-010](evidence/T-010.md)。
- 保留 IO25/26/27、三路 220Ω、共阴 RGB；本轮没有修改固件或重刷。3V3=C40、A/B 露出的实物坐标已记录。

## 当前运行方式

Receiver 和 Sender 均由用户手动前台启停，不要代为启动。手机目录 `/data/data/com.termux/files/home/agentbeacon/releases/receiver-et6Qrz`，运行 npm start；配置 dryRun=false，设备 http://10.40.220.147，监听 100.91.207.103:8787。日志直接显示在前台，不应通过读取终端正文采集其他 Agent 信息。

T-015 验证时的后台 PID 20548 已经核对后 SIGTERM 停止，receiver.pid 已清除。receiver.log 保留历史后台验证输出。旧输出模块备份 receiver/wled-output.mjs.pre-T015；回滚先由用户停止 Receiver，再复制回原模块并启动。项目 SSH：ssh -F .local/ssh/config agentbeacon-phone，严格主机校验，凭据在 .local/ssh，不提交。入口见 [phone-ssh](phone-ssh.md)。

服务器项目目录运行 npm run sender，默认每 5 秒向手机发送真实 Herdr 快照。Herdr 0.8.2/protocol 20，Unix socket 是唯一状态来源。按键 Demo 与 Sender 共用来源，新实例退休旧实例，切换时退出当前发送器并启动所需发送器。HTTP Demo 是另一隔离机制，当前未启用。

Herdr done 表示后台完成未查看；当前可见页完成可能直接 idle，不修改上游语义。设备断电后固件仍在 Flash；设备重启后 Receiver 去重不保证主动补发，必要时重启 Receiver 并核对设备 IP。

## 验证及下一步

提交前 npm test 49/49 通过，npm run check 通过，文档本地链接与 git diff --check 通过。此前对应输出测试 3 项、发送端/应用测试 6 项通过，手机实际 HTTP 验证见 T-015。

剩余任务：T-011 Windows 备用验证、T-012 正式运行管理与交付。长期后台/锁屏、独立供电稳定性、逐项多 Agent/延迟测量没有新增实测数据，不把用户整体验收写成虚构测量。无需重复阻塞已接受的真灯成果。

Git origin 为 GitHub 私有仓库 cd233ljx/agentbeacon；本轮仅提交，未推送。.local、config.local.h、.pio、dist 不入库。Windows 工具与刷机历史见 [Windows 接续](windows-handoff.md)，固件构建历史见 [T-013](evidence/T-013.md)。
