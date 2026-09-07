import { NextResponse } from "next/server";
import { apiUserOr401, jsonError } from "@/lib/api-utils";
import { updateEmotionRecord, deleteEmotionRecord, getEmotionRecord } from "@/lib/data-access";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { user, response: notLoggedIn } = await apiUserOr401();
  if (!user) return notLoggedIn!;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const updated = updateEmotionRecord(user.id, id, {
    emotionLabels: Array.isArray(body.emotionLabels) ? body.emotionLabels.map(String) : [],
    intensity: Number(body.intensity),
    trigger: String(body.trigger || ""),
    thought: String(body.thought || ""),
    response: String(body.response || ""),
    summary: String(body.summary || ""),
    riskLevel: String(body.riskLevel || "low") as "low" | "medium" | "high",
  });
  if (!updated) return jsonError("这条记录不存在或不属于你", 404);
  return NextResponse.json({ record: updated });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { user, response: notLoggedIn } = await apiUserOr401();
  if (!user) return notLoggedIn!;
  const { id } = await params;
  const record = getEmotionRecord(user.id, id);
  if (!record) return jsonError("这条记录不存在或不属于你", 404);
  deleteEmotionRecord(user.id, id);
  return NextResponse.json({ ok: true });
}
