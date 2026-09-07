import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { verifyLogin } from "@/lib/data-access";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const user = verifyLogin(email, password);
    if (!user) {
      return NextResponse.json({ error: "邮箱或密码不对，再试一次看看" }, { status: 401 });
    }
    await setSessionCookie(user.id);
    return NextResponse.json({ user });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "登录没有成功，请稍后再试" }, { status: 500 });
  }
}
