"use client";

import { useState } from "react";
import { Plus, Trash2, UserRound, ShieldCheck, BellRing, X, Send, Undo2, Eye } from "lucide-react";
import type { PublicUser, GuardianRow, NotificationEventRow, GuardianPermissions, SharedFields } from "@/lib/data-access";
import { formatDay, formatTime } from "@/components/ui";

type EventRow = NotificationEventRow;

export default function GuardiansClient({
  user,
  initialGuardians,
  initialEvents,
}: {
  user: PublicUser;
  initialGuardians: GuardianRow[];
  initialEvents: EventRow[];
}) {
  const [guardians, setGuardians] = useState(initialGuardians);
  const [events, setEvents] = useState(initialEvents);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState("");
  const [showAudit, setShowAudit] = useState(false);
  const [preview, setPreview] = useState<{ guardian: GuardianRow; fields: SharedFields } | null>(null);

  function notify(text: string) {
    setToast(text);
    setTimeout(() => setToast(""), 3000);
  }

  async function addGuardian(input: {
    displayName: string;
    relationship: string;
    contactHint?: string;
    personalMessage: string;
    notifyOnHighRisk: boolean;
  }) {
    const res = await fetch("/api/guardians", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "没有添加成功");
    setGuardians((prev) => [...prev, data.guardian]);
    setAdding(false);
  }

  async function patchPermissions(guardianId: string, patch: Partial<GuardianPermissions>) {
    const res = await fetch("/api/guardians", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guardianId, ...patch }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "更新没有成功");
    setGuardians((prev) => prev.map((g) => (g.id === guardianId ? data.guardian : g)));
  }

  async function remove(guardianId: string) {
    if (!confirm("移出守护圈后，将不再保留这位守护人的授权配置。确定移除吗？")) return;
    const res = await fetch("/api/guardians", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guardianId }),
    });
    if (res.ok) {
      setGuardians((prev) => prev.filter((g) => g.id !== guardianId));
      notify("已移出守护圈");
    }
  }

  async function eventAction(eventId: string, action: "send" | "cancel") {
    const res = await fetch(`/api/notifications/${eventId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error || "操作没有成功");
      return;
    }
    setEvents((prev) => prev.map((e) => (e.id === eventId ? data.event : e)));
    notify(action === "send" ? "模拟通知已发送给守护人" : "这条通知已撤销，并保留审计记录");
  }

  const pendingCount = events.filter((e) => e.status === "pending").length;

  return (
    <div className="stack">
      <section className="soft-card row" style={{ alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 750 }}>加入守护圈 ≠ 自动收到通知</div>
          <p className="tiny muted" style={{ margin: "5px 0 0", lineHeight: 1.65 }}>
            每位守护人都要单独开启“高风险时允许联系”。小在不会在没有授权的情况下发送任何通知，也默认不分享聊天原文。
          </p>
        </div>
        <ShieldCheck size={22} style={{ color: "#6c8a72", flex: "0 0 auto" }} />
      </section>

      <section className="row">
        <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)} disabled={adding}>
          <Plus size={16} />
          添加守护人
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowAudit((v) => !v)}>
          <Eye size={15} />
          通知审计（{events.length}）
        </button>
      </section>

      {adding ? <AddGuardianForm user={user} onCancel={() => setAdding(false)} onSubmit={async (data) => {
        try {
          await addGuardian(data);
          notify("守护人添加好了，接下来单独设置 TA 的权限");
        } catch (e) {
          notify(e instanceof Error ? e.message : "没有添加成功");
        }
      }} /> : null}

      {guardians.length === 0 ? (
        <section className="card empty">
          <UserRound size={34} style={{ margin: "0 auto 10px", color: "#d0b293", display: "block" }} />
          <p>守护圈还是空的。<br />添加一位你信任的人，让 TA 在真正需要时成为你的现实支持。</p>
        </section>
      ) : guardians.map((guardian) => (
        <GuardianCard
          key={guardian.id}
          guardian={guardian}
          onPatch={async (patch) => {
            try {
              await patchPermissions(guardian.id, patch);
            } catch (e) {
              notify(e instanceof Error ? e.message : "更新没有成功");
            }
          }}
          onRemove={() => remove(guardian.id)}
          onPreview={() => setPreview({ guardian, fields: visibleFields(guardian) })}
        />
      ))}

      {pendingCount > 0 ? (
        <section className="notice warn">
          <div className="row">
            <div style={{ fontWeight: 750 }}>有 {pendingCount} 条待处理守护通知</div>
            <BellRing size={18} />
          </div>
          <p style={{ margin: "6px 0 0" }}>高风险记录触发后只会先进入“待确认”。你可以模拟发送，也可以撤销；两种操作都会留下审计记录。</p>
        </section>
      ) : null}

      {showAudit ? (
        <NotificationAudit events={events} onAction={eventAction} />
      ) : events.length ? (
        <button className="link" style={{ alignSelf: "center" }} onClick={() => setShowAudit(true)}>查看通知记录与状态</button>
      ) : null}

      {preview ? <SharedFieldsPreview guardian={preview.guardian} onClose={() => setPreview(null)} /> : null}
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

function visibleFields(guardian: GuardianRow): SharedFields {
  const p = guardian.permissions;
  const fields: SharedFields = {};
  if (p.shareNeedSupport) fields.needSupport = true;
  if (p.shareRiskLevel) fields.riskLevel = "较高（仅供安全支持参考，非诊断）";
  if (p.shareEmotionLabels) fields.emotionLabels = ["（按当天记录填充）"];
  if (p.shareTrend) fields.trend = "（最近记录趋势）";
  if (p.shareStressor) fields.stressor = "（压力来源）";
  if (p.personalMessage) fields.personalMessage = p.personalMessage;
  return fields;
}

const PERMISSION_ROWS: Array<{ key: keyof GuardianPermissions; label: string; help: string; hidden?: boolean }> = [
  { key: "notifyOnHighRisk", label: "高风险时允许联系", help: "达到高风险且满足触发条件时，才会考虑通知 TA" },
  { key: "shareNeedSupport", label: "分享“需要陪伴”信号", help: "只告诉 TA 你需要有人陪，不包含细节" },
  { key: "shareRiskLevel", label: "分享风险等级", help: "可让 TA 知道风险提示为“较高”" },
  { key: "shareEmotionLabels", label: "分享主要情绪标签", help: "例如低落、无助（不分享触发细节）" },
  { key: "shareTrend", label: "分享持续低落等趋势", help: "仅展示最近趋势描述" },
  { key: "shareStressor", label: "分享压力来源", help: "默认关闭；开启后才会分享触发场景" },
];

function PermissionToggle({ row, value, onChange }: { row: typeof PERMISSION_ROWS[number]; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="row" style={{ alignItems: "flex-start", padding: "8px 0" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 650, fontSize: 14 }}>{row.label}</div>
        <div className="tiny muted" style={{ marginTop: 2, lineHeight: 1.5 }}>{row.help}</div>
      </div>
      <input type="checkbox" className="switch" checked={value} onChange={(e) => onChange(e.target.checked)} aria-label={row.label} />
    </div>
  );
}

function GuardianCard({ guardian, onPatch, onRemove, onPreview }: {
  guardian: GuardianRow;
  onPatch: (patch: Partial<GuardianPermissions>) => void;
  onRemove: () => void;
  onPreview: () => void;
}) {
  const p = guardian.permissions;
  const [showMore, setShowMore] = useState(false);
  const [personalMessage, setPersonalMessage] = useState(p.personalMessage);

  async function saveMessage() {
    await onPatch({ personalMessage });
  }

  return (
    <section className="card">
      <div className="row">
        <div className="row-start gap-10">
          <span className="avatar-btn" style={{ width: 46, height: 46, fontSize: 19 }}>{guardian.displayName.slice(0, 1)}</span>
          <div>
            <div style={{ fontWeight: 750 }}>{guardian.displayName}</div>
            <div className="tiny muted">{guardian.relationship}{guardian.contactHint ? ` · ${guardian.contactHint}` : ""}</div>
          </div>
        </div>
        <button className="icon-btn" aria-label="移除守护人" onClick={onRemove}><Trash2 size={17} /></button>
      </div>

      <div className="divider" style={{ margin: "12px 0" }} />
      <div className="stack" style={{ gap: 2 }}>
        {PERMISSION_ROWS.map((row) => (
          <PermissionToggle
            key={row.key}
            row={row}
            value={Boolean(p[row.key])}
            onChange={(value) => onPatch({ [row.key]: value } as Partial<GuardianPermissions>)}
          />
        ))}
      </div>

      <button className="link" style={{ marginTop: 4 }} onClick={() => setShowMore((v) => !v)}>
        {showMore ? "收起预留给 TA 的话" : "写一句预留给 TA 的话"}
      </button>
      {showMore ? (
        <div style={{ marginTop: 10 }}>
          <textarea
            className="textarea"
            value={personalMessage}
            maxLength={200}
            placeholder="例如：如果有一天你收到这条通知，不用急着帮我解决问题。陪我说说话就好。"
            onChange={(e) => setPersonalMessage(e.target.value)}
          />
          <button className="btn btn-soft btn-sm" style={{ marginTop: 8 }} onClick={saveMessage}>保存这句话</button>
          <button className="link" style={{ marginLeft: 12 }} onClick={onPreview}>看看 TA 会看到什么</button>
        </div>
      ) : null}
    </section>
  );
}

function AddGuardianForm({ user: _user, onCancel, onSubmit }: {
  user: PublicUser;
  onCancel: () => void;
  onSubmit: (data: {
    displayName: string;
    relationship: string;
    contactHint?: string;
    personalMessage: string;
    notifyOnHighRisk: boolean;
  }) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [contactHint, setContactHint] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [notifyOnHighRisk, setNotifyOnHighRisk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <section className="card" style={{ borderColor: "#eacba4" }}>
      <div className="row">
        <strong>添加守护人</strong>
        <button className="icon-btn" onClick={onCancel} aria-label="关闭"><X size={18} /></button>
      </div>
      <label className="label">称呼</label>
      <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="例如：妈妈 / 阿树" />
      <label className="label">你们的关系</label>
      <input className="input" value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="例如：家人 / 好友 / 伴侣" />
      <label className="label">联系方式提示（可选）</label>
      <input className="input" value={contactHint} onChange={(e) => setContactHint(e.target.value)} placeholder="不会展示给其他守护人" />
      <label className="label">预留给 TA 的一句话（可选）</label>
      <textarea className="textarea" value={personalMessage} onChange={(e) => setPersonalMessage(e.target.value)} placeholder="如果有一天你收到这条通知…" maxLength={200} />
      <div className="divider" style={{ margin: "12px 0" }} />
      <PermissionToggle row={{ key: "notifyOnHighRisk", label: "现在就允许高风险时联系 TA", help: "需要你主动打开。未打开时，即使遇到高风险也不会通知这位守护人。" }} value={notifyOnHighRisk} onChange={setNotifyOnHighRisk} />
      {error ? <p className="tiny" style={{ color: "#b2583d" }}>{error}</p> : null}
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn btn-ghost" onClick={onCancel}>先不加了</button>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy || !displayName.trim() || !relationship.trim()} onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await onSubmit({ displayName: displayName.trim(), relationship: relationship.trim(), contactHint: contactHint.trim() || undefined, personalMessage, notifyOnHighRisk });
          } catch (e) {
            setError(e instanceof Error ? e.message : "添加失败");
          } finally {
            setBusy(false);
          }
        }}>{busy ? "等一下…" : "添加并设置权限"}</button>
      </div>
    </section>
  );
}

function NotificationAudit({ events, onAction }: { events: EventRow[]; onAction: (id: string, action: "send" | "cancel") => void }) {
  if (!events.length) return <section className="card empty">还没有通知记录。高风险记录且满足授权后，这里会出现完整的审计轨迹。</section>;
  return (
    <section className="stack" style={{ gap: 10 }}>
      {events.map((event) => (
        <article key={event.id} className="card" style={{ padding: 14 }}>
          <div className="row">
            <div>
              <strong>{event.guardianName}</strong>
              <span className="tiny muted"> · {event.relationship}</span>
            </div>
            <span className={`status-chip status-${event.status}`}>
              {event.status === "pending" ? "待确认" : event.status === "sent" ? "已发送" : "已撤销"}
            </span>
          </div>
          <p className="tiny muted" style={{ margin: "6px 0 2px" }}>
            {formatDay(event.createdAt)} {formatTime(event.createdAt)} · 触发：{event.triggerType === "high_risk_record" ? "高风险记录" : event.triggerType}
          </p>
          <div className="soft-card" style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.6 }}>
            {describeShared(event.sharedFields)}
          </div>
          {event.status === "pending" ? (
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn btn-soft btn-sm" onClick={() => onAction(event.id, "cancel")}><Undo2 size={14} /> 撤销</button>
              <button className="btn btn-primary btn-sm" onClick={() => onAction(event.id, "send")}><Send size={14} /> 模拟发送</button>
            </div>
          ) : null}
          {event.sentAt ? <p className="tiny muted" style={{ margin: "8px 0 0" }}>发送时间：{formatDay(event.sentAt)} {formatTime(event.sentAt)}</p> : null}
          {event.cancelledAt ? <p className="tiny muted" style={{ margin: "8px 0 0" }}>撤销时间：{formatDay(event.cancelledAt)} {formatTime(event.cancelledAt)}</p> : null}
        </article>
      ))}
    </section>
  );
}

function describeShared(fields: SharedFields): string {
  const parts: string[] = [];
  if (fields.needSupport) parts.push("需要陪伴信号");
  if (fields.riskLevel) parts.push("风险等级");
  if (fields.emotionLabels?.length) parts.push("主要情绪标签");
  if (fields.trend) parts.push("最近趋势");
  if (fields.stressor) parts.push("压力来源");
  if (fields.personalMessage) parts.push("你预留的一句话");
  if (!parts.length) parts.push("没有分享任何具体字段");
  return `允许分享：${parts.join("、")}${fields.supportCard ? "；附带支持卡" : ""}`;
}

function SharedFieldsPreview({ guardian, onClose }: { guardian: GuardianRow; onClose: () => void }) {
  const p = guardian.permissions;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(70,50,35,.25)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 30, padding: 14 }}>
      <section className="card" style={{ width: "min(480px, 100%)", background: "#fffdf8" }}>
        <div className="row">
          <strong>守护人视角预览</strong>
          <button className="icon-btn" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </div>
        <div className="bubble xiaozai" style={{ maxWidth: "100%", marginTop: 12, background: "#fffaf1" }}>
          <p style={{ margin: 0 }}>小在的陪伴提醒：TA 最近可能正经历较强烈的情绪压力。如果方便，请主动联系一下 TA。</p>
          <p className="tiny muted" style={{ margin: "8px 0 0" }}>以下仅包含 TA 事前授权分享的信息：</p>
          <ul className="tiny" style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.8 }}>
            {p.shareNeedSupport ? <li>需要陪伴信号</li> : null}
            {p.shareRiskLevel ? <li>风险提示（较高）</li> : null}
            {p.shareEmotionLabels ? <li>主要情绪（低落 / 无助）</li> : null}
            {p.shareTrend ? <li>最近趋势描述</li> : null}
            {p.shareStressor ? <li>压力来源</li> : null}
            {p.personalMessage ? <li>TA 留给你：“{p.personalMessage}”</li> : null}
          </ul>
          <p className="tiny muted" style={{ margin: "10px 0 0" }}>不包含聊天原文；这条内容受《有我在》授权边界约束。</p>
        </div>
      </section>
    </div>
  );
}
