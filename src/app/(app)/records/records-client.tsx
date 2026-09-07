"use client";

import { useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { RiskPill, formatDay, formatTime } from "@/components/ui";
import type { EmotionRecordRow } from "@/lib/data-access";

const LABELS = ["开心", "安心", "平静", "委屈", "难过", "低落", "失落", "焦虑", "烦躁", "生气", "疲惫", "孤独", "无助", "迷茫", "压抑", "愧疚"];

export default function RecordsClient({ initialRecords }: { initialRecords: EmotionRecordRow[] }) {
  const [records, setRecords] = useState(initialRecords);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  function notify(text: string) {
    setToast(text);
    setTimeout(() => setToast(""), 2600);
  }

  async function remove(id: string) {
    const res = await fetch(`/api/records/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRecords((prev) => prev.filter((r) => r.id !== id));
      notify("这条记录已经删除");
    }
  }

  return (
    <div className="stack">
      {records.map((record) =>
        editingId === record.id ? (
          <EditCard key={record.id} record={record} onDone={(updated) => {
            setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            setEditingId(null);
            notify("记录更新好了");
          }} />
        ) : (
          <article key={record.id} className="card" style={{ padding: 16 }}>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <div>
                <div className="row-start gap-6">
                  <strong>{formatDay(record.createdAt)}</strong>
                  <span className="tiny muted">{formatTime(record.createdAt)}</span>
                  <RiskPill level={record.riskLevel} />
                </div>
                <div className="row wrap gap-6" style={{ marginTop: 8 }}>
                  {record.emotionLabels.map((label) => <span key={label} className="pill warm">{label}</span>)}
                  <span className="pill blue">强度 {record.intensity}/10</span>
                </div>
              </div>
              <div className="row-start gap-6" style={{ flex: "0 0 auto" }}>
                <button className="icon-btn" aria-label="修改" onClick={() => setEditingId(record.id)}><Pencil size={16} /></button>
                <button className="icon-btn" aria-label="删除" onClick={() => remove(record.id)}><Trash2 size={16} /></button>
              </div>
            </div>
            <div style={{ marginTop: 10, lineHeight: 1.7, fontSize: 14 }}>
              <span className="muted">触发：</span>{record.trigger}
            </div>
            {record.thought ? (
              <div style={{ marginTop: 6, lineHeight: 1.6, fontSize: 13.5 }}><span className="muted">想法：</span>{record.thought}</div>
            ) : null}
            {record.response ? (
              <div style={{ marginTop: 6, lineHeight: 1.6, fontSize: 13.5 }}><span className="muted">反应：</span>{record.response}</div>
            ) : null}
            <div className="soft-card" style={{ marginTop: 10, fontSize: 13.5, lineHeight: 1.65 }}>{record.summary}</div>
          </article>
        )
      )}
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

function EditCard({ record, onDone }: { record: EmotionRecordRow; onDone: (r: EmotionRecordRow) => void }) {
  const [labels, setLabels] = useState(record.emotionLabels);
  const [intensity, setIntensity] = useState(record.intensity);
  const [trigger, setTrigger] = useState(record.trigger);
  const [thought, setThought] = useState(record.thought);
  const [response, setResponse] = useState(record.response);
  const [summary, setSummary] = useState(record.summary);
  const [saving, setSaving] = useState(false);

  function toggle(label: string) {
    setLabels((prev) => prev.includes(label) ? prev.filter((l) => l !== label) : prev.length >= 3 ? prev : [...prev, label]);
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/records/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emotionLabels: labels, intensity, trigger, thought, response, summary, riskLevel: record.riskLevel }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) onDone(data.record);
  }

  return (
    <section className="card" style={{ borderColor: "#efd6b5" }}>
      <div className="row">
        <strong>修改这段心情</strong>
        <button className="icon-btn" onClick={() => onDone(record)} aria-label="关闭"><X size={18} /></button>
      </div>
      <div className="divider" style={{ margin: "12px 0" }} />
      <div className="row wrap gap-6">
        {LABELS.map((l) => <button key={l} type="button" className={`pill ${labels.includes(l) ? "active" : ""}`} onClick={() => toggle(l)}>{l}</button>)}
      </div>
      <label className="label">强度：{intensity} / 10</label>
      <input type="range" min={1} max={10} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} style={{ width: "100%", accentColor: "#e59a5e" }} />
      <label className="label">主要触发事件</label>
      <input className="input" value={trigger} onChange={(e) => setTrigger(e.target.value)} />
      <label className="label">想法</label>
      <textarea className="textarea" value={thought} onChange={(e) => setThought(e.target.value)} />
      <label className="label">身体或行为反应</label>
      <textarea className="textarea" value={response} onChange={(e) => setResponse(e.target.value)} />
      <label className="label">小结</label>
      <textarea className="textarea" value={summary} onChange={(e) => setSummary(e.target.value)} />
      <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={save} disabled={saving || labels.length === 0}>保存修改</button>
    </section>
  );
}
