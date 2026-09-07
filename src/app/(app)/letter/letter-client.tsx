"use client";

import { useState } from "react";
import { Feather, RefreshCw, Sprout, Check } from "lucide-react";
import { formatDay } from "@/components/ui";
import { VoiceButton } from "@/components/voice-player";

type Chart = {
  days: Array<{ day: string; intensity: number; labels: string[]; records: number }>;
  labelDistribution: Array<{ label: string; count: number; percent: number }>;
  recordCount: number;
  activeDays: number;
  avgIntensity: number;
};

type Milestone = { title: string; achieved: boolean; date?: string };
type LetterPayload = {
  letter: {
    summaryText: string;
    insightText: string;
    nextWeekPromise: string;
    periodStart: string;
    periodEnd: string;
    createdAt: string;
  };
  chart: Chart;
  milestones: Milestone[];
};

export default function LetterClient({ initialPayload, nickname }: { initialPayload: LetterPayload | null; nickname: string }) {
  const [payload, setPayload] = useState(initialPayload);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function generate() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/letter", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "暂时还没写出来");
      setPayload(data.payload);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "暂时还没写出来");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <section className="card row">
        <div>
          <div style={{ fontWeight: 750 }}>给小在一点时间，把这一周读一遍</div>
          <p className="tiny muted" style={{ margin: "5px 0 0" }}>信只依据你保存过的心情记录生成，没有记录就没有“发现”。</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={generate} disabled={busy}>
          <RefreshCw size={15} className={busy ? "floaty" : ""} />
          {busy ? "正在读…" : "写一封"}
        </button>
      </section>

      {message ? <div className="notice warn">{message}</div> : null}

      {!payload ? (
        <section className="card empty">
          <Feather size={34} style={{ margin: "0 auto 12px", color: "#d9a36c", display: "block" }} />
          <p>这一周的信还没有落笔。<br />先去记录几段心情，小在会把它们认真读一遍。</p>
        </section>
      ) : (
        <>
          <GrowthAlbum milestones={payload.milestones} />
          <section className="card row">
            <div>
              <div style={{ fontWeight: 750 }}>这封信，小在也可以读给你听</div>
              <p className="tiny muted" style={{ margin: "4px 0 0" }}>慢慢读，没有背景音乐，只是陪你听这一周</p>
            </div>
            <VoiceButton text={payload.letter.summaryText} scene="weekly_letter" speed="slow" label="听小在读给我听" />
          </section>
          <article className="letter-paper">
            <div className="row-start gap-10" style={{ marginBottom: 10 }}>
              <MascotStamp />
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{nickname}，见字如面</div>
                <div className="tiny muted">{formatDay(payload.letter.periodStart)} — {formatDay(payload.letter.periodEnd)}</div>
              </div>
            </div>
            <div style={{ fontFamily: "inherit" }}>{payload.letter.summaryText}</div>
            <hr className="divider" />
            <div style={{ fontWeight: 800 }}>情绪足迹</div>
            <div className="tiny muted" style={{ margin: "4px 0 10px" }}>
              {payload.chart.recordCount} 段记录 · {payload.chart.activeDays} 天 · 平均强度 {payload.chart.avgIntensity}/10
            </div>
            <TrendBars chart={payload.chart} />
            <LabelBar chart={payload.chart} />
            <hr className="divider" />
            <div style={{ fontWeight: 800 }}>我发现了一个小规律</div>
            <p style={{ margin: "6px 0 0" }}>{payload.letter.insightText}</p>
            <div style={{ fontWeight: 800, marginTop: 16 }}>下周的小约定</div>
            <p style={{ margin: "6px 0 0" }}>{payload.letter.nextWeekPromise}</p>
            <hr className="divider" />
            <p className="muted" style={{ margin: 0 }}>—— 有我在，小在</p>
          </article>
        </>
      )}
    </div>
  );
}

function MascotStamp() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden style={{ flex: "0 0 auto" }}>
      <circle cx="26" cy="27" r="17" fill="#E8C391" />
      <ellipse cx="26" cy="29" rx="15" ry="11" fill="#F0D6AC" />
      <circle cx="21" cy="26" r="2.4" fill="#4C3B31" />
      <circle cx="31" cy="26" r="2.4" fill="#4C3B31" />
      <ellipse cx="26" cy="34" rx="5" ry="3.4" fill="#A9663E" />
      <path d="M23 36 Q26 39 29 36" stroke="#7E4A2F" strokeWidth="1.5" fill="none" />
      <path d="M24 10 L26 4 L28 10" fill="#84A97A" />
    </svg>
  );
}

function TrendChart({ chart }: { chart: Chart }) {
  const max = Math.max(1, ...chart.days.map((d) => d.intensity));
  return (
    <section className="card">
      <div className="row">
        <div>
          <div style={{ fontWeight: 750 }}>情绪足迹</div>
          <p className="tiny muted" style={{ margin: "4px 0 0" }}>你愿意开口的日子，都在这里留下痕迹</p>
        </div>
        <Sprout size={22} style={{ color: "#9cbfa5" }} />
      </div>
      <div className="chart-bars" style={{ marginTop: 12 }}>
        {chart.days.length === 0 ? <div className="muted center" style={{ flex: 1 }}>还没有记录</div> : chart.days.map((d) => (
          <div className="chart-bar" key={d.day}>
            <span className="tiny muted" style={{ lineHeight: 1.2, textAlign: "center" }}>{d.intensity}</span>
            <div className="fill" style={{ height: `${Math.max(8, (d.intensity / max) * 80)}%`, background: d.intensity >= 7 ? "linear-gradient(180deg,#e2a079,#c96f3f)" : "linear-gradient(180deg,#efc69a,#d98c4f)" }} />
            <span className="day-label">{new Date(d.day + "T12:00:00").getDate()}日</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function TrendBars({ chart }: { chart: Chart }) {
  return <TrendChart chart={chart} />;
}

function LabelBar({ chart }: { chart: Chart }) {
  const top = chart.labelDistribution.slice(0, 5);
  if (!top.length) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div className="tiny muted" style={{ marginBottom: 6 }}>主要出现的情绪</div>
      {top.map((item) => (
        <div key={item.label} className="row" style={{ marginBottom: 5 }}>
          <span className="tiny" style={{ width: 56, flex: "0 0 auto" }}>{item.label}</span>
          <div style={{ flex: 1, height: 9, background: "#f3e8db", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ width: `${Math.max(4, item.percent)}%`, height: "100%", background: "#dc9a62", borderRadius: 99 }} />
          </div>
          <span className="tiny muted">{item.percent}%</span>
        </div>
      ))}
    </div>
  );
}

function GrowthAlbum({ milestones }: { milestones: Milestone[] }) {
  return (
    <section className="card" style={{ background: "#fdf6ea" }}>
      <div style={{ fontWeight: 750 }}>成长相册 · 这些日子我们一起走过</div>
      <p className="tiny muted" style={{ margin: "4px 0 12px" }}>这里没有排名，只有你真正走过的节点</p>
      <div className="stack" style={{ gap: 8 }}>
        {milestones.map((m) => (
          <div key={m.title} className="row-start gap-10" style={{ opacity: m.achieved ? 1 : 0.68 }}>
            <span style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: m.achieved ? "#dcebe0" : "#f0e7dc",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: m.achieved ? "#55745d" : "#b6a99b",
              flex: "0 0 auto"
            }}>
              {m.achieved ? <Check size={14} /> : <span style={{ fontSize: 11 }}>·</span>}
            </span>
            <span style={{ fontSize: 13.5 }}>{m.title}</span>
            {m.date ? <span className="tiny muted" style={{ marginLeft: "auto" }}>{formatDay(m.date)}</span> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
