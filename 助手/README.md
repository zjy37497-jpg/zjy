# 搭练 AI 健身助手 · 微信小程序

## 导入与运行
使用有当前 AppID 权限的微信开发者工具导入本目录。项目无新增前端依赖，重新编译可预览。当前界面和原基线回复保留。

## 三个 Skill 与长期记忆
已接入聊天云函数的工具调用：只读档案、待用户确认的档案更新、服务端知识检索。个人档案入口位于聊天页右上角更多菜单。默认使用云函数，不因为客户端存在 API Key 自动切换直连。

完整配置、环境变量、集合权限、授权和测试说明见 docs/MEMORY_SETUP.md。代码已接入，不代表云端已经部署。

## 模式
- 云端 AI：三个 Skill 协作；档案需后端配置且用户确认开启，所有写入逐条确认。
- 本地基线：utils/reply.js 原规则，用于对照，不具备长期记忆。
- 本地直连调试：仅 utils/cloudConfig.js 中 directDebug=true 且原 config.js 有 key 时启用，不具备云档案。密钥会进入代码包，发布前清空客户端 apiKey。
- 原高风险关键词拦截和固定回复保留。云端失败明确报错，不以通用本地训练方案冒充个性化建议。

## Skill 文件
人设来源 skills/dada-persona/SKILL.md，运行副本 cloudfunctions/chat/SKILL.md。另两个 Skill 在 skills 下维护，同步到 cloudfunctions/chat/skills。总规则 cloudfunctions/chat/assistant-rules.md。改动后重新部署云函数。

## 知识与数据
knowledge.json 初始为空，不开放检索工具；加入真实审核资料并部署后启用关键词片段检索。客户端传入的 knowledge 不再作为可信知识使用。用户档案独立存放 dada_profiles，不加入公共知识。

本次没有改造本地计划页、日记或打卡存储。清空云档案不清除当前聊天或本地计划。

## 验证范围
JavaScript 语法、档案模拟隔离/确认/重放/冲突/删除、模型工具循环模拟已检查。未做真实云部署、真机、模型或数据库权限验收。详见部署说明。
