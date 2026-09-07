"use client";

import { useEffect, useId, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { LoaderCircle, Play, Pause, RotateCcw, Square } from "lucide-react";
import type { VoiceScene, VoiceSpeed } from "@/lib/voice";
import { subscribeAudioUnlock, unlockAudioSession } from "@/lib/audio-session";
import { IDLE_SNAPSHOT, voicePlayback } from "@/lib/voice-playback";

export function useVoiceSnapshot() {
  return useSyncExternalStore(voicePlayback.subscribe, voicePlayback.getSnapshot, () => IDLE_SNAPSHOT);
}

// A single lifecycle owner also covers pending requests during navigation.
export function VoiceLifecycle() {
  const pathname = usePathname();
  const snapshot = useVoiceSnapshot();
  useEffect(() => () => voicePlayback.stop(), [pathname]);
  useEffect(() => {
    const onHidden = () => { if (document.hidden) voicePlayback.stop(); };
    const onPageHide = () => voicePlayback.stop();
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onPageHide);
    const unsubscribe = subscribeAudioUnlock((unlocked) => {
      if (!unlocked) voicePlayback.interrupt();
    });
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onPageHide);
      voicePlayback.stop();
    };
  }, []);
  return snapshot.notice ? (
    <div className="voice-notice notice info" role="status">
      {snapshot.notice}
      <button className="btn btn-ghost btn-sm" onClick={() => voicePlayback.dismissNotice()}>知道了</button>
    </div>
  ) : null;
}

export function VoiceButton({
  text, scene = "chat", speed = "natural", label, messageId,
}: {
  text: string;
  scene?: VoiceScene;
  speed?: VoiceSpeed;
  label?: string;
  messageId?: string;
}) {
  const generatedId = useId();
  const ownerId = messageId || generatedId;
  const snapshot = useVoiceSnapshot();
  const active = snapshot.ownerId === ownerId;
  const status = active ? snapshot.status : "idle";
  useEffect(() => () => voicePlayback.stop(ownerId), [ownerId]);

  async function onClick() {
    if (status === "loading") return voicePlayback.stop(ownerId);
    if (status === "playing") return voicePlayback.pause(ownerId);
    if (!(await unlockAudioSession())) {
      voicePlayback.reportBlocked();
      return;
    }
    if (status === "paused") voicePlayback.resume(ownerId);
    else await voicePlayback.play(ownerId, text, scene, speed);
  }
  const action = status === "playing" ? "暂停小在语音"
    : status === "paused" ? "继续小在语音"
    : status === "loading" ? "取消生成小在语音" : "播放小在语音";
  return (
    <span className="voice-controls" data-playback-status={status} data-provider={active ? snapshot.provider || "" : ""}>
      <button type="button" className={label ? "btn btn-soft btn-sm" : "icon-btn"}
        aria-label={action} title={action} onClick={onClick} style={{ color: "#9a6a3c" }}>
        {status === "playing" ? <Pause size={16} /> : status === "paused" ? <RotateCcw size={16} />
          : status === "loading" ? <LoaderCircle className="voice-loading" size={16} /> : <Play size={16} />}
        {label ? <span>{status === "playing" ? "暂停" : status === "paused" ? "继续" : status === "loading" ? "准备声音中（点此取消）" : label}</span> : null}
      </button>
      {status === "paused" ? <button className="icon-btn" aria-label="停止小在语音" onClick={() => voicePlayback.stop(ownerId)}><Square size={13} /></button> : null}
      {active && snapshot.provider === "browser" ? <span className="tiny muted" role="status">自然语音暂不可用，正在使用系统声音</span> : null}
      {active && snapshot.provider === "openai" ? <span className="tiny muted">小在 · AI 合成声音{scene === "safety" ? " · 安稳陪伴" : ""}</span> : null}
    </span>
  );
}
