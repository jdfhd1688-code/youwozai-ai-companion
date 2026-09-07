import { NextResponse } from "next/server";
import { apiUserOr401, jsonError } from "@/lib/api-utils";
import { getUserSetting, setUserSetting } from "@/lib/data-access";

function readVoiceSettings(userId: string) {
  return {
    autoPlay: getUserSetting(userId, "voice_auto_play") !== "false",
    speed: getUserSetting(userId, "voice_speed") || "natural",
  };
}

export async function GET() {
  const { user, response: notLoggedIn } = await apiUserOr401();
  if (!user) return notLoggedIn!;
  return NextResponse.json(readVoiceSettings(user.id));
}

export async function PATCH(request: Request) {
  const { user, response: notLoggedIn } = await apiUserOr401();
  if (!user) return notLoggedIn!;
  const body = await request.json().catch(() => ({}));
  if ("autoPlay" in body && typeof body.autoPlay !== "boolean") return jsonError("自动播放设置不合法");
  if ("autoPlay" in body) setUserSetting(user.id, "voice_auto_play", body.autoPlay ? "true" : "false");
  if ("speed" in body && ["slow", "natural", "fast"].includes(String(body.speed))) {
    setUserSetting(user.id, "voice_speed", String(body.speed));
  }
  return NextResponse.json(readVoiceSettings(user.id));
}
