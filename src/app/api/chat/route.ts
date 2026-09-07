import { NextResponse } from "next/server";
import { apiUserOr401, jsonError } from "@/lib/api-utils";
import {
  appendChatMessages,
  getChatSession,
  startChatSession,
  insertEmotionRecord,
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
  const session =
    (sessionIdRaw && getChatSession(user.id, sessionIdRaw)) || startChatSession(user.id, pickOpening());

  const userMessage: ChatMessage = { role: "user", content: text, createdAt: new Date().toISOString(), type: "chat" };
  const historyUserMessages = session.messages.filter((m) => m.role === "user").length;
  const ruleRisk = assessRisk(text);
  const semanticRisk = await classifyRiskWithLLM(text);
  const fusedRisk = deterministicRiskFusion(ruleRisk, semanticRisk);

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
  const xiaozaiMessage: ChatMessage = {
    role: "xiaozai",
    content: reply.message,
    createdAt: new Date().toISOString(),
    type: reply.kind === "safety" ? "safety" : "chat",
    draft,
  };

  const updated = appendChatMessages(user.id, session.id, [userMessage, xiaozaiMessage]);
  const sessionMessages = updated.messages.slice(-12);
  return NextResponse.json({
    sessionId: session.id,
    messages: sessionMessages,
    reply: { kind: reply.kind, draft },
    safety: reply.kind === "safety",
  });
}

export async function PUT(request: Request) {
  const { user, response: notLoggedIn } = await apiUserOr401();
  if (!user) return notLoggedIn!;
  const body = await request.json().catch(() => ({}));
  const draft = validateDraft(body);
  if (!draft) return jsonError("这份心情记录还缺少必要字段，请先确认完整");
  const record = insertEmotionRecord({
    userId: user.id,
    ...draft,
    rawConversationRef: body.sessionId ? `chat:${String(body.sessionId)}` : null,
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
