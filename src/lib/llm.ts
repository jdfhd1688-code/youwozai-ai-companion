import { assessRisk } from "./risk";
import type { RiskLevel } from "./db";
import type { StructuredDraft } from "./data-access";

export type LlmDraft = StructuredDraft;

export function llmConfigured(): boolean {
  return Boolean(process.env.LLM_API_KEY);
}

function baseUrl(): string {
  return (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
}

function model(): string {
  return process.env.LLM_MODEL || "gpt-4o-mini";
}

export function validateDraftShape(value: unknown): StructuredDraft | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const labels = Array.isArray(obj.emotionLabels)
    ? obj.emotionLabels.map(String).filter(Boolean).slice(0, 5)
    : [];
  const intensity = Number(obj.intensity);
  const risk = String(obj.riskLevel || "");
  if (labels.length === 0 || !Number.isFinite(intensity) || intensity < 1 || intensity > 10) return null;
  if (!["low", "medium", "high"].includes(risk)) return null;
  return {
    emotionLabels: labels,
    intensity: Math.round(intensity),
    trigger: String(obj.trigger || "").slice(0, 200),
    thought: String(obj.thought || "").slice(0, 500),
    response: String(obj.response || "").slice(0, 500),
    summary: String(obj.summary || "").slice(0, 800),
    riskLevel: risk as RiskLevel,
  };
}

async function requestJson(
  body: Record<string, unknown>,
  fetchFn: typeof fetch = fetch
): Promise<unknown> {
  const response = await fetchFn(`${baseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: model(),
      temperature: 0.3,
      response_format: { type: "json_object" },
      ...body,
    }),
  });
  if (!response.ok) {
    throw new Error(`LLM request failed: ${response.status}`);
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("LLM returned no content");
  const cleaned = content.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned);
}

export async function extractStructuredDraft(
  text: string,
  fallback: StructuredDraft,
  fetchFn: typeof fetch = fetch
): Promise<StructuredDraft> {
  if (!llmConfigured()) return fallback;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await requestJson(
        {
          messages: [
            {
              role: "system",
              content:
                "你是「有我在」的情绪结构化抽取器。只能基于用户原话提取信息，不得编造经历。trigger 没有明确事件时必须为空字符串。riskLevel 只是安全路由信号，不是医学诊断。必须返回 JSON。",
            },
            {
              role: "user",
              content: `请从下面内容提取严格 JSON：{"emotionLabels":[],"intensity":1-10,"trigger":"","thought":"","response":"","summary":"","riskLevel":"low|medium|high"}\n\n用户内容：\n${text}`,
            },
          ],
        },
        fetchFn
      );
      const parsed = validateDraftShape(result);
      if (parsed) {
        if (assessRisk(text).level === "high") parsed.riskLevel = "high";
        return parsed;
      }
      lastError = new Error("LLM JSON schema validation failed");
    } catch (error) {
      lastError = error;
    }
  }
  void lastError;
  return fallback;
}

export async function generateCompanionText(
  text: string,
  nickname: string,
  scene: "normal" | "chat" | "comforting" | "safety",
  fetchFn: typeof fetch = fetch
): Promise<string | null> {
  if (!llmConfigured()) return null;
  try {
    const result = await requestJson(
      {
        messages: [
          {
            role: "system",
            content: `你是「有我在」的卡皮巴拉陪伴角色小在。声音自然、温暖、耐心，有一点点俏皮，不说教、不评判、不做医学诊断。当前场景：${scene}。`,
          },
          { role: "user", content: `用户昵称：${nickname}\n用户说：${text}\n请给小在一段自然、简洁、可读的陪伴回复。` },
        ],
      },
      fetchFn
    );
    const reply = (result as Record<string, unknown>).reply ?? (result as Record<string, unknown>).message;
    return typeof reply === "string" && reply.trim() ? reply.trim() : null;
  } catch {
    return null;
  }
}
