import type { RiskLevel } from "./db";
import type { SemanticRisk } from "./risk-fusion";

function configured(): boolean {
  return Boolean(process.env.LLM_API_KEY);
}

export async function classifyRiskWithLLM(
  text: string,
  context: string[] = [],
  trendSummary: string = "",
  fetchFn: typeof fetch = fetch
): Promise<SemanticRisk | null> {
  if (!configured()) return null;
  const baseUrl = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.LLM_MODEL || "gpt-4o-mini";

  try {
    const response = await fetchFn(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "你是「有我在」的安全风险分类器。只判断是否需要进入 Safety Workflow，不做医学诊断。关注自伤、自杀、死亡愿望、强烈绝望、方法/计划、准备行为、安全无法保证、明显升级趋势。严格返回 JSON：{\"riskLevel\":\"low|medium|high\",\"signals\":[],\"reason\":\"\",\"confidence\":0.0}",
          },
          {
            role: "user",
            content: `当前消息：${text}\n最近上下文：${JSON.stringify(context)}\n趋势摘要：${trendSummary || "无"}`,
          },
        ],
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    const parsed = JSON.parse(content.replace(/^```json\s*/i, "").replace(/```$/i, ""));
    if (!["low", "medium", "high"].includes(parsed.riskLevel)) return null;
    return {
      riskLevel: parsed.riskLevel as RiskLevel,
      signals: Array.isArray(parsed.signals) ? parsed.signals.map(String).slice(0, 5) : [],
      reason: String(parsed.reason || ""),
      confidence: Number(parsed.confidence) || 0,
    };
  } catch {
    return null;
  }
}
