# Memory Model Plan

## Current State

`ai_memories` 当前只有 `id,user_id,content,category,visible,created_at,updated_at`。隐私中心支持新增、修改、隐藏和删除，但聊天 Prompt 不读取它，因此它是“用户可管理的记忆资料”，不是已经生效的长期记忆系统。

## Memory Types

| Type | Meaning | Example boundary |
| --- | --- | --- |
| semantic | 稳定事实 | “我在上海工作”；不保存未经确认的推测 |
| episodic | 某次经历的记忆 | 应优先链接 LifeEvent，不等于完整聊天复制 |
| preference | 普通偏好 | “我喜欢散步” |
| person | 重要人物及关系 | “姐姐经常陪我”；不是自动联系人 |
| goal | 用户表达的目标 | “想换工作”；允许随时失效或删除 |
| concern | 持续担心的主题 | 用用户语言，不做诊断 |
| interaction_preference | 希望小在如何回应 | “先听我说完，不急着建议” |

## Required Controls

```text
Message
→ Memory Candidate（不进入长期上下文）
→ 展示来源和建议类型
→ 用户确认 / 修改 / 拒绝
→ Active Memory
→ 可查看 / 修改 / 禁用 / 删除
→ 使用时记录 last_used_at 与来源 ID
```

- Source：`source_message_id`、`source_conversation_id`，手动创建时标记 `source=user_manual`。
- Confidence：只用于候选排序，不能让低置信度内容自动成为事实。
- User confirmation：模型提取默认 `candidate`，用户确认后才 `active`。
- Edit：修改生成新 `updated_at`，保留必要审计但不保存敏感正文副本。
- Delete：从检索立即排除；删除策略需定义来源解除和删除证明。
- Disable：保留内容但 Context Builder 不可读取。
- Provenance：回复使用 Memory 时能够解释参考了哪条用户确认记忆。

## Phase 2 Must Have

- `type`、`source_message_id`、`source_conversation_id`。
- `user_confirmed` 或等价状态机。
- `status = candidate|active|disabled|rejected|deleted`。
- `confidence`、`last_used_at`、`created_at`、`updated_at`。
- 只检索 `active + user_confirmed`，并强制 user scope。
- 候选、确认、隐藏、删除和跨用户隔离测试。

## Can Be Later

- Embedding/vector index。
- 自动聚类、长期衰减、冲突合并。
- Episodic Memory 与 LifeEpisode 自动聚合。
- Memory importance 学习和跨设备同步优化。

## Compatibility

- `category` 暂时映射到 `type`；未知分类映射 semantic 或保留原值，不能静默丢失。
- `visible=true` 的旧手动 Memory 可迁移为 `active + user_confirmed=true + source=user_manual`。
- `visible=false` 映射为 disabled。
- 本轮只完成设计，不修改 `ai_memories` schema，也不声称 Memory 已进入回复。
