import { NextResponse } from "next/server";
import { apiUserOr401, jsonError } from "@/lib/api-utils";
import { updateUserProfile, deleteUserAndData } from "@/lib/data-access";
import { clearSessionCookie } from "@/lib/auth";

export async function PATCH(request: Request) {
  const { user, response: notLoggedIn } = await apiUserOr401();
  if (!user) return notLoggedIn!;
  const body = await request.json().catch(() => ({}));
  const updated = updateUserProfile(user.id, {
    nickname: body.nickname ? String(body.nickname).trim().slice(0, 20) : undefined,
    ageBand: body.ageBand === null || body.ageBand === "" ? null : String(body.ageBand || ""),
    avatarUrl: body.avatarUrl === null || body.avatarUrl === "" ? null : String(body.avatarUrl || ""),
    timezone: body.timezone ? String(body.timezone).slice(0, 40) : undefined,
  });
  return NextResponse.json({ user: updated });
}

export async function DELETE() {
  const { user, response: notLoggedIn } = await apiUserOr401();
  if (!user) return notLoggedIn!;
  deleteUserAndData(user.id);
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
