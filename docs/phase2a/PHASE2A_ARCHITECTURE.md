# Phase 2A Architecture：Message-level Persistence

## Scope

Phase 2A 只建立 Conversation/Message 持久化与 provenance。它不实现 Need/Intent、Persona、Memory Retrieval、RAG、Multi-Agent、LifeEvent/LifeEpisode 或 Weekly Letter 重写。

## Old Model

`chat_sessions(id,user_id,started_at,messages)` 把整段聊天保存为 JSON 数组。消息没有独立 ID 和数据库约束，排序依赖数组位置，EmotionRecord 只能通过 `raw_conversation_ref` 弱引用会话。旧写入在生成 assistant 回复后一次性更新 JSON，因此中途失败可能丢失用户输入。

## New Model

`chat_sessions` 继续承担 Conversation，不为命名重建表；兼容增加 `ended_at,title,status,created_at,updated_at`。

新增 `messages`：

| Field | Contract |
| --- | --- |
| `id` | `msg_` 随机 ID；历史数据使用 conversation + sequence 的确定性哈希 ID |
| `conversation_id` | FK → `chat_sessions.id` |
| `user_id` | FK → `users.id`，所有读写同时校验 Conversation owner |
| `role` | user / assistant / system |
| `content` | 原消息，不进入日志或 migration warning |
| `sequence_no` | 会话内严格递增；`UNIQUE(conversation_id,sequence_no)` |
| `created_at` | 优先旧消息时间；缺失时使用 started_at + array index 毫秒 |
| `model` | 可空 Provider/model 来源 |
| `safety_level` | 可空 low/medium/high 路由结果 |
| `metadata_json` | type/draft 等最小兼容元数据，不允许密钥 |

索引为 `(conversation_id,sequence_no)` 和 `(user_id,created_at)`。

## Migration Strategy

迁移版本为 `20260908_phase2a_message_persistence`，由 `schema_migrations` 记录。启动和 `pnpm db:migrate` 都执行幂等 schema 检查与安全回填：

1. `BEGIN IMMEDIATE` 锁定写事务。
2. 只新增表、索引和 nullable/default 列，不删除或重命名旧结构。
3. 按 conversation ID、旧数组顺序扫描 JSON。
4. `sequence_no = index + 1`；历史 ID 由 conversation ID + sequence 确定。
5. `INSERT OR IGNORE` 后校验已有 role/content；冲突只报告 ID/sequence/error code。
6. malformed/non-array/invalid item 保留原 JSON、跳过转换并输出不含正文的 warning。
7. 成功后写 migration version 并提交；任一步失败则回滚整个事务。

## Read Strategy

统一在 `data-access.ts`：按 `conversation_id + user_id` 从 `messages` 读取并按 `sequence_no` 排序；若该 conversation 没有 Message rows，才解析 `chat_sessions.messages`。Fallback 不散落到 Route 或 Component。

## Write Strategy

统一通过 `startChatSession` 和 `appendChatMessages` 写入：

- `BEGIN IMMEDIATE` 内计算 `MAX(sequence_no)+1`，依靠唯一约束阻止顺序重复。
- 新 Message 立即取得服务端 ID。
- 用户 Message 在 Safety/LLM 前独立提交；assistant 失败不能回滚它。
- assistant 完成后单独追加。
- 过渡期同步刷新 legacy JSON，便于旧版本回退；没有第二套 Route 自行拼接。
- 显式重复 Message ID 返回同一内容，ID 与内容冲突则拒绝。

## Provenance

`emotion_records` 兼容增加 `source_conversation_id,source_message_id,extraction_version`。只有通过当前用户 Conversation/Message 所有权校验的用户 Message 才能成为来源；无法确认时 message ID 保持 null，不伪造。

Message 自身携带 `safety_level`，使未来 RiskEvent 可引用 source Message。`ai_memories` 增加 nullable source 字段，但本阶段不实现候选、检索或 UI。未来 LifeEvent schema 继续引用相同 Conversation/Message ID。

## Authorization and Privacy

所有 Message 查询、追加、来源绑定同时约束 `messages.user_id` 和 `chat_sessions.user_id`。API 对不存在及非本人 Conversation 返回相同的 404。日志和 warning 只包含 ID、sequence、event/error code，不包含聊天正文、Memory 或 Provider credential。

## Failure Handling

- DB insert failure：事务回滚；已在更早事务提交的 user Message 保留。
- assistant/provider failure：文字 Provider 既有 fallback 继续；意外失败也不删除 user Message。
- malformed legacy JSON：保留旧值、警告、跳过。
- partial/repeated migration：只补缺失 sequence，已有内容不重复。
- unauthorized/not found：拒绝读写和 provenance 绑定。

## Rollback Strategy

应用回退到上一版本时仍可读取持续双写的 `chat_sessions.messages`。本迁移不 DROP 表/列、不改旧主键；回滚应用无需先删除 `messages`。在至少一个兼容版本周期和数据校验完成前，不停止 legacy JSON 更新。数据库文件仍应按部署策略先备份再升级。
