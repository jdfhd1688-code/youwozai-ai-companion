import crypto from "node:crypto";

export type TtsScene = "normal" | "chat" | "weekly_letter" | "comforting" | "safety";
export type SpeechSpeed = "slow" | "natural" | "fast";

export function ttsConfigured(): boolean {
  const key = ttsApiKey();
  return Boolean(key && !/your_api_key|placeholder/i.test(key));
}

function ttsApiKey(): string {
  return process.env.TTS_API_KEY || process.env.OPENAI_API_KEY || "";
}

export function ttsBaseUrl(): string {
  return (process.env.TTS_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
}

export function ttsModel(): string {
  return process.env.TTS_MODEL || "gpt-4o-mini-tts";
}

export function ttsVoice(scene: TtsScene = "chat"): string {
  if (scene === "safety") return process.env.TTS_SAFETY_VOICE || "sage";
  return process.env.TTS_VOICE || "coral";
}

export function sceneInstruction(scene: TtsScene): string {
  const identity = "请使用自然、地道的普通话口语。声音年轻、温暖、中性偏柔和，像熟悉的朋友在身边；避免客服腔、播音腔、机械停顿和幼儿化表达。";
  if (scene === "safety") {
    return `${identity}这是高风险陪伴场景：语速更慢，音量和情绪更稳定、克制；停顿自然清晰，不卖萌、不玩笑、不夸张，也不要制造紧迫恐慌。`;
  }
  if (scene === "comforting") return `${identity}语气柔和、稳定、低压力，留一点呼吸感，像安静陪在对方身边。`;
  if (scene === "weekly_letter") return `${identity}像给亲近的人读一封短信，稍慢、真诚、清晰，不朗诵。`;
  if (scene === "chat") return `${identity}表达自然亲近，带一点轻松俏皮，但不过度表演。短句之间使用生活化停顿。`;
  return `${identity}轻松自然，略带笑意，但不要刻意可爱。`;
}

export function speedMultiplier(speed: SpeechSpeed): number {
  if (speed === "slow") return 0.85;
  if (speed === "fast") return 1.15;
  return 1;
}

export function sceneSpeedMultiplier(scene: TtsScene, speed: SpeechSpeed): number {
  if (scene === "safety") return 0.82;
  if (scene === "comforting") return Math.min(0.92, speedMultiplier(speed));
  if (scene === "weekly_letter") return Math.min(0.9, speedMultiplier(speed));
  return speedMultiplier(speed);
}

export function speechCacheKey(text: string, scene: TtsScene, voice: string, speed: SpeechSpeed): string {
  return crypto
    .createHash("sha256")
    .update(`${scene}|${voice}|${speed}|${text}`)
    .digest("hex");
}

const audioCache = new Map<string, { dataUrl: string; expires: number }>();

export async function generateSpeechDataUrl(
  text: string,
  scene: TtsScene,
  speed: SpeechSpeed = "natural",
  fetchFn: typeof fetch = fetch,
  signal?: AbortSignal
): Promise<{ provider: "openai"; dataUrl: string; cached: boolean; voice: string; model: string } | { provider: "browser"; reason: string }> {
  if (!ttsConfigured()) return { provider: "browser", reason: "not_configured" };
  const voice = ttsVoice(scene);
  const model = ttsModel();
  const key = speechCacheKey(text, scene, voice, speed) + crypto.createHash("sha256")
    .update(ttsBaseUrl() + model + sceneInstruction(scene)).digest("hex");
  const cached = audioCache.get(key);
  if (cached && cached.expires > Date.now()) return { provider: "openai", dataUrl: cached.dataUrl, cached: true, voice, model };
  audioCache.delete(key);

  const response = await fetchFn(`${ttsBaseUrl()}/audio/speech`, {
    method: "POST",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ttsApiKey()}`,
    },
    body: JSON.stringify({
      model,
      voice,
      input: text,
      speed: sceneSpeedMultiplier(scene, speed),
      instructions: sceneInstruction(scene),
      response_format: "mp3",
    }),
  });
  if (!response.ok) {
    throw new Error(`TTS request failed: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error("TTS empty audio");
  const contentType = response.headers.get("content-type")?.split(";", 1)[0];
  const mimeType = contentType?.startsWith("audio/") ? contentType : "audio/mpeg";
  const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
  for (const [cacheKey, entry] of audioCache) {
    if (entry.expires <= Date.now()) audioCache.delete(cacheKey);
  }
  while (audioCache.size >= 24) audioCache.delete(audioCache.keys().next().value!);
  audioCache.set(key, { dataUrl, expires: Date.now() + 5 * 60 * 1000 });
  return { provider: "openai", dataUrl, cached: false, voice, model };
}
