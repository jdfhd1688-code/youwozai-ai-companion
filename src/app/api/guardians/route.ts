import { NextResponse } from "next/server";
import { apiUserOr401, jsonError } from "@/lib/api-utils";
import {
  listGuardians,
  insertGuardian,
  updateGuardianPermissions,
  deleteGuardian,
  findUserByEmail,
} from "@/lib/data-access";
import { buildGuardianPatch } from "@/lib/guardian-permissions";

export async function GET() {
  const { user, response: notLoggedIn } = await apiUserOr401();
  if (!user) return notLoggedIn!;
  return NextResponse.json({ guardians: listGuardians(user.id) });
}

export async function POST(request: Request) {
  const { user, response: notLoggedIn } = await apiUserOr401();
  if (!user) return notLoggedIn!;
  const body = await request.json().catch(() => ({}));
  const displayName = String(body.displayName || "").trim();
  const relationship = String(body.relationship || "").trim();
  if (!displayName || displayName.length > 20) return jsonError("请填写守护人的称呼");
  if (!relationship) return jsonError("请选择或填写你们的关系");

  const contactHint = body.contactHint ? String(body.contactHint).trim().slice(0, 60) : null;
  let guardianUserId: string | null = null;
  if (body.guardianEmail) {
    const match = findUserByEmail(String(body.guardianEmail));
    if (match && match.id !== user.id) guardianUserId = match.id;
  }

  const guardian = insertGuardian({
    ownerUserId: user.id,
    guardianUserId,
    displayName,
    relationship,
    contactHint,
    permissions: {
      notifyOnHighRisk: Boolean(body.notifyOnHighRisk),
      shareNeedSupport: Boolean(body.shareNeedSupport !== false),
      shareRiskLevel: Boolean(body.shareRiskLevel),
      shareEmotionLabels: Boolean(body.shareEmotionLabels),
      shareTrend: Boolean(body.shareTrend),
      shareStressor: Boolean(body.shareStressor),
      personalMessage: String(body.personalMessage || "").slice(0, 200),
    },
  });
  return NextResponse.json({ guardian }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { user, response: notLoggedIn } = await apiUserOr401();
  if (!user) return notLoggedIn!;
  const body = await request.json().catch(() => ({}));
  const guardianId = String(body.guardianId || "");
  if (!guardianId) return jsonError("缺少守护人信息");
  const updated = updateGuardianPermissions(user.id, guardianId, buildGuardianPatch(body));
  if (!updated) return jsonError("这位守护人不存在或不属于你", 404);
  return NextResponse.json({ guardian: updated });
}

export async function DELETE(request: Request) {
  const { user, response: notLoggedIn } = await apiUserOr401();
  if (!user) return notLoggedIn!;
  const body = await request.json().catch(() => ({}));
  const ok = deleteGuardian(user.id, String(body.guardianId || ""));
  if (!ok) return jsonError("这位守护人不存在或不属于你", 404);
  return NextResponse.json({ ok: true });
}
