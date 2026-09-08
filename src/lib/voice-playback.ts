import { getAudioContext, isAudioUnlocked } from "./audio-session";
import { speechRate } from "./voice";
import type { VoiceScene, VoiceSpeed } from "./voice";

export type PlaybackStatus = "idle" | "loading" | "playing" | "paused";
export type PlaybackResult = "started" | "blocked" | "unavailable" | "cancelled";
export type PlaybackSnapshot = {
  ownerId: string | null;
  status: PlaybackStatus;
  provider: "openai" | "browser" | null;
  reason: string | null;
  notice: string | null;
};
export const IDLE_SNAPSHOT: PlaybackSnapshot = {
  ownerId: null, status: "idle", provider: null, reason: null, notice: null,
};

// Dependencies make races and browser errors testable without granting fake
// browser permissions or adding a production test endpoint.
type PlaybackEnvironment = {
  context: typeof getAudioContext;
  unlocked: () => boolean;
  fetch: typeof fetch;
  synthesis: () => SpeechSynthesis | null;
  utterance: (text: string) => SpeechSynthesisUtterance;
  timeoutMs: number;
};
const environment: PlaybackEnvironment = {
  context: getAudioContext,
  unlocked: isAudioUnlocked,
  fetch: (...args) => fetch(...args),
  synthesis: () => typeof window === "undefined" ? null : window.speechSynthesis ?? null,
  utterance: (text) => new SpeechSynthesisUtterance(text),
  timeoutMs: 25000,
};

export class VoicePlaybackManager {
  private snapshot: PlaybackSnapshot = IDLE_SNAPSHOT;
  private listeners = new Set<() => void>();
  private source: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;
  private startedAt = 0;
  private offset = 0;
  private generation = 0;
  private request: AbortController | null = null;
  private speech: SpeechSynthesisUtterance | null = null;
  private cancelSpeechStart: (() => void) | null = null;
  private blockedNoticeShown = false;
  private env: PlaybackEnvironment;

  constructor(overrides: Partial<PlaybackEnvironment> = {}) {
    this.env = { ...environment, ...overrides };
  }
  getSnapshot = (): PlaybackSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private update(patch: Partial<PlaybackSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  reportBlocked(): PlaybackResult {
    this.update({
      status: "idle",
      notice: this.blockedNoticeShown ? this.snapshot.notice : "播放暂时被浏览器暂停了，点一下这条消息的播放按钮即可继续。",
    });
    this.blockedNoticeShown = true;
    return "blocked";
  }
  dismissNotice(): void { this.update({ notice: null }); }

  stop(ownerId?: string): void {
    if (ownerId && this.snapshot.ownerId !== ownerId) return;
    this.generation++;
    this.request?.abort();
    this.request = null;
    this.cancelSpeechStart?.();
    this.cancelSpeechStart = null;
    if (this.source) {
      this.source.onended = null;
      try { this.source.stop(); } catch { /* Already ended. */ }
      this.source.disconnect();
      this.source = null;
    }
    if (this.speech) {
      this.speech.onstart = this.speech.onend = this.speech.onerror = null;
      this.speech = null;
      this.env.synthesis()?.cancel();
    }
    this.buffer = null;
    this.offset = 0;
    this.update({ ownerId: null, status: "idle", provider: null, reason: null });
  }
  interrupt(): void {
    if (this.snapshot.status === "playing" && this.snapshot.ownerId) this.pause(this.snapshot.ownerId);
    else if (this.snapshot.status === "loading") this.stop();
  }

  private startBuffer(ownerId: string): PlaybackResult {
    const context = this.env.context();
    if (!this.env.unlocked() || !context || context.state !== "running" || !this.buffer) return this.reportBlocked();
    try {
      const source = context.createBufferSource();
      source.buffer = this.buffer;
      source.connect(context.destination);
      source.onended = () => {
        if (this.source !== source) return;
        source.disconnect();
        this.source = null;
        this.buffer = null;
        this.offset = 0;
        this.update({ status: "idle" });
      };
      this.source = source;
      this.startedAt = context.currentTime;
      source.start(0, this.offset);
      this.update({ ownerId, status: "playing", notice: null });
      return "started";
    } catch {
      this.source?.disconnect();
      this.source = null;
      return this.reportBlocked();
    }
  }

  private async fallback(ownerId: string, text: string, speed: VoiceSpeed, scene: VoiceScene): Promise<PlaybackResult> {
    if (!this.env.unlocked()) return this.reportBlocked();
    const synthesis = this.env.synthesis();
    if (!synthesis) {
      this.update({ status: "idle", notice: "暂时无法播放语音，文字回复已经保留，可以稍后再试。" });
      return "unavailable";
    }
    this.update({ provider: "browser" });
    const utterance = this.env.utterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = scene === "safety" ? 0.82 : speechRate(speed);
    utterance.pitch = scene === "safety" ? 0.94 : 1;
    const voices = synthesis.getVoices().filter((voice) => /^zh[-_]/i.test(voice.lang));
    utterance.voice = voices.find((voice) => /natural|natural online|xiaoxiao|晓晓/i.test(voice.name)) || voices[0] || null;
    this.speech = utterance;
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result: PlaybackResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.cancelSpeechStart = null;
        resolve(result);
      };
      const timer = setTimeout(() => {
        if (this.speech !== utterance) return finish("cancelled");
        finish("unavailable");
        this.stop(ownerId);
        this.update({ notice: "系统语音没有启动，文字已保留。请稍后点播放重试。" });
      }, 5000);
      this.cancelSpeechStart = () => finish("cancelled");
      utterance.onstart = () => {
        if (this.speech !== utterance) return;
        this.update({ ownerId, status: "playing" });
        finish("started");
      };
      utterance.onend = () => {
        if (this.speech !== utterance) return;
        this.speech = null;
        this.update({ status: "idle" });
        finish("started");
      };
      utterance.onerror = (event) => {
        if (this.speech !== utterance) return;
        this.speech = null;
        if (event.error === "not-allowed") finish(this.reportBlocked());
        else {
          this.update({ status: "idle", notice: "系统语音暂时不可用，文字已保留。" });
          finish("unavailable");
        }
      };
      try { synthesis.speak(utterance); }
      catch { utterance.onerror?.({ error: "synthesis-failed" } as SpeechSynthesisErrorEvent); }
    });
  }

  async play(ownerId: string, text: string, scene: VoiceScene, speed: VoiceSpeed): Promise<PlaybackResult> {
    this.stop();
    if (!this.env.unlocked()) return this.reportBlocked();
    const generation = this.generation;
    const current = () => generation === this.generation;
    const controller = new AbortController();
    this.request = controller;
    const timer = setTimeout(() => controller.abort(), this.env.timeoutMs);
    this.update({ ownerId, status: "loading", notice: null });
    try {
      const response = await this.env.fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, scene, speed }),
        signal: controller.signal,
      });
      if (!current()) return "cancelled";
      if (!response.ok) throw new Error("tts_http_" + response.status);
      const data = await response.json();
      if (!current()) return "cancelled";
      if (data.provider === "openai" && typeof data.dataUrl === "string") {
        this.update({ provider: "openai" });
        const context = this.env.context();
        if (!context || context.state !== "running") return this.reportBlocked();
        if (!/^data:audio\//.test(data.dataUrl)) throw new Error("invalid_audio");
        const encoded = await this.env.fetch(data.dataUrl, { signal: controller.signal }).then((r) => r.arrayBuffer());
        if (!current()) return "cancelled";
        // Keep decoded data local until we have checked the generation again.
        // A slow old decode must never overwrite a new message's pause buffer.
        const buffer = await context.decodeAudioData(encoded);
        if (!current()) return "cancelled";
        if (controller.signal.aborted) throw new Error("tts_timeout");
        this.buffer = buffer;
        return this.startBuffer(ownerId);
      }
      this.update({ reason: data.reason || "provider_unavailable" });
    } catch {
      if (!current()) return "cancelled";
      this.update({ reason: controller.signal.aborted ? "timeout" : "provider_unavailable" });
    } finally {
      clearTimeout(timer);
      if (this.request === controller) this.request = null;
    }
    if (!current()) return "cancelled";
    return this.fallback(ownerId, text, speed, scene);
  }

  pause(ownerId: string): void {
    if (this.snapshot.ownerId !== ownerId || this.snapshot.status !== "playing") return;
    if (this.speech) this.env.synthesis()?.pause();
    else {
      const context = this.env.context();
      if (!context || !this.source || !this.buffer) return;
      this.offset = Math.min(this.buffer.duration, this.offset + context.currentTime - this.startedAt);
      this.source.onended = null;
      this.source.stop();
      this.source.disconnect();
      this.source = null;
    }
    this.update({ status: "paused" });
  }
  resume(ownerId: string): PlaybackResult {
    if (this.snapshot.ownerId !== ownerId || this.snapshot.status !== "paused") return "cancelled";
    if (!this.env.unlocked()) return this.reportBlocked();
    if (this.speech) {
      this.env.synthesis()?.resume();
      this.update({ status: "playing" });
      return "started";
    }
    return this.startBuffer(ownerId);
  }
}
export const voicePlayback = new VoicePlaybackManager();
