import { NextResponse } from "next/server";
import { apiUserOr401 } from "@/lib/api-utils";
import { listNotificationEvents } from "@/lib/data-access";

export async function GET() {
  const { user, response: notLoggedIn } = await apiUserOr401();
  if (!user) return notLoggedIn!;
  return NextResponse.json({ events: listNotificationEvents(user.id) });
}
