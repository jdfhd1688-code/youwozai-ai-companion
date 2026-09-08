# Phase 2 Recommendations：和小在聊聊 Conversation Engine

本文件是推荐架构，不代表功能已经实现。

## Recommended Flow

```text
User Message
↓
Safety Router
↓
Need / Intent Detection
↓
Context Builder
↓
Companion Policy
↓
LLM（可选 Provider）
↓
Response Validation
↓
Structured Extraction
↓
Memory Candidate
↓
Storage
```

Safety Router 必须先于普通生成；确定性 high 继续走 fixed Safety Workflow。LLM 不拥有下调 high、直接保存 Memory 或直接通知守护人的权限。

## Recommended Architecture

### Deterministic orchestration first

第一版不需要 Multi-Agent。使用一个可测试 orchestrator 串联 Safety、Intent、Context、Prompt、Validation、Extraction 和 Storage；每步都有输入输出类型、超时、fallback 和版本号。只有出现独立长任务、并行工具或不同权限域时再评估 Agent。

### Need / Intent Detection

先区分倾诉、继续讲述、明确求建议、记录请求、退出谈话和 Safety。初期可用规则 + 小型结构化模型；失败回到“倾听 + 最多一个追问”，不要默认给建议。

### Context Builder

固定预算顺序：不可截断的产品/Safety 边界 → 最近 Message → 用户确认的 active Memory → 最近确认记录 → 未来 LifeEvent/LifeEpisode。每段上下文带来源 ID 并按 user_id 查询；超预算先删最旧低优先内容，Safety instruction 永不截断。

### JSON Schema and validation

- 自然回复与后台结构化提取分开。
- 使用共享运行时 JSON Schema 校验 intent、draft 和 Memory Candidate。
- 校验失败只有限重试，然后 deterministic fallback。
- Validator 检查诊断语言、排他依赖、建议数量和来源幻觉；High Risk 不经过普通生成。

### Model fallback

- LLM 不可用：当前本地陪伴和草稿继续工作。
- Structured extraction 失败：不自动保存候选。
- TTS 失败：文字保留，浏览器 fallback。
- 各步骤独立超时，Audio 解锁不延迟文字或 Safety。

### Message persistence foundation

按 `DATA_MODEL_EVOLUTION.md` 引入 migration：新增 messages、回填旧 JSON、校验、短期双读/双写，不删除 `chat_sessions.messages`。Message ID 是 Emotion、Memory、Risk 和 LifeEvent provenance 的基础。

### Memory retrieval

只检索用户确认、active、类型匹配且未删除的 Memory。先用 SQLite 普通查询，不上 Vector DB。Memory 使用可查看、禁用、删除，并记录 last_used_at。

### Prompt versioning, evaluation, observability

Safety、Intent、Companion、Extraction 和 Memory Candidate 分别版本化。以 `CONVERSATION_EVAL_PLAN.md` 为门禁；High Risk、Consent、跨用户隔离和 Dependency Boundary 任一失败即阻断。只记录匿名 operation ID、版本、latency、fallback、schema result 和 error code，不记录正文、Memory、音频或密钥。

## Suggested Delivery Slices

1. Foundation：server-side risk invariant、发送二次核权、migration runner、messages 与回填测试。
2. Conversation v1：Intent、Context Builder、Companion Policy、Prompt versioning。
3. Memory Candidate v1：候选、来源、用户确认、隐藏/删除、检索。
4. Evaluation/Observability：固定 eval runner、E2E、匿名指标。

Phase 2 不实现 LifeEpisode Agent、完整 RAG、Vector Database、Multi-Agent 或 Weekly Letter 重写。
