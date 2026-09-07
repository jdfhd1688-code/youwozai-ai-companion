"use client";

import { useEffect, useRef, useState } from "react";
import { Send, RotateCcw, Mic, PencilLine, Phone, LifeBuoy, HeartHandshake } from "lucide-react";
import Mascot from "@/components/mascot";
import { VoiceButton, useVoiceSnapshot } from "@/components/voice-player";
import { voicePlayback } from "@/lib/voice-playback";
import type { VoiceSpeed } from "@/lib/voice";
import { SAFETY_ACTIONS, SAFETY_DETAILS } from "@/lib/safety-content";
import {
  isAudioUnlocked,
  shouldAutoPlay,
  subscribeAudioUnlock,
  unlockAudioSession,
} from "@/lib/audio-session";
import type { PublicUser, StructuredDraft } from "@/lib/data-access";

type Bubble = {
  id: string;
  role: "user" | "xiaozai";
  content: string;
  type?: "chat" | "draft" | "safety";
  draft?: StructuredDraft | null;
};

const EXPRESSION_PROMPTS = [
  "今天有点累",
  "有件事想吐槽",
  "其实我也说不清楚……",
];

export default function ChatClient({ user, opening }: { user: PublicUser; opening: string }) {
  const voice = useVoiceSnapshot();
  const [bubbles, setBubbles] = useState<Bubble[]>([
    { id: "opening", role: "xiaozai", content: opening, type: "chat" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [showSafety, setShowSafety] = useState(false);
  const [draftCard, setDraftCard] = useState<StructuredDraft | null>(null);
  const [lastSavedNotification, setLastSavedNotification] = useState<any>(null);
  const [voiceSettings, setVoiceSettings] = useState({ autoPlay: false, speed: "natural" as VoiceSpeed });
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const speakingBubbleId = voice.status === "playing" ? voice.ownerId : null;
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatRequestRef = useRef<AbortController | null>(null);
  const playbackEpoch = useRef(0);
  const settingsRef = useRef(voiceSettings);
  settingsRef.current = voiceSettings;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bubbles, busy, draftCard]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const unsubscribe = subscribeAudioUnlock(setAudioUnlocked);
    const controller = new AbortController();
    fetch("/api/settings/voice")
      .then((r) => { if (!r.ok) throw new Error("settings"); return r.json(); })
      .then((data) => { if (!controller.signal.aborted) setVoiceSettings(data); })
      .catch(() => undefined);
    return () => {
      playbackEpoch.current++;
      controller.abort();
      chatRequestRef.current?.abort();
      chatRequestRef.current = null;
      voicePlayback.stop();
      unsubscribe();
    };
  }, []);

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || chatRequestRef.current) return;
    // resume() is invoked before the first await, while this user gesture is active.
    const unlockPromise = unlockAudioSession();
    const epoch = ++playbackEpoch.current;
    voicePlayback.stop();
    const request = new AbortController();
    chatRequestRef.current = request;
    setInput("");
    setDraftCard(null);
    setBusy(true);
    const userBubble: Bubble = { id: `u-${Date.now()}`, role: "user", content: text, type: "chat" };
    setBubbles((prev) => [...prev, userBubble]);
    // Audio permission must never delay text chat or the safety workflow.
    void unlockPromise;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, sessionId }),
        signal: request.signal,
      });
      const data = await res.json();
      if (request.signal.aborted || chatRequestRef.current !== request) return;
      if (!res.ok) throw new Error(data.error || "没有说出去，再试一次");
      setSessionId(data.sessionId);
      const reply = data.reply as { kind: string; draft?: StructuredDraft | null };
      const bubble: Bubble = {
        id: `x-${Date.now()}`,
        role: "xiaozai",
        content: data.messages[data.messages.length - 1]?.content || data.replyText || "",
        type: reply.kind === "safety" ? "safety" : "chat",
        draft: reply.kind === "draft" || reply.kind === "safety" ? reply.draft : null,
      };
      setBubbles((prev) => [...prev, bubble]);
      void unlockPromise.then(() => {
        if (request.signal.aborted || document.hidden || epoch !== playbackEpoch.current) return;
        const settings = settingsRef.current;
        if (shouldAutoPlay(settings.autoPlay, isAudioUnlocked())) {
          void voicePlayback.play(bubble.id, bubble.content, reply.kind === "safety" ? "safety" : "chat", settings.speed);
        }
      });
      if (reply.kind === "draft" && reply.draft) {
        setDraftCard(reply.draft);
      }
      if (reply.kind === "safety" && reply.draft) {
        setDraftCard(reply.draft);
      }
      if (reply.kind === "safety") setShowSafety(true);
    } catch (err) {
      if (request.signal.aborted) return;
      setToast(err instanceof Error ? err.message : "连接有点问题，再试一次");
    } finally {
      if (chatRequestRef.current === request) {
        chatRequestRef.current = null;
        setBusy(false);
      }
    }
  }

  async function saveDraft(draft: StructuredDraft) {
    if (!sessionId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, ...draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存没有成功");
      setDraftCard(null);
      setBubbles((prev) => [
        ...prev,
        {
          id: `saved-${Date.now()}`,
          role: "xiaozai",
          content: "这段心情我已经好好收起来了。它不用立刻被解决，能被你说出来，已经很了不起。",
          type: "chat",
        },
      ]);
      setToast("这段心情保存好了");
      if (data.notification?.events?.length > 0) {
        setLastSavedNotification(data.notification);
        setToast(`已生成 ${data.notification.events.length} 条待确认守护通知`);
      } else if (draft.riskLevel === "high" && data.notification?.note) {
        setToast(data.notification.note);
      }
    } catch (err) {
      setToast(err instanceof Error ? err.message : "保存没有成功");
    } finally {
      setBusy(false);
    }
  }

  function resetChat() {
    playbackEpoch.current++;
    chatRequestRef.current?.abort();
    chatRequestRef.current = null;
    voicePlayback.stop();
    setBusy(false);
    setBubbles([]);
    setSessionId(null);
    setDraftCard(null);
    setShowSafety(false);
    setLastSavedNotification(null);
    setInput("");
  }

  return (
    <div data-audio-unlocked={audioUnlocked ? "true" : "false"} data-voice-status={voice.status} data-auto-play={voiceSettings.autoPlay ? "true" : "false"}>
      <div className="chat-list">
        {bubbles.length === 0 ? (
          <div className="center" style={{ padding: "26px 0" }}>
            <Mascot size={126} mood="smile" />
            <p className="muted">新的一段对话，从小在主动开口开始。</p>
            <button className="btn btn-primary" onClick={() => setBubbles([{ id: "opening2", role: "xiaozai", content: "报告！今天的小在已经准备好听你碎碎念啦。", type: "chat" }])}>
              让小在先开口
            </button>
          </div>
        ) : null}

        {bubbles.map((b) => (
          <div key={b.id} className="row-start gap-6" style={{ alignItems: "flex-end" }}>
            {b.role === "xiaozai" ? (
              <div className={speakingBubbleId === b.id ? "speaking-mascot" : ""} style={{ flex: "0 0 auto", width: 36 }}>
                <Mascot size={36} mood={b.type === "safety" ? "comforting" : speakingBubbleId === b.id ? "speaking" : "listening"} />
              </div>
            ) : null}
            <div
              className={`bubble ${b.role} ${b.type === "safety" ? "safety" : ""}`}
              style={b.role === "user" ? { marginLeft: "auto" } : undefined}
            >
              {b.content}
              {b.role === "xiaozai" ? (
                <div className="row-start" style={{ gap: 4, marginTop: 6 }}>
                  <VoiceButton
                    messageId={b.id}
                    text={b.content}
                    scene={b.type === "safety" ? "safety" : "chat"}
                    speed={voiceSettings.speed}
                  />
                  {speakingBubbleId === b.id ? (
                    <span className="voice-wave" aria-label="小在正在说话" role="status">
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {busy ? (
          <div className="row-start gap-6">
            <div style={{ flex: "0 0 auto", width: 36 }}>
              <Mascot size={36} mood="listen" />
            </div>
            <div className="bubble xiaozai" style={{ color: "#b4a89d" }}>小在正在认真听…</div>
          </div>
        ) : null}
      </div>

      {draftCard ? (
        <DraftEditor draft={draftCard} onCancel={() => setDraftCard(null)} onSave={saveDraft} busy={busy} />
      ) : null}

      {showSafety ? <SafetyPanel /> : null}

      {lastSavedNotification?.events?.length ? (
        <GuardianPreview result={lastSavedNotification} onClose={() => setLastSavedNotification(null)} />
      ) : null}

      <div style={{ margin: "16px 0 10px" }}>
        <p className="tiny muted" style={{ margin: "0 2px 8px" }}>不知道怎么开口，也可以先从这里开始：</p>
        <div className="stack" style={{ gap: 7 }}>
          {EXPRESSION_PROMPTS.map((prompt, i) => (
            <button key={i} className="pill row-start" style={{ width: "100%", textAlign: "left", padding: "10px 13px", justifyContent: "flex-start", whiteSpace: "normal" }} onClick={() => send(prompt)} disabled={busy}>
              <HeartHandshake size={14} style={{ flex: "0 0 auto" }} />
              <span>{prompt.slice(0, 42)}{prompt.length > 42 ? "…" : ""}</span>
            </button>
          ))}
        </div>
      </div>

      {voiceSettings.autoPlay && !audioUnlocked ? (
        <div className="audio-permission-hint tiny" role="status">
          发送消息或点一次播放，即可在本次会话中自动听小在回复
        </div>
      ) : null}

      <div className="soft-card row" style={{ marginTop: 8, position: "sticky", bottom: 84 }}>
        <input
          className="input"
          value={input}
          placeholder="想说什么都可以…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) send();
          }}
          disabled={busy}
          maxLength={1200}
        />
        <button className="icon-btn" aria-label="语音输入" title="语音输入（MVP 预留）" style={{ color: "#8ba0aa", flex: "0 0 auto" }}>
          <Mic size={20} />
        </button>
        <button className="icon-btn" aria-label="发送" onClick={() => send()} disabled={busy} style={{ background: "#e59a5e", color: "#fff", flex: "0 0 auto" }}>
          <Send size={19} />
        </button>
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn btn-ghost btn-sm" onClick={resetChat}>
          <RotateCcw size={15} />
          换一段新对话
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setToast("语音输入在 MVP 中先保留入口，后续接系统语音转文字")}>
          <PencilLine size={15} />
          打字更顺
        </button>
      </div>
      <div ref={bottomRef} />
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

const LABEL_OPTIONS = ["开心", "安心", "平静", "委屈", "难过", "低落", "失落", "焦虑", "烦躁", "生气", "疲惫", "孤独", "无助", "迷茫", "压抑", "愧疚"];

function DraftEditor({
  draft,
  onCancel,
  onSave,
  busy,
}: {
  draft: StructuredDraft;
  onCancel: () => void;
  onSave: (draft: StructuredDraft) => void;
  busy: boolean;
}) {
  const [labels, setLabels] = useState<string[]>(draft.emotionLabels);
  const [intensity, setIntensity] = useState(draft.intensity);
  const [trigger, setTrigger] = useState(draft.trigger);
  const [thought, setThought] = useState(draft.thought);
  const [response, setResponse] = useState(draft.response);
  const [summary, setSummary] = useState(draft.summary);

  function toggleLabel(label: string) {
    setLabels((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : prev.length >= 3 ? prev : [...prev, label]));
  }

  return (
    <section className="card" style={{ borderColor: "#eed2af", background: "#fffaf1" }}>
      <div className="row">
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 750 }}>小在帮你整理了一下</h2>
          <p className="tiny muted" style={{ margin: "4px 0 0" }}>保存前你都可以修改，存好后也是你的记录</p>
        </div>
        <PencilLine size={20} style={{ color: "#c8905d" }} />
      </div>

      <div className="divider" />
      <label className="label" style={{ marginTop: 0 }}>当时的情绪</label>
      <div className="row wrap gap-6">
        {LABEL_OPTIONS.map((label) => (
          <button key={label} type="button" className={`pill ${labels.includes(label) ? "active" : ""}`} onClick={() => toggleLabel(label)}>
            {label}
          </button>
        ))}
      </div>

      <label className="label">强度：{intensity} / 10</label>
      <input type="range" min={1} max={10} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} style={{ width: "100%", accentColor: "#e59a5e" }} />

      <label className="label">主要触发事件或场景</label>
      <input className="input" value={trigger} onChange={(e) => setTrigger(e.target.value)} maxLength={120} />

      <label className="label">当时冒出来的想法（没有可留空）</label>
      <textarea className="textarea" value={thought} onChange={(e) => setThought(e.target.value)} maxLength={300} />

      <label className="label">身体或行为反应（没有可留空）</label>
      <textarea className="textarea" value={response} onChange={(e) => setResponse(e.target.value)} maxLength={300} />

      <label className="label">小在帮你写的小结</label>
      <textarea className="textarea" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={500} />

      <div className="notice info tiny" style={{ marginTop: 12 }}>
        风险标记只用于小在的安全分流，不是诊断。它只展示给你，以及你明确授权的守护人。
      </div>

      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn btn-ghost" onClick={onCancel}>我想改一下</button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onSave({ emotionLabels: labels, intensity, trigger, thought, response, summary, riskLevel: draft.riskLevel })} disabled={busy || labels.length === 0}>
          保存这段心情
        </button>
      </div>
    </section>
  );
}

function GuardianPreview({ result, onClose }: { result: any; onClose: () => void }) {
  return (
    <section className="notice warn" style={{ marginTop: 14 }}>
      <div className="row">
        <strong>守护圈待确认</strong>
        <button className="icon-btn" aria-label="关闭" onClick={onClose}>×</button>
      </div>
      <p style={{ margin: "8px 0 0" }}>{result.note}</p>
      {result.events.map((event: any) => (
        <div key={event.eventId} style={{ marginTop: 8, background: "#fff8ec", borderRadius: 12, padding: "9px 11px" }}>
          <b>{event.guardianName}（{event.relationship}）</b> 收到一条“需要陪伴”提示，可在守护圈中查看预告、发送或撤销。
        </div>
      ))}
    </section>
  );
}

function SafetyPanel() {
  const [expanded, setExpanded] = useState(false);
  const [guardianHint, setGuardianHint] = useState("");

  async function checkGuardian() {
    const res = await fetch("/api/guardians");
    const data = await res.json().catch(() => ({ guardians: [] }));
    const authorized = (data.guardians || []).some((g: any) => g.permissions?.notifyOnHighRisk);
    setGuardianHint(
      authorized
        ? "你已经开启守护圈通知授权，可以在守护圈中查看授权状态和模拟通知。"
        : "这次状态不会通知任何人，因为你还没有开启守护圈通知授权。"
    );
  }

  return (
    <section className="card" style={{ marginTop: 14, borderColor: "#ebc8b8", background: "#fff8f2" }}>
      <div className="row">
        <strong style={{ color: "#8f563f" }}>小在会陪着你</strong>
        <LifeBuoy size={20} style={{ color: "#b06c4f" }} />
      </div>
      <div className="stack" style={{ gap: 9, marginTop: 12 }}>
        <button className="btn btn-soft" style={{ justifyContent: "flex-start" }} onClick={checkGuardian}>
          <Phone size={17} />
          联系我的守护人
        </button>
        <button className="btn btn-soft" style={{ justifyContent: "flex-start" }} onClick={() => setExpanded((v) => !v)}>
          <LifeBuoy size={17} />
          查看即时求助方式
        </button>
        <button className="btn btn-primary" style={{ justifyContent: "flex-start" }}>
          <HeartHandshake size={17} />
          我现在是安全的，继续陪我聊
        </button>
      </div>
      {guardianHint ? <div className="notice info" style={{ marginTop: 10 }}>{guardianHint}</div> : null}
      {expanded ? (
        <div className="notice warn" style={{ marginTop: 10, lineHeight: 1.75 }}>
          <strong>{SAFETY_DETAILS.title}</strong>
          <ul className="tiny" style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {SAFETY_DETAILS.resources.map((resource) => <li key={resource}>{resource}</li>)}
          </ul>
          <p className="tiny" style={{ margin: "8px 0 0" }}>{SAFETY_DETAILS.note}</p>
        </div>
      ) : null}
    </section>
  );
}
