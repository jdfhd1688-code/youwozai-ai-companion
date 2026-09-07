import { NextResponse } from "next/server";
import { apiUserOr401, jsonError } from "@/lib/api-utils";
import { listEmotionRecords } from "@/lib/data-access";
import { generateLetterForUser, latestLetterOrNull } from "@/lib/weekly-letter";

export async function GET() {
  const { user, response: notLoggedIn } = await apiUserOr401();
  if (!user) return notLoggedIn!;
  const payload = latestLetterOrNull(user.id, user.nickname);
  return NextResponse.json({ payload });
}

export async function POST() {
  const { user, response: notLoggedIn } = await apiUserOr401();
  if (!user) return notLoggedIn!;
  const records = listEmotionRecords(user.id);
  if (records.length === 0) return jsonError("还没有可用来写周信的心情记录", 400);
  const payload = generateLetterForUser(user.id, user.nickname);
  return NextResponse.json({ payload }, { status: 201 });
}
