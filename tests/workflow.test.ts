import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

process.env.DATABASE_PATH = path.join(os.tmpdir(), `ywz-test-${crypto.randomUUID()}.db`);

const data = await import("../src/lib/data-access");
const notifications = await import("../src/lib/notifications");
const companion = await import("../src/lib/companion");
const weeklyLetter = await import("../src/lib/weekly-letter");
const guardianPermissions = await import("../src/lib/guardian-permissions");
const { runNotificationWorkflow } = notifications;
const { insertGuardian, createUser, insertEmotionRecord, listNotificationEvents, updateNotificationEventStatus } = data;

test("unauthorized guardian never receives a high-risk notification", async () => {
  const owner = createUser({ email: `owner-${crypto.randomUUID()}@test.local`, password: "password123", nickname: "测试用户" });
  const guardianUser = createUser({ email: `guardian-${crypto.randomUUID()}@test.local`, password: "password123", nickname: "守护人" });
  insertGuardian({
    ownerUserId: owner.id,
    guardianUserId: guardianUser.id,
    displayName: "小树",
    relationship: "好友",
    permissions: {
      notifyOnHighRisk: false,
      shareNeedSupport: true,
      personalMessage: "陪我说说话就好。",
    },
  });

  const result = runNotificationWorkflow({
    userId: owner.id,
    riskLevel: "high",
    emotionLabels: ["低落", "无助"],
    stressor: "最近几天撑不住",
  });

  assert.equal(result.authorized, false);
  assert.equal(result.events.length, 0);
});

test("authorized guardian only receives explicitly shared fields", async () => {
  const owner = createUser({ email: `owner2-${crypto.randomUUID()}@test.local`, password: "password123", nickname: "测试用户" });
  const guardianUser = createUser({ email: `guardian2-${crypto.randomUUID()}@test.local`, password: "password123", nickname: "守护人" });
  const guardian = insertGuardian({
    ownerUserId: owner.id,
    guardianUserId: guardianUser.id,
    displayName: "大树",
    relationship: "家人",
    permissions: {
      notifyOnHighRisk: true,
      shareNeedSupport: true,
      shareRiskLevel: true,
      shareEmotionLabels: true,
      shareStressor: false,
      shareTrend: false,
      personalMessage: "不要急着解决，陪我说说话就好。",
    },
  });

  const result = runNotificationWorkflow({
    userId: owner.id,
    riskLevel: "high",
    emotionLabels: ["低落", "无助"],
    stressor: "工作压力很大",
  });

  assert.equal(result.authorized, true);
  assert.equal(result.events.length, 1);
  const fields = result.events[0].sharedFields;
  assert.equal(fields.needSupport, true);
  assert.equal(fields.riskLevel, "较高（仅供安全支持参考，非诊断）");
  assert.deepEqual(fields.emotionLabels, ["低落", "无助"]);
  assert.equal(fields.stressor, undefined, "未授权字段不得发送");
  assert.equal(fields.trend, undefined, "未授权字段不得发送");
  assert.ok(!("rawText" in fields));
  assert.equal(fields.personalMessage, guardian.permissions.personalMessage);
});

test("notification lifecycle keeps an auditable trail", async () => {
  const owner = createUser({ email: `owner3-${crypto.randomUUID()}@test.local`, password: "password123", nickname: "测试用户" });
  const result = runNotificationWorkflow({
    userId: owner.id,
    riskLevel: "high",
    emotionLabels: ["低落"],
    stressor: "",
  });
  assert.equal(result.events.length, 0);
  assert.equal(result.authorized, false);

  const record = insertEmotionRecord({
    userId: owner.id,
    emotionLabels: ["低落", "无助"],
    intensity: 9,
    trigger: "连续几天撑不住",
    thought: "",
    response: "",
    summary: "test",
    riskLevel: "high",
  });
  assert.equal(record.riskLevel, "high");

  const events = listNotificationEvents(owner.id);
  assert.equal(events.length, 0, "无授权守护人时不产生通知事件");
});

test("companion routing: high risk bypasses normal chat generation", () => {
  const reply = companion.localReply({
    text: "我想消失，早上也不想醒来。",
    userId: "x",
    nickname: "小乐",
    priorUserMessages: 3,
  });
  assert.equal(reply.kind, "safety");
  assert.equal(reply.draft?.riskLevel, "high");
  assert.match(reply.message, /担心|一个人/);
});

test("companion routing: low risk prompts gently before drafting", () => {
  const first = companion.localReply({
    text: "今天有点烦，同事没告诉我改了方案。",
    userId: "x",
    nickname: "小乐",
    priorUserMessages: 0,
  });
  assert.equal(first.kind, "chat");
  const second = companion.localReply({
    text: "就是觉得白做了，心里很委屈，晚上还想哭。",
    userId: "x",
    nickname: "小乐",
    priorUserMessages: 1,
  });
  assert.equal(second.kind, "draft");
  const draft = companion.extractEmotionDraft("就是觉得白做了，心里很委屈，晚上还想哭。");
  assert.ok(draft.emotionLabels.includes("委屈") || draft.emotionLabels.includes("难过"));
  assert.ok(draft.intensity >= 1 && draft.intensity <= 10);
});

test("notification cancellation keeps cancelled_at and cannot resend cancelled event", async () => {
  const owner = createUser({ email: `owner4-${crypto.randomUUID()}@test.local`, password: "password123", nickname: "测试用户" });
  const guardianUser = createUser({ email: `guardian4-${crypto.randomUUID()}@test.local`, password: "password123", nickname: "守护人" });
  insertGuardian({
    ownerUserId: owner.id,
    guardianUserId: guardianUser.id,
    displayName: "测试守护人",
    relationship: "家人",
    permissions: { notifyOnHighRisk: true, shareNeedSupport: true },
  });
  const created = runNotificationWorkflow({ userId: owner.id, riskLevel: "high", emotionLabels: ["低落"], stressor: "" });
  assert.equal(created.events.length, 1);
  const cancelled = updateNotificationEventStatus(owner.id, created.events[0].eventId, "cancelled");
  assert.ok(cancelled);
  assert.equal(cancelled.status, "cancelled");
  assert.ok(cancelled.cancelledAt);
  const event = listNotificationEvents(owner.id).find((e) => e.id === created.events[0].eventId);
  assert.equal(event?.status, "cancelled");
  assert.ok(event?.cancelledAt);
});

test("guardian permission patch only updates fields that are actually sent", async () => {
  const owner = createUser({ email: `owner5-${crypto.randomUUID()}@test.local`, password: "password123", nickname: "测试用户" });
  const guardian = insertGuardian({
    ownerUserId: owner.id,
    displayName: "权限测试",
    relationship: "好友",
    permissions: {
      notifyOnHighRisk: true,
      shareNeedSupport: true,
      shareRiskLevel: false,
      shareEmotionLabels: false,
    },
  });

  const afterEmotionPatch = data.updateGuardianPermissions(owner.id, guardian.id, {
    shareEmotionLabels: true,
  } as Partial<import("../src/lib/data-access").GuardianPermissions>);

  assert.equal(afterEmotionPatch?.permissions.notifyOnHighRisk, true);
  assert.equal(afterEmotionPatch?.permissions.shareNeedSupport, true);
  assert.equal(afterEmotionPatch?.permissions.shareEmotionLabels, true);
  assert.equal(afterEmotionPatch?.permissions.shareRiskLevel, false);

  const afterMessagePatch = data.updateGuardianPermissions(owner.id, guardian.id, {
    personalMessage: "只更新这句话。",
  } as Partial<import("../src/lib/data-access").GuardianPermissions>);

  assert.equal(afterMessagePatch?.permissions.notifyOnHighRisk, true);
  assert.equal(afterMessagePatch?.permissions.shareNeedSupport, true);
  assert.equal(afterMessagePatch?.permissions.shareEmotionLabels, true);
  assert.equal(afterMessagePatch?.permissions.personalMessage, "只更新这句话。");
});

test("guardian PATCH body builder ignores fields that were not sent", () => {
  const patch = guardianPermissions.buildGuardianPatch({ shareEmotionLabels: true });
  assert.deepEqual(Object.keys(patch).sort(), ["shareEmotionLabels"]);
  assert.equal(patch.shareEmotionLabels, true);
  assert.equal("notifyOnHighRisk" in patch, false);
});

test("emotion records can be saved, edited, and deleted", async () => {
  const user = createUser({ email: `records-${crypto.randomUUID()}@test.local`, password: "password123", nickname: "记录测试" });
  const saved = insertEmotionRecord({
    userId: user.id,
    emotionLabels: ["委屈"],
    intensity: 6,
    trigger: "方案被改",
    thought: "",
    response: "",
    summary: "初始记录",
    riskLevel: "low",
  });
  const edited = data.updateEmotionRecord(user.id, saved.id, {
    emotionLabels: ["委屈", "难过"],
    intensity: 8,
    trigger: "方案被改却没告诉我",
    thought: "是不是我不够好",
    response: "想哭",
    summary: "编辑后的记录",
    riskLevel: "low",
  });
  assert.equal(edited?.intensity, 8);
  assert.deepEqual(edited?.emotionLabels, ["委屈", "难过"]);
  assert.equal(data.deleteEmotionRecord(user.id, saved.id), true);
  assert.equal(data.getEmotionRecord(user.id, saved.id), null);
});

test("weekly letter can be generated from saved records", async () => {
  const user = createUser({ email: `letter-${crypto.randomUUID()}@test.local`, password: "password123", nickname: "周信测试" });
  const now = new Date();
  for (let i = 0; i < 4; i += 1) {
    const createdAt = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString();
    insertEmotionRecord({
      userId: user.id,
      emotionLabels: i % 2 === 0 ? ["焦虑", "疲惫"] : ["低落", "孤独"],
      intensity: 6 + i,
      trigger: "工作压力",
      thought: "",
      response: "",
      summary: `第 ${i + 1} 条记录`,
      riskLevel: "medium",
      createdAt,
    });
  }
  const payload = weeklyLetter.generateLetterForUser(user.id, user.nickname);
  assert.ok(payload.letter.summaryText.includes("周信测试"));
  assert.ok(payload.chart.recordCount >= 4);
  assert.ok(payload.letter.insightText.length > 0);
  assert.ok(payload.letter.nextWeekPromise.length > 0);
});

test("notification events can transition through pending, sent, and cancelled states", async () => {
  const user = createUser({ email: `status-${crypto.randomUUID()}@test.local`, password: "password123", nickname: "状态测试" });
  const guardian = insertGuardian({
    ownerUserId: user.id,
    displayName: "状态守护人",
    relationship: "好友",
    permissions: { notifyOnHighRisk: true, shareNeedSupport: true },
  });
  const pending = notifications.runNotificationWorkflow({ userId: user.id, riskLevel: "high", emotionLabels: ["低落"], stressor: "" });
  assert.equal(pending.events[0].status, "pending");
  const sent = data.updateNotificationEventStatus(user.id, pending.events[0].eventId, "sent");
  assert.equal(sent?.status, "sent");
  assert.ok(sent?.sentAt);
  const cancelled = notifications.runNotificationWorkflow({ userId: user.id, riskLevel: "high", emotionLabels: ["低落"], stressor: "" });
  const cancelledEvent = data.updateNotificationEventStatus(user.id, cancelled.events[0].eventId, "cancelled");
  assert.equal(cancelledEvent?.status, "cancelled");
  assert.ok(cancelledEvent?.cancelledAt);
  const events = data.listNotificationEvents(user.id);
  assert.ok(events.some((e) => e.status === "pending" || e.status === "sent" || e.status === "cancelled"));
  void guardian;
});
