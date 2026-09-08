import { NextResponse } from "next/server";
import { apiUserOr401, jsonError } from "@/lib/api-utils";
import {
  appendChatMessages,
  getChatSession,
  getChatMessage,
  listChatSessions,
  startChatSession,
  insertEmotionRecord,
  updateChatMessageSafety,
} from "@/lib/data-access";
import { extractEmotionDraft, localReply, pickOpening } from "@/lib/companion";
import { extractStructuredDraft, generateCompanionText, llmConfigured } from "@/lib/llm";
import { assessRisk } from "@/lib/risk";
import { classifyRiskWithLLM } from "@/lib/risk-classifier";
import { deterministicRiskFusion } from "@/lib/risk-fusion";
import { runNotificationWorkflow } from "@/lib/notifications";
import type { ChatMessage, StructuredDraft } from "@/lib/data-access";

function validateDraft(body: Record<string, unknown>): StructuredDraft | null {
  const labels = Array.isArray(body.emotionLabels)
    ? body.emotionLabels.map(String).filter(Boolean).slice(0, 5)
    : [];
  const intensity = Number(body.intensity);
  const risk = String(body.riskLevel || "");
  if (labels.length === 0 || !Number.isFinite(intensity) || intensity < 1 || intensity > 10) return null;
  if (!["low", "medium", "high"].includes(risk)) return null;
  return {
    emotionLabels: labels,
    intensity,
    trigger: String(body.trigger || "").slice(0, 200),
    thought: String(body.thought || "").slice(0, 500),
    response: String(body.response || "").slice(0, 500),
    summary: String(body.summary || "").slice(0, 800),
    riskLevel: risk as StructuredDraft["riskLevel"],
  };
}

export async function POST(request: Request) {
  const { user, response: notLoggedIn } = await apiUserOr401();
  if (!user) return notLoggedIn!;

  const body = await request.json().catch(() => ({}));
  const text = String(body.text || "").trim();
  if (!text) return jsonError("先告诉小在一点点事情吧");
  if (text.length > 1200) return jsonError("这一段有点长，可以慢慢分段说给小在听");

  const sessionIdRaw = body.sessionId ? String(body.sessionId) : null;
  const existingSession = sessionIdRaw ? getChatSession(user.id, sessionIdRaw) : null;
  if (sessionIdRaw && !existingSession) return jsonError("会话不存在或无权访问", 404);
  const session = existingSession || startChatSession(user.id, pickOpening());

  // Persist the user's words before any external classification or generation.
  const afterUser = appendChatMessages(user.id, session.id, [{
    role: "user",
    content: text,
    createdAt: new Date().toISOString(),
    type: "chat",
  }]);
  const userMessage = afterUser.messages[afterUser.messages.length - 1];
  const historyUserMessages = session.messages.filter((m) => m.role === "user").length;
  const ruleRisk = assessRisk(text);
  const semanticRisk = await classifyRiskWithLLM(text);
  const fusedRisk = deterministicRiskFusion(ruleRisk, semanticRisk);
  updateChatMessageSafety(user.id, session.id, userMessage.id, fusedRisk.level);

  const baseReply = localReply({
    text,
    userId: user.id,
    nickname: user.nickname,
    priorUserMessages: historyUserMessages,
    riskOverride: fusedRisk,
  });

  const reply = { ...baseReply };
  if (reply.kind !== "safety" && llmConfigured()) {
    const llmText = await generateCompanionText(text, user.nickname, "chat");
    if (llmText) reply.message = llmText;
  }

  let draft = reply.draft ?? (reply.kind === "draft" ? extractEmotionDraft(text) : null);
  if (draft) {
    draft = await extractStructuredDraft(text, draft);
    if (fusedRisk.level === "high") draft.riskLevel = "high";
    reply.draft = draft;
  }
  const xiaozaiMessage: Omit<ChatMessage, "id" | "conversationId" | "sequenceNo"> = {
    role: "xiaozai",
    content: reply.message,
    createdAt: new Date().toISOString(),
    type: reply.kind === "safety" ? "safety" : "chat",
    draft,
    safetyLevel: fusedRisk.level,
  };

  const updated = appendChatMessages(user.id, session.id, [xiaozaiMessage]);
  const sessionMessages = updated.messages.slice(-12);
  const assistantMessage = updated.messages[updated.messages.length - 1];
  return NextResponse.json({
    sessionId: session.id,
    messages: sessionMessages,
    userMessage: getChatMessage(user.id, session.id, userMessage.id),
    assistantMessage,
    reply: { kind: reply.kind, draft },
    safety: reply.kind === "safety",
  });
}

export async function PUT(request: Request) {
  const { user, response: notLoggedIn } = await apiUserOr401();
  if (!user) return notLoggedIn!;
  const body = await request.json().catch(() => ({}));
  let draft = validateDraft(body);
  if (!draft) return jsonError("这份心情记录还缺少必要字段，请先确认完整");
  const conversationId = body.sessionId ? String(body.sessionId) : null;
  if (!conversationId || !getChatSession(user.id, conversationId)) return jsonError("会话不存在或无权访问", 404);
  const requestedSourceMessageId = body.sourceMessageId ? String(body.sourceMessageId) : null;
  const sourceMessage = requestedSourceMessageId
    ? getChatMessage(user.id, conversationId, requestedSourceMessageId)
    : null;
  if (requestedSourceMessageId && (!sourceMessage || sourceMessage.role !== "user")) {
    return jsonError("来源消息不存在或无权访问", 404);
  }
  if (sourceMessage?.safetyLevel === "high") draft = { ...draft, riskLevel: "high" };
  const record = insertEmotionRecord({
    userId: user.id,
    ...draft,
    rawConversationRef: `chat:${conversationId}`,
    sourceConversationId: conversationId,
    sourceMessageId: sourceMessage?.id || null,
    extractionVersion: "emotion-v1",
  });

  const notification = runNotificationWorkflow({
    userId: user.id,
    riskLevel: record.riskLevel,
    emotionLabels: record.emotionLabels,
    stressor: record.trigger,
    createdAt: record.createdAt,
  });

  return NextResponse.json(
    {
      record,
      notification,
    },
    { status: 201 }
  );
}

export async function GET(request: Request) {
  const { user, response: notLoggedIn } = await apiUserOr401();
  if (!user) return notLoggedIn!;
  const conversationId = new URL(request.url).searchParams.get("sessionId");
  const session = conversationId
    ? getChatSession(user.id, conversationId)
    : listChatSessions(user.id, 1)[0] || null;
  if (conversationId && !session) return jsonError("会话不存在或无权访问", 404);
  return NextResponse.json({ session });
}
