# Phase 2A Migration Report

日期：2026-09-08

## Migration

- Version：`20260908_phase2a_message_persistence`
- Strategy：read-new-first + legacy fallback；过渡期统一双写。
- Transaction：`BEGIN IMMEDIATE`，失败整体 rollback。

## Tables Changed

- Added：`schema_migrations`、`messages`。
- Extended：`chat_sessions` 增加 ended/title/status/created/updated。
- Extended：`emotion_records` 增加 source conversation/message 和 extraction version。
- Extended：`ai_memories` 增加 nullable source conversation/message，仅作未来 provenance 准备。
- Preserved：users、sessions、weekly_letters、guardians、guardian_permissions、notification_events、user_settings 及所有旧字段。

## Actual Existing Database Run

| Item | Result |
| --- | --- |
| Rows migrated | 69 |
| Rows skipped | 0 |
| Warnings | 0 |
| Legacy chat_sessions retained | Yes |
| Legacy messages JSON retained | Yes |

紧接着重复执行同一 migration：`applied=false,migratedRows=0,skippedRows=0,warnings=[]`，证明实际数据库上未产生重复数据。

## Automated Migration Matrix

- Empty database schema：PASS。
- Populated legacy JSON：PASS。
- Repeated migration：PASS。
- Malformed JSON retained + warning：PASS。
- Partially migrated conversation：PASS，只补缺失 sequence。
- Duplicate prevention/stable IDs：PASS。
- Existing user/conversation/emotion data retention：PASS。

## Compatibility

新版本优先查询独立 Message；某个 Conversation 没有 rows 时回退 legacy JSON。新写入同步更新两边。旧 JSON 暂不删除；若回退应用版本，旧读路径仍有完整消息。

## Warnings and Limits

本地实际数据库没有 malformed 或 conflict warning。自动化测试已覆盖这些场景。SQLite 单文件事务满足当前 MVP，但不代表多实例生产并发方案；部署前仍需备份、恢复演练和正式数据保留政策。
