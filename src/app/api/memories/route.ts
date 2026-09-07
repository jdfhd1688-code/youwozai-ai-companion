import { NextResponse } from "next/server";
import { apiUserOr401, jsonError } from "@/lib/api-utils";
import { listAiMemories, addAiMemory, updateAiMemory, deleteAiMemory } from "@/lib/data-access";

export async function GET() {
  const { user, response: notLoggedIn } = await apiUserOr401();
  if (!user) return notLoggedIn!;
  return NextResponse.json({ memories: listAiMemories(user.id) });
}

export async function POST(request: Request) {
  const { user, response: notLoggedIn } = await apiUserOr401();
  if (!user) return notLoggedIn!;
  const body = await request.json().catch(() => ({}));
  const content = String(body.content || "").trim();
  if (!content || content.length > 500) return jsonError("记忆内容需要填写且不超过 500 字");
  const memory = addAiMemory(user.id, content, String(body.category || "preference").slice(0, 20));
  return NextResponse.json({ memory }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { user, response: notLoggedIn } = await apiUserOr401();
  if (!user) return notLoggedIn!;
  const body = await request.json().catch(() => ({}));
  const memory = updateAiMemory(user.id, String(body.memoryId || ""), {
    content: body.content ? String(body.content) : undefined,
    visible: body.visible === undefined ? undefined : Boolean(body.visible),
  });
  if (!memory) return jsonError("这条记忆不存在或不属于你", 404);
  return NextResponse.json({ memory });
}

export async function DELETE(request: Request) {
  const { user, response: notLoggedIn } = await apiUserOr401();
  if (!user) return notLoggedIn!;
  const body = await request.json().catch(() => ({}));
  const ok = deleteAiMemory(user.id, String(body.memoryId || ""));
  if (!ok) return jsonError("这条记忆不存在或不属于你", 404);
  return NextResponse.json({ ok: true });
}
