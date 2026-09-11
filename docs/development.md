# 开发入口

当前方案见 [proposal.md](proposal.md)，执行任务见 [tasks.md](tasks.md)，Agent 工作流程见 [project-management.md](project-management.md)，最新现场见 [handoff.md](handoff.md)。

先验证 Herdr 状态与服务器→手机模拟状态，再开发聚合/Receiver 和模拟 WLED，最后采购硬件并做真实灯效联调。

日常命令：npm ci、npm run doctor、npm run check。当前 check 仅验证 .mjs 语法；实现业务时使用 Node 内置 node:test 并增加 npm test。

当前只新增项目目录，没有服务或全局安装；文档变更可通过版本控制审阅和回退。删除仓库前确认其中没有需要保留的开发成果。
