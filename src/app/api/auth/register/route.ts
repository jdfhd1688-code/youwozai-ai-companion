import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { createUser, findUserByEmail } from "@/lib/data-access";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const nickname = String(body.nickname || "").trim();
    const ageBand = body.ageBand ? String(body.ageBand) : null;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "请输入有效的邮箱地址" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "密码至少需要 8 位" }, { status: 400 });
    }
    if (!nickname || nickname.length > 20) {
      return NextResponse.json({ error: "请填写 1-20 字的昵称" }, { status: 400 });
    }
    if (findUserByEmail(email)) {
      return NextResponse.json({ error: "这个邮箱已经注册过啦" }, { status: 409 });
    }

    const user = createUser({ email, password, nickname, ageBand, avatarUrl: null, timezone: "Asia/Shanghai" });
    await setSessionCookie(user.id);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "注册没有成功，请稍后再试" }, { status: 500 });
  }
}
