# Data Model Evolution：Conversation、Message 与 Life Episode

## Decision

本轮选择情况 B：**不立即新增 Message-level persistence**。

原因：Phase 2 的第一步可以通过现有 `chat_sessions.messages` 构建有限上下文；仓库目前没有版本化 migration 机制，在这个前提下立刻双写 `messages` 会引入顺序、一致性、升级和回滚风险。独立 Message 表确实是高级 Memory 和 LifeEpisode 的必要基础，但应作为 Phase 2 foundation 的第一个版本化迁移任务，而不是伪装成已经完成的 Phase 1 功能。

## Design Principles

- 保留现有 `users`、`emotion_records`、`weekly_letters`、`ai_memories` 和 `chat_sessions`。
- 新模型必须按 user_id 做服务端范围约束。
- 生成结果只是 candidate；Memory、LifeEvent、LifeEpisode 需用户确认后成为长期数据。
- High Risk 决策独立于普通生成链路，规则 high 不可降级。
- 来源可追踪，删除来源时定义保留/脱敏行为。
- 先 SQLite、普通索引和确定性查询；不因“AI Solution”提前引入 Vector DB。

## Core Entities

### User（复用）

继续使用 `users`。未来可增加 `status`、`deleted_at` 和 data-retention policy reference，但不在本轮修改。

### Conversation

由现有 `chat_sessions` 演进而来：

| Field | Type | Notes |
| --- | --- | --- |
| id | TEXT PK | 复用现有 session ID |
| user_id | TEXT FK | 所有查询必须带 user scope |
| started_at | TEXT | 已有 |
| ended_at | TEXT nullable | 会话结束时间 |
| title | TEXT nullable | 用户可改；自动标题只能是候选 |
| status | TEXT | active / closed / deleted |
| created_at | TEXT | 可与 started_at 初始化一致 |
| updated_at | TEXT | 每次追加消息更新 |

兼容方案：先为 `chat_sessions` 增加 nullable 字段，不重命名表；旧 `messages` JSON 保留到迁移验证结束。

### Message

建议新增表，但延后到 Phase 2 foundation：

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | TEXT PK | YES | 独立来源 ID |
| conversation_id | TEXT FK | YES | 关联 chat_sessions |
| user_id | TEXT FK | YES | 冗余 user scope，降低越权查询风险 |
| role | TEXT | YES | user / xiaozai / system |
| content | TEXT | YES | 原始消息正文 |
| created_at | TEXT | YES | 时间 |
| sequence_no | INTEGER | YES | 会话内严格递增；UNIQUE(conversation_id, sequence_no) |
| model | TEXT | NO | 生成消息的模型标识 |
| safety_level | TEXT | NO | low / medium / high，仅为路由证据，非诊断 |
| metadata_json | TEXT | NO | 版本化、最小化扩展；不得放密钥 |

索引：`(conversation_id, sequence_no)`、`(user_id, created_at)`。正文默认不进入日志或遥测。

### EmotionRecord（复用并扩展）

保留现有字段。Phase 2 建议新增 nullable：

- `source_message_id`：主要来源消息。
- `source_conversation_id`：来源会话。
- `extraction_version`：规则/Prompt/Schema 版本。
- 可选 `evidence_json`：只保存用户确认可接受的短来源引用，不保存隐藏推理。

旧 `raw_conversation_ref` 保留兼容，确认新字段稳定后再停止写入，不在当前阶段删除。

### Memory（从 ai_memories 演进）

| Field | Purpose |
| --- | --- |
| id / user_id | 复用 |
| type | semantic / episodic / preference / person / goal / concern / interaction_preference |
| content | 用户可见内容 |
| source_message_id | 来源消息，可空 |
| source_conversation_id | 来源会话，可空 |
| confidence | 候选质量信号，不对用户伪装成事实 |
| user_confirmed | 是否经用户确认 |
| status | candidate / active / disabled / rejected / deleted |
| last_used_at | 最近用于上下文的时间 |
| created_at / updated_at | 审计时间 |

现有 `category` 可暂时映射到 `type`，`visible=0` 映射为 disabled。详情见 `MEMORY_MODEL_PLAN.md`。

### LifeEvent

表示“发生了一件事情”，不是对用户人生的诊断：

| Field | Type | Notes |
| --- | --- | --- |
| id | TEXT PK | |
| user_id | TEXT FK | |
| source_conversation_id | TEXT nullable | provenance |
| source_message_id | TEXT nullable | provenance |
| event_type | TEXT | work / relationship / health / family / study / other 等可扩展值 |
| title | TEXT | 用户可修改的简短标题 |
| description | TEXT | 只基于用户表达 |
| happened_at | TEXT nullable | 不确定时允许空或范围 |
| people_json | TEXT | 初期 JSON；不得自动创建联系人 |
| emotion_json | TEXT | 关联情绪摘要，不替代 emotion_records |
| significance | INTEGER nullable | 用户确认的重要程度 |
| status | TEXT | candidate / confirmed / rejected / deleted |
| created_at / updated_at | TEXT | |

### LifeEpisode

表示持续一段时间的人生主题，如“考虑换工作”，由多个事件构成：

| Field | Type | Notes |
| --- | --- | --- |
| id | TEXT PK | |
| user_id | TEXT FK | |
| title | TEXT | 用户确认的名称 |
| summary | TEXT | 可编辑，不得编造 |
| status | TEXT | candidate / active / closed / rejected / deleted |
| started_at | TEXT nullable | |
| ended_at | TEXT nullable | active 时为空 |
| primary_theme | TEXT nullable | work / relationship 等 |
| created_at / updated_at | TEXT | |

### LifeEpisodeEvent

连接 Episode 与 Event：

| Field | Type | Notes |
| --- | --- | --- |
| episode_id | TEXT FK | 复合主键一部分 |
| event_id | TEXT FK | 复合主键一部分 |
| position | INTEGER | 叙事顺序 |
| linked_at | TEXT | |
| linked_by | TEXT | user / system_candidate；candidate 不等于确认 |

使用多对多可让一个事件在用户确认后关联多个主题；首版产品可以限制为一个主要 Episode，数据库不必限制死。

### WeeklyLetter（复用并扩展）

保留当前规则生成。未来 nullable 字段：

- `evidence_refs_json`：message/record/event 引用。
- `source_episode_refs_json`：确认过的 Episode 引用。
- `generation_version`：模板、Prompt 或规则版本。
- `input_snapshot_hash`：证明生成输入集合，不包含密钥。

本轮不改 Weekly Letter 逻辑。

### RiskEvent

应独立于 notification_events，因为“风险决策”和“是否通知/通知结果”是不同事实：

| Field | Purpose |
| --- | --- |
| id, user_id | 范围 |
| source_message_id, conversation_id | 来源 |
| risk_level | low / medium / high |
| trigger_json | 命中的规则类别，不记录隐藏推理 |
| decision | normal / enhanced_support / fixed_safety |
| consent_result | not_applicable / no_authorized_guardian / pending_user_confirmation / confirmed / declined |
| action | none / safety_shown / notification_prepared 等 |
| classifier_version | 规则/模型版本 |
| created_at | 时间 |

### AuditLog

只记录必要敏感动作，不做全量行为追踪：授权授予/撤回、通知预告创建/发送/撤销、Memory 确认/删除、账号导出/删除。建议字段：`id,user_id,actor_type,action,entity_type,entity_id,metadata_json,created_at`。metadata 禁止保存聊天原文和密钥。

## NOW / NEXT / LATER

### A. NOW — Phase 1

- 完成模型、兼容策略、迁移顺序和回滚设计。
- IA 对齐四个核心模块。
- 保留现有表和运行路径，不新增空壳业务表。
- 将 Message persistence 明确列为 Phase 2 foundation。

### B. NEXT — Phase 2 / 3

1. 建立 migration 版本表和事务执行器。
2. 新增 messages，回填旧 JSON，先双读校验，再启用双写。
3. 为 emotion_records 增加 nullable provenance/version 字段。
4. 实现 Context Builder 和用户确认的 Memory Candidate。
5. 增加 RiskEvent 和 ConsentEvent/必要 AuditLog。
6. Phase 3 再落 LifeEvent、LifeEpisode、LifeEpisodeEvent。

### C. LATER

- 周信 evidence refs 和 Episode 输入。
- 数据导出、删除证明、归档和保留策略。
- 数据规模真实需要时再评估 PostgreSQL、全文检索或向量检索。
- 真实通知 Provider 和投递回执必须在安全审查后接入。

## Future Migration and Rollback

推荐迁移顺序：

1. 在事务中创建 migration history 和新 `messages` 表/索引。
2. 逐条读取 `chat_sessions.messages`，生成稳定 sequence_no 并回填；记录源 session 和迁移版本。
3. 校验每个会话旧 JSON 条数与新表条数/内容哈希。
4. 应用先“新表优先、旧 JSON fallback”读取，写入阶段临时双写。
5. 观察无差异后停止旧 JSON 更新，但至少一个版本周期不删除字段。

回滚：切回旧 JSON 读取；新表是新增结构，不影响旧列；在确认无需回退前不 DROP 表或字段。测试必须覆盖 fresh DB、existing DB upgrade、失败事务回滚和旧数据不丢失。
