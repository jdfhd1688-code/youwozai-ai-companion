import type { ReactNode } from "react";

export function RiskPill({ level }: { level: string }) {
  const tone = level === "high" ? "orange" : level === "medium" ? "blue" : "warm";
  const text = level === "high" ? "较高" : level === "medium" ? "中" : "较低";
  return <span className={`pill ${tone}`}>{text}</span>;
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div style={{ margin: "22px 2px 10px" }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{children}</h2>
      {sub ? <p className="muted tiny" style={{ margin: "4px 0 0" }}>{sub}</p> : null}
    </div>
  );
}

export function formatDay(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function formatTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
