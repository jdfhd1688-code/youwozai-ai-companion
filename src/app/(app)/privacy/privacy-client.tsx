"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserRound, ShieldCheck, Brain, LogOut, Trash2, Eye, EyeOff, Plus, X, Pencil, Volume2 } from "lucide-react";
import type { PublicUser, GuardianRow, AiMemoryRow, EmotionRecordRow } from "@/lib/data-access";

export default function PrivacyClient({
  user: initialUser,
  guardians,
  memories: initialMemories,
  records,
}: {
  user: PublicUser;
  guardians: GuardianRow[];
  memories: AiMemoryRow[];
  records: EmotionRecordRow[];
}) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [memories, setMemories] = useState(initialMemories);
  const [editingProfile, setEditingProfile] = useState(false);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  function notify(text: string) {
    setToast(text);
    setTimeout(() => setToast(""), 3000);
  }

  async function saveProfile(nickname: string, ageBand: string) {
    setBusy(true);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, ageBand: ageBand || null }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setUser(data.user);
      setEditingProfile(false);
      notify("资料已经更新");
    } else {
      notify(data.error || "更新失败");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function removeAccount() {
    if (!confirm("账号注销后，你的所有记录、守护关系与 AI 记忆都会被永久删除。确定继续吗？")) return;
    await fetch("/api/me", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  async function updateMemory(id: string, content?: string, visible?: boolean) {
    const res = await fetch("/api/memories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memoryId: id, content, visible }),
    });
    const data = await res.json();
    if (res.ok) {
      setMemories((prev) => prev.map((m) => (m.id === id ? data.memory : m)));
      notify("记忆已更新");
    }
  }

  async function removeMemory(id: string) {
    const res = await fetch("/api/memories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memoryId: id }),
    });
    if (res.ok) {
      setMemories((prev) => prev.filter((m) => m.id !== id));
      notify("这条记忆已删除");
    }
  }

  async function addMemory(content: string) {
    const res = await fetch("/api/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    if (res.ok) {
      setMemories((prev) => [data.memory, ...prev]);
      notify("小在记住了，且随时可改可删");
    }
  }

  const topLabels = Array.from(new Set(records.flatMap((r) => r.emotionLabels))).slice(0, 5);

  return (
    <div className="stack">
      <section className="card row" style={{ alignItems: "flex-start" }}>
        <span className="avatar-btn" style={{ width: 52, height: 52, fontSize: 22 }}>{user.nickname.slice(0, 1)}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{user.nickname}</div>
          <div className="tiny muted" style={{ marginTop: 2 }}>{user.email}</div>
          <div className="tiny muted" style={{ marginTop: 2 }}>{user.ageBand ? `年龄段 ${user.ageBand} · ` : ""}时区 {user.timezone}</div>
        </div>
        <button className="btn btn-soft btn-sm" onClick={() => setEditingProfile((v) => !v)}>
          <UserRound size={15} />
          修改资料
        </button>
      </section>

      {editingProfile ? (
        <ProfileForm user={user} busy={busy} onSave={saveProfile} onCancel={() => setEditingProfile(false)} />
      ) : null}

      <VoiceSettings />

      <section className="card">
        <div className="row">
          <div>
            <div style={{ fontWeight: 750 }}>守护圈与分享范围</div>
            <p className="tiny muted" style={{ margin: "4px 0 0" }}>每位守护人能看到的字段，都来自你的逐项授权</p>
          </div>
          <ShieldCheck size={21} style={{ color: "#6c8a72" }} />
        </div>
        <div className="stack" style={{ gap: 8, marginTop: 10 }}>
          {guardians.length === 0 ? (
            <p className="tiny muted">还没有守护人。</p>
          ) : guardians.map((g) => (
            <div key={g.id} className="soft-card" style={{ padding: "10px 12px" }}>
              <div className="row">
                <strong style={{ fontSize: 14 }}>{g.displayName}</strong>
                <span className="tiny muted">{g.relationship}</span>
              </div>
              <p className="tiny" style={{ margin: "5px 0 0", lineHeight: 1.55, color: g.permissions.notifyOnHighRisk ? "#6b7f56" : "#9b8b7c" }}>
                {g.permissions.notifyOnHighRisk ? "已开启：高风险时允许联系" : "未开启：不会收到任何风险通知"}
                {g.permissions.shareNeedSupport ? " · 可收到需要陪伴信号" : ""}
                {g.permissions.shareRiskLevel ? " · 风险等级" : ""}
                {g.permissions.shareEmotionLabels ? " · 情绪标签" : ""}
                {g.permissions.shareTrend ? " · 趋势" : ""}
                {g.permissions.shareStressor ? " · 压力来源" : ""}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="row">
          <div>
            <div style={{ fontWeight: 750 }}>AI 记忆管理</div>
            <p className="tiny muted" style={{ margin: "4px 0 0" }}>只存你会愿意再次看到的内容，全部可见、可改、可删</p>
          </div>
          <Brain size={21} style={{ color: "#a9a06c" }} />
        </div>
        <div className="soft-card" style={{ marginTop: 10 }}>
          <div className="tiny" style={{ fontWeight: 650 }}>小在目前会记住（用于陪伴，不用于诊断）：</div>
          <ul className="tiny muted" style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.8 }}>
            <li>你叫 {user.nickname}，时区 {user.timezone}</li>
            {user.ageBand ? <li>年龄段 {user.ageBand}</li> : null}
            <li>已保存 {records.length} 段心情记录{topLabels.length ? `，最近出现 ${topLabels.join("、")}` : ""}</li>
            <li>{guardians.length} 位守护人及其逐项授权范围</li>
            <li>下方你主动允许小在记住的偏好</li>
          </ul>
        </div>
        <AddMemory onAdd={addMemory} />
        <div className="stack" style={{ gap: 8, marginTop: 10 }}>
          {memories.map((m) => (
            <MemoryRow key={m.id} memory={m} onUpdate={updateMemory} onDelete={removeMemory} />
          ))}
          {memories.length === 0 ? <p className="tiny muted">还没有自定义记忆。让小在记住一些你希望 TA 不忘记的小事吧。</p> : null}
        </div>
      </section>

      <section className="card" style={{ borderColor: "#e7dcd0" }}>
        <div style={{ fontWeight: 750 }}>账号</div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn btn-ghost btn-sm" onClick={logout}>
            <LogOut size={15} />
            退出登录
          </button>
          <button className="btn btn-ghost btn-sm" style={{ color: "#a2523f", borderColor: "#ebcfc4" }} onClick={removeAccount}>
            <Trash2 size={15} />
            注销账号
          </button>
        </div>
        <p className="tiny muted" style={{ margin: "10px 0 0", lineHeight: 1.6 }}>
          通知与守护圈权限永远不会被默认开启；任何自动通知都不能保证阻止自伤或替代紧急服务。
        </p>
      </section>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

function ProfileForm({ user, busy, onSave, onCancel }: {
  user: PublicUser;
  busy: boolean;
  onSave: (nickname: string, ageBand: string) => void;
  onCancel: () => void;
}) {
  const [nickname, setNickname] = useState(user.nickname);
  const [ageBand, setAgeBand] = useState(user.ageBand || "");
  return (
    <section className="card" style={{ borderColor: "#eacba4" }}>
      <div className="row"><strong>修改资料</strong><button className="icon-btn" onClick={onCancel} aria-label="关闭"><X size={18} /></button></div>
      <label className="label">昵称</label>
      <input className="input" value={nickname} maxLength={20} onChange={(e) => setNickname(e.target.value)} />
      <label className="label">年龄段（可选）</label>
      <div className="row wrap gap-6" style={{ marginTop: 4 }}>
        {["18 岁以下", "18-24", "25-34", "35-44", "45-54", "55 岁以上"].map((option) => (
          <button key={option} type="button" className={`pill ${ageBand === option ? "active" : ""}`} onClick={() => setAgeBand(option)}>{option}</button>
        ))}
        {ageBand ? <button className="pill" onClick={() => setAgeBand("")}>不填了</button> : null}
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn btn-ghost" onClick={onCancel}>取消</button>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy || !nickname.trim()} onClick={() => onSave(nickname.trim(), ageBand)}>保存资料</button>
      </div>
    </section>
  );
}

function AddMemory({ onAdd }: { onAdd: (content: string) => void }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  return (
    <div style={{ marginTop: 12 }}>
      {open ? (
        <div>
          <textarea className="textarea" value={content} maxLength={500} onChange={(e) => setContent(e.target.value)} placeholder="例如：重要考试前我会特别紧张，希望小在不要急着让我放松，先陪我说说话。" />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { setOpen(false); setContent(""); }}>取消</button>
            <button className="btn btn-primary btn-sm" disabled={!content.trim()} onClick={() => { onAdd(content.trim()); setContent(""); setOpen(false); }}>让小在记住</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-soft btn-sm" onClick={() => setOpen(true)}><Plus size={15} />加一条我想让小在记住的</button>
      )}
    </div>
  );
}

function MemoryRow({ memory, onUpdate, onDelete }: {
  memory: AiMemoryRow;
  onUpdate: (id: string, content?: string, visible?: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(memory.content);
  return (
    <div className="soft-card" style={{ padding: "10px 12px" }}>
      <div className="row-start gap-6">
        <button className="icon-btn" aria-label={memory.visible ? "暂时隐藏" : "恢复显示"} onClick={() => onUpdate(memory.id, undefined, !memory.visible)}>
          {memory.visible ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
        {editing ? (
          <div style={{ flex: 1 }}>
            <textarea className="textarea" style={{ minHeight: 62 }} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />
            <div className="row" style={{ marginTop: 6 }}>
              <button className="link" onClick={() => { setEditing(false); setText(memory.content); }}>取消</button>
              <button className="btn btn-soft btn-sm" onClick={() => { onUpdate(memory.id, text.trim()); setEditing(false); }}>保存</button>
            </div>
          </div>
        ) : (
          <p style={{ margin: 0, flex: 1, fontSize: 13.5, lineHeight: 1.6, opacity: memory.visible ? 1 : 0.55 }}>{memory.content}</p>
        )}
        {!editing ? (
          <>
            <button className="icon-btn" aria-label="修改" onClick={() => setEditing(true)}><Pencil size={15} /></button>
            <button className="icon-btn" aria-label="删除" onClick={() => onDelete(memory.id)}><Trash2 size={15} /></button>
          </>
        ) : null}
      </div>
      {!editing ? <div className="tiny muted" style={{ marginTop: 4 }}>{memory.visible ? "小在会参考" : "暂时隐藏，不用于陪伴"}</div> : null}
    </div>
  );
}

function VoiceSettings() {
  const [settings, setSettings] = useState({ autoPlay: false, speed: "natural" });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings/voice")
      .then((r) => { if (!r.ok) throw new Error("settings"); return r.json(); })
      .then((data) => {
        setSettings(data);
        setLoaded(true);
      })
      .catch(() => { setLoaded(true); setError("声音设置暂时没能读取，请刷新后重试。"); });
  }, []);

  async function update(patch: Partial<{ autoPlay: boolean; speed: string }>) {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/settings/voice", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error("settings");
      setSettings(await response.json());
    } catch { setError("设置没有保存成功，仍保留原来的选择，请重试。"); }
    finally { setSaving(false); }
  }

  if (!loaded) return null;

  return (
    <section className="card">
      <div className="row">
        <div>
          <div style={{ fontWeight: 750 }}>小在的声音</div>
          <p className="tiny muted" style={{ margin: "4px 0 0" }}>小在的声音由 AI 合成。首次点播放或发送消息后，可自动听后续回复。</p>
        </div>
        <Volume2 size={21} style={{ color: "#a8794b" }} />
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <span>自动播放小在语音</span>
        <input type="checkbox" className="switch" disabled={saving} checked={settings.autoPlay} onChange={(e) => update({ autoPlay: e.target.checked })} aria-label="自动播放小在语音" />
      </div>
      <label className="label">语速</label>
      <div className="row wrap gap-6">
        {(["slow", "natural", "fast"] as const).map((speed) => (
          <button key={speed} type="button" disabled={saving} className={`pill ${settings.speed === speed ? "active" : ""}`} onClick={() => update({ speed })}>
            {speed === "slow" ? "慢一点" : speed === "natural" ? "自然" : "快一点"}
          </button>
        ))}
      </div>
      {error ? <p className="tiny muted" role="status">{error}</p> : null}
    </section>
  );
}
