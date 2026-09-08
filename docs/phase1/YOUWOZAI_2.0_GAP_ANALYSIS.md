# 「有我在 2.0」Gap Analysis

状态只使用 `READY`、`PARTIAL`、`MISSING`。Phase 表示建议落地阶段，不表示能力已经实现。

| # | Capability | Status | Evidence / Current | Gap | Next action | Phase |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Conversation Experience | PARTIAL | `/chat` 有倾听、追问、草稿和降级 | LLM 不读历史、记录或记忆 | 最小 Context Builder + Companion Policy | Phase 2 |
| 2 | Safety Routing | PARTIAL | rule + optional LLM + deterministic fusion | 缺专业评审、独立 RiskEvent 和复杂语境评测 | 固化风险决策记录和 eval set | Phase 2 foundation |
| 3 | Structured Emotion | PARTIAL | 用户确认后写 `emotion_records` | 无来源消息、提取版本、置信度 | 增加 provenance 字段和 schema | Phase 2 |
| 4 | Conversation Storage | PARTIAL | `chat_sessions.messages` JSON | 缺 ended/title/status/updated，查询粒度粗 | 保留兼容读，设计 Conversation v2 | Phase 2 foundation |
| 5 | Message-level Storage | MISSING | 无独立 messages 表 | 无 sequence、独立 ID、来源关联 | 版本化 migration 新增 messages；不删旧 JSON | Phase 2 foundation |
| 6 | Semantic Memory | MISSING | `ai_memories` 未参与生成 | 无自动候选、来源和检索 | 先做用户确认候选，不上 Vector DB | Phase 2 |
| 7 | Episodic Memory | MISSING | 无 Event/Episode 模型 | 无持续主题和事件聚合 | 先 LifeEvent，再用户确认 Episode | Phase 3 |
| 8 | User-controlled Memory | PARTIAL | Memory 可见、修改、隐藏、删除 | 无候选确认、来源和使用历史 | 增加 candidate/confirmed/status/provenance | Phase 2 |
| 9 | Life Event | MISSING | trigger 只在情绪记录文本中 | 无可复用事件实体 | 设计 LifeEvent，用户确认后保存 | Phase 2/3 |
| 10 | Life Episode | MISSING | 无相关表和工作流 | 无跨事件持续主题 | 建立 Episode candidate + event link | Phase 3 |
| 11 | Timeline | PARTIAL | `/records` 按日期展示确认记录 | 缺重要事件、人物、用户表达和阶段 | 以真实记录为基础渐进增加 event rows | Phase 2/3 |
| 12 | Weekly Letter | PARTIAL | 规则聚合 Emotion Records | 不读消息、Memory、Event、Episode；无证据引用 | 保留当前逻辑，未来扩展输入和 refs | Phase 3 |
| 13 | Guardian | PARTIAL | 关系、逐项权限、pending、模拟状态 | 无真实邀请/投递/回执 | 发送二次核权后再评估 Provider | Phase 2 hardening / Later |
| 14 | Consent | PARTIAL | `guardian_permissions` 保存当前选择 | 无版本、用途、授予/撤回时间和文案版本 | ConsentEvent 最小模型 | Phase 2 foundation |
| 15 | Audit | PARTIAL | `notification_events` 有状态时间戳 | 仅覆盖通知，不是通用 AuditLog | 只记录敏感动作和状态变化 | Phase 2/3 |
| 16 | Privacy | PARTIAL | Session 隔离、服务端密钥、Memory CRUD、注销 | 缺政策、保留期、生产安全控制 | 明确政策并补安全测试 | Before pilot |
| 17 | Data Export / Delete | PARTIAL | 可删记录/Memory/账号 | 无完整导出、聊天级删除和删除证明 | 设计导出格式与删除任务审计 | Phase 3 / Before pilot |
| 18 | Evaluation | PARTIAL | 有规则单测和 Phase 1 eval 设计 | 无 Conversation 质量数据集与评分流程 | 落地离线 eval runner 和人工 rubric | Phase 2 |
| 19 | Automated Tests | PARTIAL | 36 tests + 11 workflow subset + UI verifier | 缺完整 E2E、API security、migration、CI matrix | 先补 Conversation/Safety contract tests | Phase 2 foundation |
| 20 | Observability | MISSING | 少量不含正文的 console fallback | 无匿名错误码、延迟和 fallback 指标 | 定义无正文 telemetry schema | Phase 2 |
| 21 | UI Information Architecture | READY | 已对齐“聊聊/这一段路/来信/守护圈” | 首页与设置需保持辅助层级 | 保持四模块，不扩外围功能 | NOW |
| 22 | Mobile Experience | READY | 430×932 实际路由验证和截图 | 缺多浏览器、键盘和无障碍矩阵 | 加 Playwright device/viewport matrix | Phase 2 |

## Overall Decision

当前项目可以进入 Phase 2 的基础工作，但不能把现有 `ai_memories` 描述为已实现长期记忆，也不能把“这一段路”描述为 Life Episode。Phase 2 应先做确定性编排、Context Builder、Message persistence migration 及 Memory Candidate 用户确认，不应先做 Multi-Agent、RAG 或 Vector Database。
