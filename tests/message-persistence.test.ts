import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

process.env.DATABASE_PATH = path.join(os.tmpdir(), `ywz-message-${crypto.randomUUID()}.db`);

const dbModule = await import("../src/lib/db");
const data = await import("../src/lib/data-access");

function rawUser(database: DatabaseSync, id = `usr_${crypto.randomUUID()}`) {
  const now = new Date().toISOString();
  database.prepare(`
    INSERT INTO users (id, email, password_hash, nickname, timezone, created_at, updated_at)
    VALUES (?, ?, 'salt:hash', '迁移测试', 'Asia/Shanghai', ?, ?)
  `).run(id, `${id}@test.local`, now, now);
  return id;
}

function rawConversation(database: DatabaseSync, userId: string, messages: string, id = `chs_${crypto.randomUUID()}`) {
  const now = new Date("2026-01-01T00:00:00.000Z").toISOString();
  database.prepare(`
    INSERT INTO chat_sessions (id, user_id, started_at, messages, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'active', ?, ?)
  `).run(id, userId, now, messages, now, now);
  return id;
}

test("fresh database migration creates conversation and message schema", () => {
  const database = new DatabaseSync(":memory:");
  const report = dbModule.migrate(database);
  const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
  assert.ok(tables.some((row) => row.name === "messages"));
  assert.ok(tables.some((row) => row.name === "schema_migrations"));
  const columns = database.prepare("PRAGMA table_info(messages)").all() as Array<{ name: string }>;
  assert.ok(["id", "conversation_id", "user_id", "role", "content", "sequence_no", "created_at"].every(
    (name) => columns.some((column) => column.name === name)
  ));
  assert.equal(report.applied, true);
  database.close();
});

test("legacy JSON migrates with stable ordering and deterministic IDs", () => {
  const database = new DatabaseSync(":memory:");
  dbModule.migrate(database);
  const userId = rawUser(database);
  const conversationId = rawConversation(database, userId, JSON.stringify([
    { role: "xiaozai", content: "你好", createdAt: "2026-01-01T00:00:00.000Z" },
    { role: "user", content: "今天有点累" },
  ]));
  const first = dbModule.migratePhase2A(database);
  const rows = database.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY sequence_no").all(conversationId) as any[];
  assert.equal(first.migratedRows, 2);
  assert.deepEqual(rows.map((row) => row.sequence_no), [1, 2]);
  assert.deepEqual(rows.map((row) => row.role), ["assistant", "user"]);
  assert.ok(rows.every((row) => row.id.startsWith("msg_legacy_")));
  database.close();
});

test("repeated migration is idempotent and keeps message IDs", () => {
  const database = new DatabaseSync(":memory:");
  dbModule.migrate(database);
  const userId = rawUser(database);
  const conversationId = rawConversation(database, userId, JSON.stringify([{ role: "user", content: "重复测试" }]));
  dbModule.migratePhase2A(database);
  const before = database.prepare("SELECT id FROM messages WHERE conversation_id = ?").get(conversationId) as { id: string };
  const repeated = dbModule.migratePhase2A(database);
  const after = database.prepare("SELECT id FROM messages WHERE conversation_id = ?").get(conversationId) as { id: string };
  assert.equal(repeated.migratedRows, 0);
  assert.equal(after.id, before.id);
  database.close();
});

test("malformed legacy JSON is retained and reported without conversion", () => {
  const database = new DatabaseSync(":memory:");
  dbModule.migrate(database);
  const userId = rawUser(database);
  const conversationId = rawConversation(database, userId, "{not-json");
  const report = dbModule.migratePhase2A(database);
  const legacy = database.prepare("SELECT messages FROM chat_sessions WHERE id = ?").get(conversationId) as { messages: string };
  const count = database.prepare("SELECT COUNT(*) AS count FROM messages WHERE conversation_id = ?").get(conversationId) as { count: number };
  assert.equal(legacy.messages, "{not-json");
  assert.equal(Number(count.count), 0);
  assert.ok(report.warnings.some((warning) => warning.includes("malformed_legacy_json")));
  database.close();
});

test("partial migration fills only missing sequence and prevents duplicates", () => {
  const database = new DatabaseSync(":memory:");
  dbModule.migrate(database);
  const userId = rawUser(database);
  const conversationId = rawConversation(database, userId, JSON.stringify([
    { role: "user", content: "第一句" },
    { role: "xiaozai", content: "第二句" },
  ]));
  dbModule.migratePhase2A(database);
  database.prepare("DELETE FROM messages WHERE conversation_id = ? AND sequence_no = 2").run(conversationId);
  const report = dbModule.migratePhase2A(database);
  const rows = database.prepare("SELECT sequence_no FROM messages WHERE conversation_id = ? ORDER BY sequence_no").all(conversationId) as any[];
  assert.equal(report.migratedRows, 1);
  assert.deepEqual(rows.map((row) => row.sequence_no), [1, 2]);
  database.close();
});

test("migration does not remove existing users, conversations, or emotion records", () => {
  const database = new DatabaseSync(":memory:");
  dbModule.migrate(database);
  const userId = rawUser(database);
  const conversationId = rawConversation(database, userId, "[]");
  database.prepare(`
    INSERT INTO emotion_records
    (id, user_id, emotion_labels, intensity, trigger, summary, risk_level, created_at)
    VALUES ('emo_keep', ?, '["平静"]', 4, '测试', '保留', 'low', ?)
  `).run(userId, new Date().toISOString());
  database.prepare(`
    INSERT INTO weekly_letters
    (id, user_id, period_start, period_end, summary_text, insight_text, next_week_promise, chart_data, created_at)
    VALUES ('let_keep', ?, '2026-01-01', '2026-01-07', '摘要', '洞察', '约定', '{}', ?)
  `).run(userId, new Date().toISOString());
  database.prepare(`
    INSERT INTO guardians (id, owner_user_id, display_name, relationship, status, created_at)
    VALUES ('gua_keep', ?, '姐姐', '家人', 'active', ?)
  `).run(userId, new Date().toISOString());
  database.prepare(`
    INSERT INTO ai_memories (id, user_id, content, category, visible, created_at, updated_at)
    VALUES ('mem_keep', ?, '用户手动保存的偏好', 'preference', 1, ?, ?)
  `).run(userId, new Date().toISOString(), new Date().toISOString());
  dbModule.migratePhase2A(database);
  assert.ok(database.prepare("SELECT id FROM users WHERE id = ?").get(userId));
  assert.ok(database.prepare("SELECT id FROM chat_sessions WHERE id = ?").get(conversationId));
  assert.ok(database.prepare("SELECT id FROM emotion_records WHERE id = 'emo_keep'").get());
  assert.ok(database.prepare("SELECT id FROM weekly_letters WHERE id = 'let_keep'").get());
  assert.ok(database.prepare("SELECT id FROM guardians WHERE id = 'gua_keep'").get());
  assert.ok(database.prepare("SELECT id FROM ai_memories WHERE id = 'mem_keep'").get());
  database.close();
});

test("conversation creates persistent opening, user, and assistant messages in order", () => {
  const user = data.createUser({ email: `conversation-${crypto.randomUUID()}@test.local`, password: "password123", nickname: "会话用户" });
  const conversation = data.startChatSession(user.id, "我在这里");
  const afterUser = data.appendChatMessages(user.id, conversation.id, [{ role: "user", content: "今天有点累", createdAt: new Date().toISOString(), type: "chat" }]);
  const afterAssistant = data.appendChatMessages(user.id, conversation.id, [{ role: "xiaozai", content: "听起来今天消耗了你很多力气。", createdAt: new Date().toISOString(), type: "chat" }]);
  assert.deepEqual(afterAssistant.messages.map((message) => message.sequenceNo), [1, 2, 3]);
  assert.deepEqual(afterAssistant.messages.map((message) => message.role), ["xiaozai", "user", "xiaozai"]);
  assert.equal(new Set(afterAssistant.messages.map((message) => message.id)).size, 3);
  assert.equal(afterUser.messages[1].id, data.getChatSession(user.id, conversation.id)?.messages[1].id);
});

test("explicit message ID prevents duplicate insertion", () => {
  const user = data.createUser({ email: `duplicate-${crypto.randomUUID()}@test.local`, password: "password123", nickname: "重复测试" });
  const conversation = data.startChatSession(user.id, "你好");
  const id = `msg_${crypto.randomUUID().replaceAll("-", "")}`;
  data.appendChatMessages(user.id, conversation.id, [{ id, role: "user", content: "只保存一次", createdAt: new Date().toISOString() }]);
  data.appendChatMessages(user.id, conversation.id, [{ id, role: "user", content: "只保存一次", createdAt: new Date().toISOString() }]);
  const messages = data.getChatSession(user.id, conversation.id)!.messages.filter((message) => message.id === id);
  assert.equal(messages.length, 1);
});

test("conversation access is isolated by owner", () => {
  const owner = data.createUser({ email: `owner-${crypto.randomUUID()}@test.local`, password: "password123", nickname: "所有者" });
  const other = data.createUser({ email: `other-${crypto.randomUUID()}@test.local`, password: "password123", nickname: "其他用户" });
  const conversation = data.startChatSession(owner.id, "私密开场");
  assert.equal(data.getChatSession(other.id, conversation.id), null);
  assert.equal(data.getChatMessage(other.id, conversation.id, conversation.messages[0].id), null);
  assert.throws(() => data.appendChatMessages(other.id, conversation.id, [{ role: "user", content: "越权", createdAt: new Date().toISOString() }]), /无权访问/);
});

test("assistant generation failure leaves the user message persisted", () => {
  const user = data.createUser({ email: `failure-${crypto.randomUUID()}@test.local`, password: "password123", nickname: "失败测试" });
  const conversation = data.startChatSession(user.id, "我在");
  const afterUser = data.appendChatMessages(user.id, conversation.id, [{ role: "user", content: "请保留这句话", createdAt: new Date().toISOString() }]);
  assert.throws(() => { throw new Error("provider unavailable"); }, /provider unavailable/);
  const reloaded = data.getChatSession(user.id, conversation.id)!;
  assert.equal(reloaded.messages.length, afterUser.messages.length);
  assert.equal(reloaded.messages.at(-1)?.content, "请保留这句话");
  assert.equal(reloaded.messages.at(-1)?.role, "user");
});

test("legacy fallback remains available when message rows are absent", () => {
  const user = data.createUser({ email: `fallback-${crypto.randomUUID()}@test.local`, password: "password123", nickname: "兼容测试" });
  const database = dbModule.getDb();
  const conversationId = `chs_${crypto.randomUUID().replaceAll("-", "")}`;
  const legacy = JSON.stringify([{ role: "user", content: "只在旧 JSON 里", createdAt: "2026-01-01T00:00:00.000Z" }]);
  const now = new Date().toISOString();
  database.prepare(`
    INSERT INTO chat_sessions (id, user_id, started_at, messages, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'active', ?, ?)
  `).run(conversationId, user.id, now, legacy, now, now);
  const loaded = data.getChatSession(user.id, conversationId)!;
  assert.equal(loaded.messages[0].content, "只在旧 JSON 里");
  assert.match(loaded.messages[0].id, /^legacy-fallback-/);
});

test("emotion record stores message provenance only when supplied", () => {
  const user = data.createUser({ email: `provenance-${crypto.randomUUID()}@test.local`, password: "password123", nickname: "来源测试" });
  const conversation = data.startChatSession(user.id, "我在");
  const userMessage = data.appendChatMessages(user.id, conversation.id, [{ role: "user", content: "今天很委屈", createdAt: new Date().toISOString() }]).messages.at(-1)!;
  const record = data.insertEmotionRecord({
    userId: user.id,
    emotionLabels: ["委屈"],
    intensity: 7,
    trigger: "方案被改",
    thought: "",
    response: "",
    summary: "今天很委屈",
    riskLevel: "low",
    sourceConversationId: conversation.id,
    sourceMessageId: userMessage.id,
    extractionVersion: "emotion-v1",
  });
  assert.equal(record.sourceConversationId, conversation.id);
  assert.equal(record.sourceMessageId, userMessage.id);
  assert.equal(record.extractionVersion, "emotion-v1");
});
