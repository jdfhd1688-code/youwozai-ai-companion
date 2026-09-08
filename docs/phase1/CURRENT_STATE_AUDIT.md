# 「有我在」当前状态审查

## 1. Repository Identity

| 项目 | 结果 |
| --- | --- |
| GitHub | <https://github.com/jdfhd1688-code/youwozai-ai-companion> |
| Remote | `origin` fetch/push 均指向上述仓库 |
| Branch | `main` |
| 审查基线 HEAD | `5202a9bba9e21a709b10dbc5e0dfc873d011644e` |
| Last checked | 2026-09-08，Asia/Shanghai |
| 开工状态 | 存在上一轮 Phase 1 的未提交修改；已完整保留，无 reset、覆盖或切换分支 |

审查覆盖 README、全部 `docs/`、前端页面与组件、Route Handlers、数据库与数据访问、认证、AI/TTS Provider、风险与守护工作流、环境变量、测试、Seed、截图、视频和部署说明。

## 2. Tech Stack

| 维度 | 当前实现 |
| --- | --- |
| Frontend | React 19、Next.js App Router、TypeScript、原生 CSS、Lucide React |
| Backend | 同仓库 Next.js Route Handlers；API、领域逻辑、数据访问分层 |
| Framework | Next.js 15 |
| Database | Node `node:sqlite`，本地 SQLite 文件 |
| ORM / Data layer | 无 ORM；`src/lib/data-access.ts` 手写 SQL；启动时 `CREATE TABLE IF NOT EXISTS` |
| Authentication | 邮箱密码；scrypt 哈希；随机 Session Token 的 SHA-256 摘要；HttpOnly、SameSite=Lax Cookie |
| AI Provider | OpenAI-compatible `/chat/completions`；未配置或失败时回退本地确定性引擎 |
| TTS | OpenAI `/audio/speech` 主链路；SpeechSynthesis fallback；AudioContext 解锁和全局单音轨 |
| Deployment | 仓库内没有当前 Next.js 应用的生产部署配置；README 公开 Demo 是独立模拟环境，不是本仓库同构部署证据 |
| Test framework | Node Test Runner + `tsx`；Playwright Core 用于实际 UI 验证和截图 |

## 3. Current Pages / Routes

| Route | Page | Purpose | Status | Data source | Important dependencies |
| --- | --- | --- | --- | --- | --- |
| `/` | 根入口 | 按认证状态跳转 | READY | Cookie Session | `auth.ts`, Next redirect |
| `/login` | 登录/注册 | 认证与 Demo 入口 | READY / production hardening needed | `users`, `sessions` | auth APIs, `Mascot`, `VoiceButton` |
| `/home` | 首页 | 品牌入口、数量概览、核心模块入口 | READY | `countsForUser` | `PageShell`, `Mascot` |
| `/chat` | 和小在聊聊 | 陪伴、风险路由、草稿确认、语音 | PARTIAL | `chat_sessions`, voice settings | chat API, risk/LLM, audio manager |
| `/records` | 我的这一段路 | 按时间回看已确认记录 | PARTIAL skeleton | `emotion_records` | records API/data access |
| `/letter` | 有我在每周来信 | 已保存记录聚合、信件与图表 | PARTIAL | `emotion_records`, `weekly_letters` | weekly-letter, VoiceButton |
| `/guardians` | 守护圈 | 守护人、逐项授权、通知预告和审计 | PARTIAL | guardians、permissions、notifications | notification workflow |
| `/privacy` | 我 / 隐私中心 | 资料、Memory、语音设置、注销 | PARTIAL | users、memories、settings、records | me/memories/settings APIs |
| `/api/memories` | AI Memory API | 记忆条目 CRUD | PARTIAL | `ai_memories` | Session scope, data access |
| `/api/settings/voice` | Settings API | 自动播放和语速设置 | READY | `user_settings` | audio session/player |

当前一级导航已对齐为“聊聊 → 这一段路 → 来信 → 守护圈”；首页仍是品牌与总入口，隐私/设置通过页头个人入口进入，不再与四个产品模块并列。

## 4. Current Database

| Table | Purpose | Primary key | Important fields | Relationships | Future limitations |
| --- | --- | --- | --- | --- | --- |
| `users` | 用户身份和资料 | `id` | email、password_hash、nickname、timezone | 被用户域表引用 | 缺状态、数据保留/删除任务元数据 |
| `sessions` | 登录会话 | `token` | user_id、expires_at | N:1 users，级联删除 | 缺轮换、设备和主动失效元数据 |
| `chat_sessions` | 会话及聚合消息 | `id` | user_id、started_at、messages JSON | N:1 users | 无 ended/title/status/updated；消息不可独立引用 |
| `emotion_records` | 用户确认后的结构化记录 | `id` | labels JSON、intensity、trigger、thought、summary、risk | N:1 users；raw_conversation_ref 为弱引用 | 无 source_message_id、提取版本和来源证据 |
| `weekly_letters` | 周信快照 | `id` | period、summary、insight、promise、chart JSON | N:1 users | 无 evidence refs、episode refs、generation version |
| `guardians` | 用户的守护关系 | `id` | owner_user_id、guardian_user_id、relationship、status | owner N:1 users；guardian 账号可选 | 联系方式只是提示；无邀请/验证状态模型 |
| `guardian_permissions` | 每位守护人的分享授权 | `id`，guardian_id UNIQUE | notify、need_support、risk、labels、trend、stressor | 1:1 guardians | 只保存当前状态，无授权版本/撤回历史 |
| `notification_events` | 通知预告和状态记录 | `id` | guardian_id、trigger_type、shared_fields JSON、status、timestamps | N:1 users/guardians | 不是独立 RiskEvent 或通用 AuditLog；发送前未二次核权 |
| `ai_memories` | 用户管理的记忆条目 | `id` | content、category、visible、timestamps | N:1 users | 无来源、置信度、确认状态、使用记录和类型约束 |
| `user_settings` | 用户设置键值 | `(user_id, setting_key)` | value、updated_at | N:1 users | 类型/版本由应用约定 |

结论：现有结构足够支持 MVP 和 Phase 2 首个 Context Builder，但 `chat_sessions.messages` 聚合字段会阻碍后续 message provenance、Memory source 和 LifeEpisode linkage。应在 Phase 2 foundation 通过版本化、可回滚 migration 引入 `messages`，而不是在本轮缺少迁移体系时强行落表。

## 5. Current AI Workflow

```text
User Input
→ POST /api/chat（Session + 输入长度校验）
→ assessRisk 关键词规则
→ 可选 classifyRiskWithLLM
→ deterministicRiskFusion（规则 high 不允许下调）
→ localReply 生成安全基础回复/草稿
→ 非 Safety 时可选 LLM Companion Prompt
→ 可选结构化 Emotion Extraction + shape validation
→ Provider 失败回退本地回复和本地草稿
→ chat_sessions.messages JSON 存储
→ 前端展示；用户确认后 PUT /api/chat
→ emotion_records
→ High Risk 记录按已有授权生成 pending 通知
→ 可选 /api/tts → OpenAI audio 或浏览器 fallback
```

| Capability | Current state |
| --- | --- |
| Structured output | 有基本 JSON object 请求和 shape validation；无共享运行时 JSON Schema |
| Emotion extraction | 本地规则 + 可选 LLM；用户确认后才保存 |
| Memory extraction | 没有 |
| Conversation history in prompt | 没有；只传当前输入和昵称 |
| Memory retrieval | 没有；`ai_memories` 仅 CRUD |
| Fallback | 有；LLM/TTS 失败不阻断文字聊天 |
| Safety override | 有；确定性 high 优先，High Risk 绕过普通生成式回复 |
| TTS | OpenAI 优先、浏览器 fallback、Safety voice、单音轨和切页停止 |

## 6. Current Safety Workflow

### Low

- 未命中 high/medium 信号；普通负面情绪仍归 low support。
- 小在优先倾听、温和追问或生成可确认草稿。
- 不触发守护通知。

### Medium

- 命中持续痛苦、无希望、退缩等信号，或语义分类/趋势融合上调。
- 采用增强支持和自然追问，不进入 fixed High Risk UI。
- 不触发守护通知。

### High

- 明确自伤/轻生/死亡愿望/方法计划表达由规则或融合判定 high。
- 立即进入固定 Safety Workflow，普通 LLM 回复不能替换或下调。
- 页面显示克制短句、联系守护人、即时求助方式、确认安全后继续三项主操作。
- 只有用户确认并保存记录后，才读取事先设置的守护权限。
- 有授权时生成 `pending` 通知预告；仍需用户手动选择模拟发送或撤销。
- 没有真实短信、微信、Push 或电话投递；`sent` 只是站内模拟状态。
- pending/sent/cancelled 及时间戳写入 `notification_events`。

高风险缺口：缺独立 RiskEvent、Consent 版本、发送时二次核权、专业内容审阅、地区化求助资源、速率限制和生产运营流程。

## 7. Test Coverage

### Currently covered

- Low/medium/high 风险规则与边界表达。
- 方法/计划信号和确定性 high override。
- High Risk 固定流程和三项主操作。
- 守护人未授权不产生通知；授权字段裁剪。
- 通知 pending/sent/cancelled 生命周期。
- 情绪记录保存、编辑、删除和周信生成。
- TTS scene、Safety voice 和 Provider 请求。
- Audio 解锁、自动播放、暂停/恢复、超时、fallback、并发替换和切页清理。
- Phase 1 IA 命名和虚构 Demo 标识。
- 430×932 六路由、核心 GET API、console error 和 failed request 实际检查。

### Not covered

- 完整 Playwright 用户行为 E2E 和 CI 浏览器矩阵。
- API 越权、CSRF、限流和滥用测试。
- 真实 OpenAI LLM/TTS 受控合约测试。
- Migration、备份恢复、并发和数据删除证明。
- 屏幕阅读器、键盘和颜色对比度。
- Context、Memory、LifeEvent/LifeEpisode（尚未实现）。

### High-risk gaps

- 客户端可提交 riskLevel 的 API 对抗测试。
- 授权撤回后旧 pending 通知不可发送的测试。
- 否定、引用他人、新闻/创作、玩笑等误报语料治理。
- 地区求助资源有效性和专业人员审阅。

## 8. Current Product Strengths

1. 陪伴优先、用户确认后保存的产品边界明确。
2. High Risk 有确定性优先的固定流程，不完全依赖 LLM。
3. 守护圈逐人逐字段授权，默认不分享聊天原文。
4. LLM/TTS 故障时保留文字核心路径。
5. SQLite 提供真实 CRUD、Session 隔离和通知状态证据。
6. 语音已具备浏览器策略、单音轨和生命周期测试。
7. 记录、周信、隐私和守护圈形成可演示闭环。
8. 前端、API、领域逻辑和数据访问边界清楚，可渐进演进。

## 9. Current Product Weaknesses

### P0

- 标准 Demo 路径未发现现成 P0；这不代表达到真实生产安全标准。

### P1

- 长期记忆未成立：历史、记录和 visible Memory 不进入回复上下文。
- 保存草稿接口信任客户端 riskLevel，没有从会话风险结果再次约束。
- pending 通知模拟发送前不重新核验当前授权。
- 无版本化 migration、备份恢复和多实例数据策略。
- 仓库缺同构生产部署配置及 E2E/安全测试。

### P2

- “这一段路”仍是基础记录回顾，不是事件/人物/Life Episode 时间线。
- 周信仅使用 Emotion Records，缺 evidence refs 和 generation version。
- Chat 消息 JSON 聚合，难以独立检索、关联和审计。
- Consent 和 Audit 只有局部状态，没有通用事件模型。
- 缺匿名化 Observability、数据导出和完整聊天删除入口。
