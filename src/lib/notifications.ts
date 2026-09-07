import {
  listGuardians,
  listNotificationEvents,
  insertNotificationEvent,
  listEmotionRecordsBetween,
} from "./data-access";
import type { SharedFields } from "./data-access";
import type { RiskLevel } from "./db";

export type NotificationCheckResult = {
  authorized: boolean;
  events: Array<{
    eventId: string;
    guardianName: string;
    relationship: string;
    sharedFields: SharedFields;
    status: string;
    createdAt: string;
  }>;
  note?: string;
};

function trendSentence(userId: string, today: Date): string {
  const end = today.toISOString();
  const start = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recent = listEmotionRecordsBetween(userId, start, end);
  const negativeLabels = ["低落", "难过", "焦虑", "压抑", "孤独", "无助", "烦躁", "委屈"];
  const count = recent.filter((r) => r.emotionLabels.some((label) => negativeLabels.includes(label))).length;
  if (recent.length >= 3 && count / recent.length >= 0.6) {
    return "最近几天里，低落或焦虑的片段出现得比较频繁";
  }
  if (recent.length === 0) return "";
  return "最近有一段时间的心情起伏";
}

export function runNotificationWorkflow(input: {
  userId: string;
  riskLevel: RiskLevel;
  emotionLabels: string[];
  stressor: string;
  createdAt?: string;
}): NotificationCheckResult {
  if (input.riskLevel !== "high") {
    return {
      authorized: false,
      events: [],
      note: "低/中风险不会触发守护通知；高风险时才会检查授权。",
    };
  }

  const guardians = listGuardians(input.userId).filter((g) => g.status === "active");
  const authorizedGuardians = guardians.filter((g) => g.permissions.notifyOnHighRisk);
  if (authorizedGuardians.length === 0) {
    return {
      authorized: false,
      events: [],
      note: "达到较高风险，但还没有守护人开启“高风险时允许联系”，所以不会发送任何通知。",
    };
  }

  const createdAt = input.createdAt || new Date().toISOString();
  const today = new Date(createdAt);
  const trend = trendSentence(input.userId, today);
  const events: NotificationCheckResult["events"] = [];

  for (const guardian of authorizedGuardians) {
    const perms = guardian.permissions;
    const shared: SharedFields = {
      supportCard: true,
      personalMessage: perms.personalMessage || undefined,
    };
    if (perms.shareNeedSupport) shared.needSupport = true;
    if (perms.shareRiskLevel) shared.riskLevel = "较高（仅供安全支持参考，非诊断）";
    if (perms.shareEmotionLabels) shared.emotionLabels = input.emotionLabels;
    if (perms.shareTrend && trend) shared.trend = trend;
    if (perms.shareStressor && input.stressor) shared.stressor = input.stressor;

    const event = insertNotificationEvent({
      userId: input.userId,
      guardianId: guardian.id,
      triggerType: "high_risk_record",
      sharedFields: shared,
      status: "pending",
      createdAt,
    });
    events.push({
      eventId: event.id,
      guardianName: guardian.displayName,
      relationship: guardian.relationship,
      sharedFields: event.sharedFields,
      status: event.status,
      createdAt: event.createdAt,
    });
  }

  return {
    authorized: true,
    events,
    note: "通知只包含你事前允许分享的字段，原文不会发送给守护人。",
  };
}

export function supportCard(): string[] {
  return [
    "主动联系：先轻轻问一句“你还好吗”，不需要一次解决所有问题。",
    "多听少说：先接住情绪，别急着讲道理或给建议。",
    "避免指责争辩：不要说“你想太多”或“有什么好难过的”。",
    "如存在紧迫危险：请立即寻求当地紧急或专业支持，不要独自处理。",
  ];
}

export function summarizeOwnerAudit(userId: string): {
  pending: number;
  sent: number;
  cancelled: number;
  total: number;
} {
  const events = listNotificationEvents(userId);
  return {
    pending: events.filter((e) => e.status === "pending").length,
    sent: events.filter((e) => e.status === "sent").length,
    cancelled: events.filter((e) => e.status === "cancelled").length,
    total: events.length,
  };
}
