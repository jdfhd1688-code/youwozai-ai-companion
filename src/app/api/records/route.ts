import { NextResponse } from "next/server";
import { apiUserOr401 } from "@/lib/api-utils";
import { listEmotionRecords } from "@/lib/data-access";

export async function GET() {
  const { user, response: notLoggedIn } = await apiUserOr401();
  if (!user) return notLoggedIn!;
  return NextResponse.json({ records: listEmotionRecords(user.id) });
}
