import { NextResponse } from "next/server";
import { apiUserOr401, jsonError } from "@/lib/api-utils";
import { updateNotificationEventStatus } from "@/lib/data-access";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { user, response: notLoggedIn } = await apiUserOr401();
  if (!user) return notLoggedIn!;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  if (action !== "send" && action !== "cancel") return jsonError("不支持的操作");
  const event = updateNotificationEventStatus(user.id, id, action === "send" ? "sent" : "cancelled");
  if (!event) return jsonError("这条通知不存在或不属于你", 404);
  return NextResponse.json({ event });
}
