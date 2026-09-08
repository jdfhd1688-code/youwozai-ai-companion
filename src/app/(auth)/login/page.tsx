"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Mascot from "@/components/mascot";
import { VoiceButton } from "@/components/voice-player";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "register" && nickname.trim().length < 1) {
      setError("先给自己起一个昵称吧");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(mode === "register" ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, nickname }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "请求没有成功");
      router.push("/home");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求没有成功");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", padding: "36px 24px 30px", display: "flex", flexDirection: "column" }}>
      <div className="center" style={{ marginTop: "24px" }}>
        <div className="mascot-wrap floaty">
          <Mascot size={174} mood="smile" />
        </div>
        <h1 style={{ fontSize: 30, margin: "16px 0 6px", fontWeight: 800 }}>有我在</h1>
        <p style={{ margin: 0, color: "#8a7c72", lineHeight: 1.7 }}>
          我是小在。开心的、委屈的、乱七八糟的事，<br />
          都可以慢慢说给我听。
        </p>
        <div style={{ marginTop: 14 }}>
          <VoiceButton text="你好呀，我是小在。开心的、委屈的、乱七八糟的事情，都可以慢慢说给我听。" scene="normal" label="听小在说" />
        </div>
      </div>

      <form onSubmit={submit} className="card" style={{ marginTop: "34px" }}>
        <div className="row" style={{ gap: 8 }}>
          {(["login", "register"] as const).map((m) => (
            <button
              type="button"
              key={m}
              className={`pill ${mode === m ? "active" : ""}`}
              style={{ flex: 1, padding: "11px" }}
              onClick={() => {
                setMode(m);
                setError("");
              }}
            >
              {m === "login" ? "登录" : "第一次来"}
            </button>
          ))}
        </div>

        <label className="label" htmlFor="email">邮箱</label>
        <input
          id="email"
          className="input"
          type="email"
          value={email}
          autoComplete="email"
          placeholder="demo@youwozai.app"
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        {mode === "register" ? (
          <>
            <label className="label" htmlFor="nickname">怎么称呼你</label>
            <input
              id="nickname"
              className="input"
              value={nickname}
              maxLength={20}
              placeholder="小在之后就这样叫你"
              onChange={(e) => setNickname(e.target.value)}
              required
            />
          </>
        ) : null}

        <label className="label" htmlFor="password">密码</label>
        <input
          id="password"
          className="input"
          type="password"
          value={password}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder={mode === "login" ? "请输入密码" : "至少 8 位"}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error ? <p className="tiny" style={{ color: "#b2583d", margin: "12px 0 0" }}>{error}</p> : null}

        <button className="btn btn-primary btn-block" style={{ marginTop: "18px" }} disabled={loading}>
          {loading ? "稍等一下…" : mode === "login" ? "回来啦，进去吧" : "和小在认识一下"}
        </button>
      </form>

      <p className="tiny muted center" style={{ marginTop: "18px" }}>
        演示账号：demo@youwozai.app　密码：Capybara123
        <br />账号内全部经历、关系和情绪内容均为虚构演示数据。
      </p>
    </main>
  );
}
