import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type RiskLevel = "low" | "medium" | "high";

export const RISK_LABEL: Record<RiskLevel, string> = {
  low: "较低",
  medium: "中",
  high: "较高",
};

const dbDir = path.join(process.cwd(), "data");
fs.mkdirSync(dbDir, { recursive: true });

const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
  : path.join(dbDir, "youwozai.db");

let db: DatabaseSync | null = null;

export type MigrationReport = {
  version: string;
  applied: boolean;
  migratedRows: number;
  skippedRows: number;
  warnings: string[];
};

const PHASE2A_MIGRATION = "20260908_phase2a_message_persistence";
let lastMigrationReport: MigrationReport | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  lastMigrationReport = migrate(db);
  return db;
}

export function getLastMigrationReport(): MigrationReport | null {
  return lastMigrationReport;
}

export function migrate(database: DatabaseSync): MigrationReport {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nickname TEXT NOT NULL,
      avatar_url TEXT,
      age_band TEXT,
      timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS emotion_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emotion_labels TEXT NOT NULL,
      intensity INTEGER NOT NULL,
      trigger TEXT NOT NULL,
      thought TEXT,
      response TEXT,
      summary TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      raw_conversation_ref TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weekly_letters (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      summary_text TEXT NOT NULL,
      insight_text TEXT NOT NULL,
      next_week_promise TEXT NOT NULL,
      chart_data TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS guardians (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      guardian_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      display_name TEXT NOT NULL,
      relationship TEXT NOT NULL,
      contact_hint TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS guardian_permissions (
      id TEXT PRIMARY KEY,
      guardian_id TEXT NOT NULL UNIQUE REFERENCES guardians(id) ON DELETE CASCADE,
      notify_on_high_risk INTEGER NOT NULL DEFAULT 0,
      share_need_support INTEGER NOT NULL DEFAULT 1,
      share_risk_level INTEGER NOT NULL DEFAULT 0,
      share_emotion_labels INTEGER NOT NULL DEFAULT 0,
      share_trend INTEGER NOT NULL DEFAULT 0,
      share_stressor INTEGER NOT NULL DEFAULT 0,
      personal_message TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      guardian_id TEXT REFERENCES guardians(id) ON DELETE SET NULL,
      trigger_type TEXT NOT NULL,
      shared_fields TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      cancelled_at TEXT,
      sent_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_memories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'preference',
      visible INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      setting_key TEXT NOT NULL,
      setting_value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, setting_key)
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      started_at TEXT NOT NULL,
      messages TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  return migratePhase2A(database);
}

function hasColumn(database: DatabaseSync, table: string, column: string): boolean {
  const rows = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

function addColumn(database: DatabaseSync, table: string, definition: string, column: string): void {
  if (!hasColumn(database, table, column)) database.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

function legacyMessageId(conversationId: string, sequenceNo: number): string {
  const digest = crypto.createHash("sha256").update(`${conversationId}:${sequenceNo}`).digest("hex").slice(0, 24);
  return `msg_legacy_${digest}`;
}

function legacyCreatedAt(startedAt: string, value: unknown, index: number): string {
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  const base = Number.isNaN(Date.parse(startedAt)) ? 0 : Date.parse(startedAt);
  return new Date(base + index).toISOString();
}

export function migratePhase2A(database: DatabaseSync): MigrationReport {
  const report: MigrationReport = {
    version: PHASE2A_MIGRATION,
    applied: false,
    migratedRows: 0,
    skippedRows: 0,
    warnings: [],
  };

  database.exec("BEGIN IMMEDIATE");
  try {
    addColumn(database, "chat_sessions", "ended_at TEXT", "ended_at");
    addColumn(database, "chat_sessions", "title TEXT", "title");
    addColumn(database, "chat_sessions", "status TEXT NOT NULL DEFAULT 'active'", "status");
    addColumn(database, "chat_sessions", "created_at TEXT", "created_at");
    addColumn(database, "chat_sessions", "updated_at TEXT", "updated_at");
    addColumn(database, "emotion_records", "source_conversation_id TEXT", "source_conversation_id");
    addColumn(database, "emotion_records", "source_message_id TEXT", "source_message_id");
    addColumn(database, "emotion_records", "extraction_version TEXT", "extraction_version");
    addColumn(database, "ai_memories", "source_conversation_id TEXT", "source_conversation_id");
    addColumn(database, "ai_memories", "source_message_id TEXT", "source_message_id");

    database.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        sequence_no INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        model TEXT,
        safety_level TEXT CHECK (safety_level IS NULL OR safety_level IN ('low', 'medium', 'high')),
        metadata_json TEXT NOT NULL DEFAULT '{}',
        UNIQUE (conversation_id, sequence_no)
      );
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_sequence
        ON messages(conversation_id, sequence_no);
      CREATE INDEX IF NOT EXISTS idx_messages_user_created
        ON messages(user_id, created_at);
    `);

    const sessions = database.prepare(
      "SELECT id, user_id, started_at, messages FROM chat_sessions ORDER BY id"
    ).all() as Array<{ id: string; user_id: string; started_at: string; messages: string }>;
    const findExisting = database.prepare(
      "SELECT id, role, content FROM messages WHERE conversation_id = ? AND sequence_no = ?"
    );
    const insert = database.prepare(`
      INSERT OR IGNORE INTO messages
      (id, conversation_id, user_id, role, content, sequence_no, created_at, model, safety_level, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
    `);
    const updateConversation = database.prepare(`
      UPDATE chat_sessions
      SET created_at = COALESCE(created_at, started_at), updated_at = COALESCE(updated_at, started_at)
      WHERE id = ?
    `);

    for (const session of sessions) {
      updateConversation.run(session.id);
      let legacy: unknown;
      try {
        legacy = JSON.parse(session.messages || "[]");
      } catch {
        report.warnings.push(`conversation=${session.id} code=malformed_legacy_json`);
        report.skippedRows += 1;
        continue;
      }
      if (!Array.isArray(legacy)) {
        report.warnings.push(`conversation=${session.id} code=legacy_messages_not_array`);
        report.skippedRows += 1;
        continue;
      }
      for (let index = 0; index < legacy.length; index += 1) {
        const raw = legacy[index] as Record<string, unknown> | null;
        const sequenceNo = index + 1;
        if (!raw || typeof raw.content !== "string" || !["user", "xiaozai", "assistant", "system"].includes(String(raw.role))) {
          report.warnings.push(`conversation=${session.id} sequence=${sequenceNo} code=invalid_legacy_message`);
          report.skippedRows += 1;
          continue;
        }
        const role = raw.role === "xiaozai" ? "assistant" : String(raw.role);
        const metadata = JSON.stringify({
          legacy: true,
          type: typeof raw.type === "string" ? raw.type : "chat",
          draft: raw.draft && typeof raw.draft === "object" ? raw.draft : null,
        });
        const safetyLevel = raw.draft && typeof raw.draft === "object" && "riskLevel" in raw.draft
          ? String((raw.draft as Record<string, unknown>).riskLevel)
          : null;
        const normalizedSafety = ["low", "medium", "high"].includes(safetyLevel || "") ? safetyLevel : null;
        const result = insert.run(
          legacyMessageId(session.id, sequenceNo),
          session.id,
          session.user_id,
          role,
          raw.content,
          sequenceNo,
          legacyCreatedAt(session.started_at, raw.createdAt, index),
          normalizedSafety,
          metadata
        );
        if (result.changes > 0) {
          report.migratedRows += 1;
        } else {
          const existing = findExisting.get(session.id, sequenceNo) as { id: string; role: string; content: string } | undefined;
          if (!existing || existing.role !== role || existing.content !== raw.content) {
            report.warnings.push(`conversation=${session.id} sequence=${sequenceNo} code=legacy_conflict`);
            report.skippedRows += 1;
          }
        }
      }
    }

    const existingMigration = database.prepare("SELECT version FROM schema_migrations WHERE version = ?").get(PHASE2A_MIGRATION);
    if (!existingMigration) {
      database.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(PHASE2A_MIGRATION, nowIso());
      report.applied = true;
    }
    database.exec("COMMIT");
    return report;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
  } catch {
    return false;
  }
}
