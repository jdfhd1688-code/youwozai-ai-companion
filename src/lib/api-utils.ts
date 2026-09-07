import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import type { PublicUser } from "@/lib/data-access";

export async function apiUserOr401(): Promise<{ user: PublicUser | null; response: NextResponse | null }> {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, response: NextResponse.json({ error: "请先登录" }, { status: 401 }) };
  }
  return { user, response: null };
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
