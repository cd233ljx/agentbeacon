# 维护交接

首版开发及用户验收已完成，日志与验收基线提交为 61f55d2。本轮 T-017 整理开源材料，许可证经维护者选择为 Apache-2.0。

## 本轮范围

README 改为使用入口，新增文档导航、贡献/安全/兼容性/发布说明，更新固件与 Termux 指南。历史证据保留日期和结果，私人部署标识替换为示例并标明脱敏。原文档在本机忽略目录 .local/open-source-backup 中保留，不作为公开资料。

维护者随后授权环境变量方案：源码/示例默认回环，npm run sender/demo 通过 Node --env-file-if-exists=.env.local 加载私人目标。已在本机创建权限 600、被 Git 忽略的 .env.local 保留既有手机地址；仍用原命令演示，无需改手机。显式 Sender 配置 receiverUrl 或 Demo --url 优先于环境变量；不代为启停现有进程。

当前文件已脱敏。维护者已授权推送，并明确接受历史中的内网部署信息；保留历史、正常推送，不重写或强推。历史定向扫描未命中常见私钥/令牌标记或本地配置路径，边界见 [release](release.md)。远程仍为私有仓库，不在本轮修改可见性。

Receiver 和 Sender 仍由维护者手动启停。不要依据历史 PID 操作进程；本机实际手机目录可从忽略的 .local/phone-release 或 .local/open-source-backup 中查询，公开文档不保存部署细节。

## 验证与下一步

npm test 51/51 通过；npm run check、文档本地链接与 diff 检查通过。Receiver 包许可、白名单及 SHA-256 检查通过；Node 环境文件加载验证保持原演示目标，未发设备请求。后续工作是维护者决定公开仓库的时机，不自动重新开启 Windows 或守护进程开发。当前限制见 [limitations](limitations.md)。
