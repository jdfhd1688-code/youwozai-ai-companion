import { getDb, newId, nowIso, hashPassword } from "./db";
import type { RiskLevel } from "./db";
import crypto from "node:crypto";

export type PublicUser = {
  id: string;
  email: string;
  nickname: string;
  avatarUrl: string | null;
  ageBand: string | null;
  timezone: string;
  createdAt: string;
};

export type EmotionRecordRow = {
  id: string;
  userId: string;
  emotionLabels: string[];
  intensity: number;
  trigger: string;
  thought: string;
  response: string;
  summary: string;
  riskLevel: RiskLevel;
  rawConversationRef: string | null;
  createdAt: string;
};

export type GuardianRow = {
  id: string;
  ownerUserId: string;
  guardianUserId: string | null;
  displayName: string;
  relationship: string;
  contactHint: string | null;
  status: string;
  createdAt: string;
  permissions: GuardianPermissions;
};

export type GuardianPermissions = {
  id: string;
  guardianId: string;
  notifyOnHighRisk: boolean;
  shareNeedSupport: boolean;
  shareRiskLevel: boolean;
  shareEmotionLabels: boolean;
  shareTrend: boolean;
  shareStressor: boolean;
  personalMessage: string;
  updatedAt: string;
};

export type NotificationEventRow = {
  id: string;
  userId: string;
  guardianId: string | null;
  guardianName: string;
  relationship: string;
  triggerType: string;
  sharedFields: SharedFields;
  status: "pending" | "sent" | "cancelled";
  cancelledAt: string | null;
  sentAt: string | null;
  createdAt: string;
};

export type SharedFields = {
  needSupport?: boolean;
  riskLevel?: string;
  emotionLabels?: string[];
  trend?: string;
  stressor?: string;
  personalMessage?: string;
  supportCard?: boolean;
};

export type AiMemoryRow = {
  id: string;
  userId: string;
  content: string;
  category: string;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WeeklyLetterRow = {
  id: string;
  userId: string;
  periodStart: string;
  periodEnd: string;
  summaryText: string;
  insightText: string;
  nextWeekPromise: string;
  chartData: string;
  createdAt: string;
};

export type ChatSessionRow = {
  id: string;
  userId: string;
  startedAt: string;
  messages: ChatMessage[];
};

export type ChatMessage = {
  role: "user" | "xiaozai";
  content: string;
  createdAt: string;
  type?: "chat" | "draft" | "safety" | "system";
  draft?: StructuredDraft | null;
};

export type StructuredDraft = {
  emotionLabels: string[];
  intensity: number;
  trigger: string;
  thought: string;
  response: string;
  summary: string;
  riskLevel: RiskLevel;
};

function mapUser(row: any): PublicUser {
  return {
    id: row.id,
    email: row.email,
    nickname: row.nickname,
    avatarUrl: row.avatar_url,
    ageBand: row.age_band,
    timezone: row.timezone,
    createdAt: row.created_at,
  };
}

function mapRecord(row: any): EmotionRecordRow {
  return {
    id: row.id,
    userId: row.user_id,
    emotionLabels: JSON.parse(row.emotion_labels || "[]"),
    intensity: Number(row.intensity),
    trigger: row.trigger,
    thought: row.thought || "",
    response: row.response || "",
    summary: row.summary,
    riskLevel: row.risk_level,
    rawConversationRef: row.raw_conversation_ref,
    createdAt: row.created_at,
  };
}

export function createUser(input: {
  email: string;
  password: string;
  nickname: string;
  avatarUrl?: string | null;
  ageBand?: string | null;
  timezone?: string;
}): PublicUser {
  const db = getDb();
  const id = newId("usr");
  const now = nowIso();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, nickname, avatar_url, age_band, timezone, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.email.toLowerCase().trim(),
    hashPassword(input.password),
    input.nickname.trim(),
    input.avatarUrl || null,
    input.ageBand || null,
    input.timezone || "Asia/Shanghai",
    now,
    now
  );
  return findUserByEmail(input.email)!;
}

export function findUserByEmail(email: string): PublicUser | null {
  const row = getDb()
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email.toLowerCase().trim()) as any;
  return row ? mapUser(row) : null;
}

export function findUserById(id: string): PublicUser | null {
  const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
  return row ? mapUser(row) : null;
}

export function verifyLogin(email: string, password: string): PublicUser | null {
  const row = getDb()
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email.toLowerCase().trim()) as any;
  if (!row) return null;
  const [salt, hash] = String(row.password_hash).split(":");
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  let ok = false;
  try {
    ok = crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
  } catch {
    ok = false;
  }
  return ok ? mapUser(row) : null;
}

export function updateUserProfile(
  userId: string,
  patch: { nickname?: string; avatarUrl?: string | null; ageBand?: string | null; timezone?: string }
): PublicUser {
  const db = getDb();
  const now = nowIso();
  db.prepare(
    `UPDATE users SET nickname = COALESCE(?, nickname), avatar_url = COALESCE(?, avatar_url),
     age_band = COALESCE(?, age_band), timezone = COALESCE(?, timezone), updated_at = ?
     WHERE id = ?`
  ).run(patch.nickname ?? null, patch.avatarUrl === undefined ? null : patch.avatarUrl, patch.ageBand ?? null, patch.timezone ?? null, now, userId);
  return findUserById(userId)!;
}

export function deleteUserAndData(userId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
}

export function createSession(userId: string, token: string): void {
  const db = getDb();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
  db.prepare("INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)").run(
    token,
    userId,
    expiresAt,
    nowIso()
  );
}

export function findUserBySessionToken(token: string): PublicUser | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`
    )
    .get(token, nowIso()) as any;
  return row ? mapUser(row) : null;
}

export function deleteSession(token: string): void {
  getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function insertEmotionRecord(input: {
  userId: string;
  emotionLabels: string[];
  intensity: number;
  trigger: string;
  thought: string;
  response: string;
  summary: string;
  riskLevel: RiskLevel;
  rawConversationRef?: string | null;
  createdAt?: string;
}): EmotionRecordRow {
  const db = getDb();
  const id = newId("emo");
  const createdAt = input.createdAt || nowIso();
  db.prepare(
    `INSERT INTO emotion_records
     (id, user_id, emotion_labels, intensity, trigger, thought, response, summary, risk_level, raw_conversation_ref, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.userId,
    JSON.stringify(input.emotionLabels),
    input.intensity,
    input.trigger,
    input.thought,
    input.response,
    input.summary,
    input.riskLevel,
    input.rawConversationRef || null,
    createdAt
  );
  return listEmotionRecords(input.userId).find((r) => r.id === id)!;
}

export function updateEmotionRecord(
  userId: string,
  recordId: string,
  input: {
    emotionLabels: string[];
    intensity: number;
    trigger: string;
    thought: string;
    response: string;
    summary: string;
    riskLevel: RiskLevel;
  }
): EmotionRecordRow | null {
  const db = getDb();
  const result = db
    .prepare(
      `UPDATE emotion_records SET emotion_labels = ?, intensity = ?, trigger = ?, thought = ?,
       response = ?, summary = ?, risk_level = ? WHERE id = ? AND user_id = ?`
    )
    .run(
      JSON.stringify(input.emotionLabels),
      input.intensity,
      input.trigger,
      input.thought,
      input.response,
      input.summary,
      input.riskLevel,
      recordId,
      userId
    );
  if (result.changes === 0) return null;
  return getEmotionRecord(userId, recordId);
}

export function getEmotionRecord(userId: string, recordId: string): EmotionRecordRow | null {
  const row = getDb()
    .prepare("SELECT * FROM emotion_records WHERE id = ? AND user_id = ?")
    .get(recordId, userId) as any;
  return row ? mapRecord(row) : null;
}

export function deleteEmotionRecord(userId: string, recordId: string): boolean {
  const result = getDb()
    .prepare("DELETE FROM emotion_records WHERE id = ? AND user_id = ?")
    .run(recordId, userId);
  return result.changes > 0;
}

export function listEmotionRecords(userId: string): EmotionRecordRow[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM emotion_records WHERE user_id = ? ORDER BY datetime(created_at) DESC, rowid DESC`
    )
    .all(userId) as any[];
  return rows.map(mapRecord);
}

export function listEmotionRecordsBetween(userId: string, startIso: string, endIso: string): EmotionRecordRow[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM emotion_records
       WHERE user_id = ? AND created_at >= ? AND created_at < ?
       ORDER BY datetime(created_at) ASC`
    )
    .all(userId, startIso, endIso) as any[];
  return rows.map(mapRecord);
}

export function insertWeeklyLetter(input: {
  userId: string;
  periodStart: string;
  periodEnd: string;
  summaryText: string;
  insightText: string;
  nextWeekPromise: string;
  chartData: unknown;
  createdAt?: string;
}): WeeklyLetterRow {
  const db = getDb();
  const id = newId("let");
  const createdAt = input.createdAt || nowIso();
  db.prepare(
    `INSERT INTO weekly_letters
     (id, user_id, period_start, period_end, summary_text, insight_text, next_week_promise, chart_data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.userId,
    input.periodStart,
    input.periodEnd,
    input.summaryText,
    input.insightText,
    input.nextWeekPromise,
    JSON.stringify(input.chartData),
    createdAt
  );
  return listWeeklyLetters(input.userId).find((l) => l.id === id)!;
}

export function listWeeklyLetters(userId: string): WeeklyLetterRow[] {
  const rows = getDb()
    .prepare("SELECT * FROM weekly_letters WHERE user_id = ? ORDER BY datetime(created_at) DESC")
    .all(userId) as any[];
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    summaryText: row.summary_text,
    insightText: row.insight_text,
    nextWeekPromise: row.next_week_promise,
    chartData: row.chart_data,
    createdAt: row.created_at,
  }));
}

export function insertGuardian(input: {
  ownerUserId: string;
  guardianUserId?: string | null;
  displayName: string;
  relationship: string;
  contactHint?: string | null;
  status?: string;
  permissions?: Partial<GuardianPermissions>;
}): GuardianRow {
  const db = getDb();
  const id = newId("gua");
  const createdAt = nowIso();
  db.prepare(
    `INSERT INTO guardians (id, owner_user_id, guardian_user_id, display_name, relationship, contact_hint, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.ownerUserId, input.guardianUserId || null, input.displayName, input.relationship, input.contactHint || null, input.status || "active", createdAt);
  const permissionId = newId("per");
  const now = nowIso();
  db.prepare(
    `INSERT INTO guardian_permissions
     (id, guardian_id, notify_on_high_risk, share_need_support, share_risk_level, share_emotion_labels,
      share_trend, share_stressor, personal_message, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    permissionId,
    id,
    input.permissions?.notifyOnHighRisk ? 1 : 0,
    input.permissions?.shareNeedSupport === false ? 0 : 1,
    input.permissions?.shareRiskLevel ? 1 : 0,
    input.permissions?.shareEmotionLabels ? 1 : 0,
    input.permissions?.shareTrend ? 1 : 0,
    input.permissions?.shareStressor ? 1 : 0,
    input.permissions?.personalMessage || "",
    now
  );
  return getGuardian(input.ownerUserId, id)!;
}

export function listGuardians(userId: string): GuardianRow[] {
  const rows = getDb()
    .prepare(
      `SELECT g.*, p.id AS perm_id, p.notify_on_high_risk, p.share_need_support, p.share_risk_level,
              p.share_emotion_labels, p.share_trend, p.share_stressor, p.personal_message, p.updated_at
       FROM guardians g
       LEFT JOIN guardian_permissions p ON p.guardian_id = g.id
       WHERE g.owner_user_id = ?
       ORDER BY datetime(g.created_at) DESC`
    )
    .all(userId) as any[];
  return rows.map(mapGuardian);
}

export function getGuardian(ownerUserId: string, guardianId: string): GuardianRow | null {
  const row = getDb()
    .prepare(
      `SELECT g.*, p.id AS perm_id, p.notify_on_high_risk, p.share_need_support, p.share_risk_level,
              p.share_emotion_labels, p.share_trend, p.share_stressor, p.personal_message, p.updated_at
       FROM guardians g
       LEFT JOIN guardian_permissions p ON p.guardian_id = g.id
       WHERE g.owner_user_id = ? AND g.id = ?`
    )
    .get(ownerUserId, guardianId) as any;
  return row ? mapGuardian(row) : null;
}

export function updateGuardianPermissions(
  ownerUserId: string,
  guardianId: string,
  patch: Partial<GuardianPermissions>
): GuardianRow | null {
  const db = getDb();
  const existing = getGuardian(ownerUserId, guardianId);
  if (!existing) return null;
  const p = {
    notifyOnHighRisk: patch.notifyOnHighRisk ?? existing.permissions.notifyOnHighRisk,
    shareNeedSupport: patch.shareNeedSupport ?? existing.permissions.shareNeedSupport,
    shareRiskLevel: patch.shareRiskLevel ?? existing.permissions.shareRiskLevel,
    shareEmotionLabels: patch.shareEmotionLabels ?? existing.permissions.shareEmotionLabels,
    shareTrend: patch.shareTrend ?? existing.permissions.shareTrend,
    shareStressor: patch.shareStressor ?? existing.permissions.shareStressor,
    personalMessage: patch.personalMessage ?? existing.permissions.personalMessage,
  };
  db.prepare(
    `UPDATE guardian_permissions SET notify_on_high_risk = ?, share_need_support = ?, share_risk_level = ?,
     share_emotion_labels = ?, share_trend = ?, share_stressor = ?, personal_message = ?, updated_at = ?
     WHERE guardian_id = ?`
  ).run(
    p.notifyOnHighRisk ? 1 : 0,
    p.shareNeedSupport ? 1 : 0,
    p.shareRiskLevel ? 1 : 0,
    p.shareEmotionLabels ? 1 : 0,
    p.shareTrend ? 1 : 0,
    p.shareStressor ? 1 : 0,
    p.personalMessage,
    nowIso(),
    guardianId
  );
  return getGuardian(ownerUserId, guardianId);
}

export function deleteGuardian(ownerUserId: string, guardianId: string): boolean {
  const result = getDb()
    .prepare("DELETE FROM guardians WHERE id = ? AND owner_user_id = ?")
    .run(guardianId, ownerUserId);
  return result.changes > 0;
}

function mapGuardian(row: any): GuardianRow {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    guardianUserId: row.guardian_user_id || null,
    displayName: row.display_name,
    relationship: row.relationship,
    contactHint: row.contact_hint || null,
    status: row.status,
    createdAt: row.created_at,
    permissions: {
      id: row.perm_id || row.id,
      guardianId: row.id,
      notifyOnHighRisk: Boolean(Number(row.notify_on_high_risk)),
      shareNeedSupport: row.share_need_support === null ? true : Boolean(Number(row.share_need_support)),
      shareRiskLevel: Boolean(Number(row.share_risk_level)),
      shareEmotionLabels: Boolean(Number(row.share_emotion_labels)),
      shareTrend: Boolean(Number(row.share_trend)),
      shareStressor: Boolean(Number(row.share_stressor)),
      personalMessage: row.personal_message || "",
      updatedAt: row.updated_at,
    },
  };
}

export function insertNotificationEvent(input: {
  userId: string;
  guardianId: string | null;
  triggerType: string;
  sharedFields: SharedFields;
  status?: "pending" | "sent" | "cancelled";
  sentAt?: string | null;
  cancelledAt?: string | null;
  createdAt?: string;
}): NotificationEventRow {
  const db = getDb();
  const id = newId("ntf");
  db.prepare(
    `INSERT INTO notification_events
     (id, user_id, guardian_id, trigger_type, shared_fields, status, cancelled_at, sent_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.userId,
    input.guardianId,
    input.triggerType,
    JSON.stringify(input.sharedFields),
    input.status || "pending",
    input.cancelledAt || null,
    input.sentAt || null,
    input.createdAt || nowIso()
  );
  return listNotificationEvents(input.userId).find((n) => n.id === id)!;
}

export function listNotificationEvents(userId: string): NotificationEventRow[] {
  const rows = getDb()
    .prepare(
      `SELECT n.*, g.display_name AS guardian_name, g.relationship AS relationship
       FROM notification_events n
       LEFT JOIN guardians g ON g.id = n.guardian_id
       WHERE n.user_id = ?
       ORDER BY datetime(n.created_at) DESC, n.rowid DESC`
    )
    .all(userId) as any[];
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    guardianId: row.guardian_id,
    guardianName: row.guardian_name || "已移除的守护人",
    relationship: row.relationship || "",
    triggerType: row.trigger_type,
    sharedFields: JSON.parse(row.shared_fields || "{}"),
    status: row.status,
    cancelledAt: row.cancelled_at,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  }));
}

export function updateNotificationEventStatus(
  userId: string,
  eventId: string,
  status: "pending" | "sent" | "cancelled"
): NotificationEventRow | null {
  const db = getDb();
  const now = nowIso();
  if (status === "cancelled") {
    db.prepare(
      `UPDATE notification_events SET status = 'cancelled', cancelled_at = ?, sent_at = NULL
       WHERE id = ? AND user_id = ?`
    ).run(now, eventId, userId);
  } else if (status === "sent") {
    db.prepare(
      `UPDATE notification_events SET status = 'sent', sent_at = ?, cancelled_at = NULL
       WHERE id = ? AND user_id = ? AND status = 'pending'`
    ).run(now, eventId, userId);
  }
  const row = listNotificationEvents(userId).find((n) => n.id === eventId);
  return row || null;
}

export function listAiMemories(userId: string): AiMemoryRow[] {
  const rows = getDb()
    .prepare("SELECT * FROM ai_memories WHERE user_id = ? ORDER BY datetime(created_at) DESC")
    .all(userId) as any[];
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    content: row.content,
    category: row.category,
    visible: Boolean(Number(row.visible)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function addAiMemory(userId: string, content: string, category = "preference"): AiMemoryRow {
  const db = getDb();
  const id = newId("mem");
  const now = nowIso();
  db.prepare(
    "INSERT INTO ai_memories (id, user_id, content, category, visible, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)"
  ).run(id, userId, content, category, now, now);
  return listAiMemories(userId).find((m) => m.id === id)!;
}

export function updateAiMemory(
  userId: string,
  memoryId: string,
  patch: { content?: string; visible?: boolean }
): AiMemoryRow | null {
  const db = getDb();
  const existing = listAiMemories(userId).find((m) => m.id === memoryId);
  if (!existing) return null;
  db.prepare("UPDATE ai_memories SET content = ?, visible = ?, updated_at = ? WHERE id = ? AND user_id = ?").run(
    patch.content ?? existing.content,
    patch.visible === undefined ? (existing.visible ? 1 : 0) : patch.visible ? 1 : 0,
    nowIso(),
    memoryId,
    userId
  );
  return listAiMemories(userId).find((m) => m.id === memoryId) || null;
}

export function deleteAiMemory(userId: string, memoryId: string): boolean {
  const result = getDb().prepare("DELETE FROM ai_memories WHERE id = ? AND user_id = ?").run(memoryId, userId);
  return result.changes > 0;
}

export function getUserSetting(userId: string, key: string): string | null {
  const row = getDb()
    .prepare("SELECT setting_value FROM user_settings WHERE user_id = ? AND setting_key = ?")
    .get(userId, key) as any;
  return row ? String(row.setting_value) : null;
}

export function setUserSetting(userId: string, key: string, value: string): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO user_settings (user_id, setting_key, setting_value, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at`
  ).run(userId, key, value, nowIso());
}

export function startChatSession(userId: string, opening: string): ChatSessionRow {
  const db = getDb();
  const id = newId("chs");
  const startedAt = nowIso();
  const messages: ChatMessage[] = [
    {
      role: "xiaozai",
      content: opening,
      createdAt: startedAt,
      type: "chat",
    },
  ];
  db.prepare("INSERT INTO chat_sessions (id, user_id, started_at, messages) VALUES (?, ?, ?, ?)").run(
    id,
    userId,
    startedAt,
    JSON.stringify(messages)
  );
  return getChatSession(userId, id)!;
}

export function getChatSession(userId: string, sessionId: string): ChatSessionRow | null {
  const row = getDb()
    .prepare("SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?")
    .get(sessionId, userId) as any;
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    startedAt: row.started_at,
    messages: JSON.parse(row.messages || "[]"),
  };
}

export function appendChatMessages(
  userId: string,
  sessionId: string,
  newMessages: ChatMessage[]
): ChatSessionRow {
  const session = getChatSession(userId, sessionId);
  if (!session) throw new Error("会话不存在");
  getDb()
    .prepare("UPDATE chat_sessions SET messages = ? WHERE id = ? AND user_id = ?")
    .run(JSON.stringify([...session.messages, ...newMessages]), sessionId, userId);
  return getChatSession(userId, sessionId)!;
}

export function listChatSessions(userId: string, limit = 30): ChatSessionRow[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY datetime(started_at) DESC LIMIT ?`
    )
    .all(userId, limit) as any[];
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    startedAt: row.started_at,
    messages: JSON.parse(row.messages || "[]"),
  }));
}

export function countsForUser(userId: string): { recordCount: number; chatCount: number; guardCount: number } {
  const db = getDb();
  const recordCount = (
    db.prepare("SELECT COUNT(*) AS c FROM emotion_records WHERE user_id = ?").get(userId) as any
  ).c;
  const chatCount = (db.prepare("SELECT COUNT(*) AS c FROM chat_sessions WHERE user_id = ?").get(userId) as any).c;
  const guardCount = (db.prepare("SELECT COUNT(*) AS c FROM guardians WHERE owner_user_id = ?").get(userId) as any).c;
  return { recordCount: Number(recordCount), chatCount: Number(chatCount), guardCount: Number(guardCount) };
}
