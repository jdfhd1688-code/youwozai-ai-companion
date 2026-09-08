# Phase 1 Hardening Changelog

日期：2026-09-08
基线：`main` / `5202a9bba9e21a709b10dbc5e0dfc873d011644e`

## Added

- 当前状态审查和 22 维 2.0 Gap Analysis。
- Conversation、Message、Memory、LifeEvent、LifeEpisode、RiskEvent 和 AuditLog 兼容数据模型设计。
- Memory 类型、来源、确认、禁用、删除与 provenance 计划。
- Phase 2 对话质量、安全、依赖边界和 Memory 候选 Evaluation 计划。
- `scripts/verify-ui.mjs`：路由、核心 GET API、console error 和失败请求检查。
- `typecheck`、`test:integration`、`verify:ui` 脚本及 Phase 1 IA 回归测试。

## Changed

- 一级导航调整为“聊聊 → 这一段路 → 来信 → 守护圈”。
- 首页保留为品牌入口；“我、AI Memory、语音设置、隐私”降为页头个人入口。
- `/records` 统一为“我的这一段路”，增加基于已确认记录的基础回顾说明。
- 登录页明确 Demo 账号内经历、关系和情绪均为虚构数据。
- 将失效的 `next lint` 改为 `eslint .`，补齐现有 ESLint 配置所需开发依赖。
- 清理 lint 发现的未使用导入/变量，没有改变领域行为。
- 截图脚本支持 `CAPTURE_VIDEO=false`，并覆盖 AI Memory / Privacy 页面。

## Preserved

- High Risk 确定性优先和 fixed Safety Workflow。
- 三项 High Risk 主操作及更慢、更克制的 Safety voice。
- 用户确认后才保存 EmotionRecord。
- 守护圈逐人逐字段授权、pending、模拟发送/撤销和时间戳。
- SQLite 现有表、数据和 `chat_sessions.messages` JSON。
- Weekly Letter 核心生成逻辑。
- LLM/TTS fallback、AudioContext 解锁、自动播放和全局单音轨。

## Deferred

- 独立 `messages` 表及 migration：已完成设计，延后到 Phase 2 foundation 实现。
- Context Builder、Need/Intent Detection、Companion Policy 和 Response Validation。
- Memory Candidate 提取/确认和 Memory retrieval。
- LifeEvent、LifeEpisode、LifeEpisodeEvent。
- Weekly Letter 多来源输入和 evidence refs。
- RiskEvent、ConsentEvent、通用 AuditLog。
- 真实外部通知、生产 Observability、数据导出和删除证明。
- Multi-Agent、RAG、Vector Database。

## Risks

- `PUT /api/chat` 仍信任客户端提交的 riskLevel，需要服务端约束。
- 旧 pending 通知模拟发送前仍未重新读取最新授权。
- `ai_memories` 尚未进入对话上下文，不能描述为已实现长期记忆。
- 当前数据库没有版本化 migration/rollback runner。
- 公开 Demo 是独立模拟实现，不能代替本仓库同构生产部署验证。
- 真实 LLM/TTS 额度、音色和生产延迟没有在本轮验证。

## Verification

- `pnpm install`：PASS，lockfile 已是最新状态。
- `pnpm lint`：PASS，0 error。
- `pnpm typecheck`：PASS。
- `pnpm test`：PASS，36/36。
- `pnpm test:integration`：PASS，11/11。
- `pnpm build`：PASS，Next.js 15.5.25 完成 24 个路由构建。
- `pnpm dev`：PASS，本轮验收服务运行于 `http://127.0.0.1:3001`（3000 已被既有进程占用）。
- `pnpm verify:ui`：PASS；移动端 430×932 与桌面端 1280×800、6 个页面、4 项一级导航、新用户空状态和 8 个核心 GET API 均通过，console error 与 failed request 均为 0。
- `CAPTURE_VIDEO=false pnpm capture:portfolio`：PASS，重新生成并人工检查 7 张脱敏截图；视频未重录。
- 本轮没有数据库 schema 变更，因此 fresh/upgrade migration 验证不适用；现有 SQLite 与 JSON 会话数据保持不变。
