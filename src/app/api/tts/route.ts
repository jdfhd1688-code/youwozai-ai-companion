import { NextResponse } from "next/server";
import { apiUserOr401, jsonError } from "@/lib/api-utils";
import { generateSpeechDataUrl, ttsConfigured } from "@/lib/tts";
import type { TtsScene } from "@/lib/tts";

export async function GET() {
  const { user, response } = await apiUserOr401();
  if (!user) return response!;
  return NextResponse.json({ configured: ttsConfigured() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const { user, response: notLoggedIn } = await apiUserOr401();
  if (!user) return notLoggedIn!;
  const body = await request.json().catch(() => ({}));
  const text = String(body.text || "").trim();
  if (!text || text.length > 1500) return jsonError("语音文本不合法");
  const scene = (["normal", "chat", "weekly_letter", "comforting", "safety"].includes(String(body.scene))
    ? String(body.scene)
    : "chat") as TtsScene;
  const speed = (["slow", "natural", "fast"].includes(String(body.speed)) ? String(body.speed) : "natural") as "slow" | "natural" | "fast";

  try {
    const result = await generateSpeechDataUrl(text, scene, speed, fetch, request.signal);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const reason = /401|403/.test(message) ? "credentials"
      : /429/.test(message) ? "quota"
      : /timeout|timed out/i.test(message) ? "timeout" : "network_or_provider";
    // Never log text, provider response bodies, or credentials.
    console.warn("[tts] fallback:", reason);
    return NextResponse.json({ provider: "browser", reason }, { headers: { "Cache-Control": "no-store" } });
  }
}
