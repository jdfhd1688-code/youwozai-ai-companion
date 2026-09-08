# Phase 2A Changelog

## Added

- Versioned `schema_migrations` and idempotent Phase 2A runner。
- Independent `messages` table, stable ID, sequence constraint and indexes。
- Message/Conversation API DTO fields and authenticated GET reload path。
- EmotionRecord source Conversation/Message and extraction version。
- Migration, ordering, duplicate, isolation, fallback, provenance and failure tests。
- 390×844 Phase 2A runtime verifier。

## Changed

- Chat writes the user Message before Safety/assistant generation, then appends assistant separately。
- Chat reloads the latest Conversation from server-side persisted Messages。
- UI replaces optimistic pending bubble with server Message IDs。
- Save-draft request carries the verified source user Message ID。
- Legacy JSON updates are centralized in the same persistence layer。

## Preserved

- `chat_sessions` table and `messages` JSON column/data。
- Existing Safety Router, deterministic High Risk override and three-action UI。
- Guardian consent and notification workflow。
- Weekly Letter core logic, IA, SQLite and TTS behavior。
- User confirmation before EmotionRecord save。

## Deferred

- Need/Intent, Companion Policy and new Persona Prompt。
- Memory Candidate UI/Retrieval, RAG and Vector DB。
- RiskEvent, LifeEvent/LifeEpisode and Weekly Insight changes。
- Multi-Agent and large UI redesign。
- Production multi-instance database, backup automation and observability。

## Risks

- Legacy JSON dual-write is intentionally temporary and increases write size。
- SQLite `BEGIN IMMEDIATE` serializes writers; sufficient for MVP, not a horizontally scaled deployment design。
- Provenance columns added through SQLite ALTER cannot gain full FK constraints without a later table rebuild; application ownership checks are enforced now。
- Real Provider failure/latency remains dependent on external credentials and quota。

## Verification

- `pnpm install`、`pnpm lint`、`pnpm typecheck`：PASS。
- `pnpm test`：PASS，48/48。
- `pnpm test:integration`：PASS，23/23。
- `pnpm build`：PASS，24 routes。
- `pnpm verify:ui`：PASS，6 pages、8 core GET APIs、0 console errors、0 failed requests。
- `pnpm verify:phase2a`：PASS，390×844、稳定 ID/sequence、刷新恢复、跨用户 404、Emotion provenance、High Risk persistence。
- `pnpm capture:phase2a`：PASS，7 张实际运行截图；截图临时账号完成后已删除。
