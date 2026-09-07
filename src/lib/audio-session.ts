const KEY = "ywz_audio_unlocked";
const BLOCKED_NOTICE_KEY = "ywz_audio_blocked_notice_shown";

type BrowserAudioContext = AudioContext & { state: AudioContextState };

let audioContext: BrowserAudioContext | null = null;
let gestureUnlocked = false;
let blockedNoticeShown = false;
const listeners = new Set<(unlocked: boolean) => void>();

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function notify(): void {
  const unlocked = isAudioUnlocked();
  for (const listener of listeners) listener(unlocked);
}

export function getAudioContext(): BrowserAudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioContext && audioContext.state !== "closed") return audioContext;
  const AudioContextCtor = window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;
  audioContext = new AudioContextCtor() as BrowserAudioContext;
  audioContext.addEventListener("statechange", notify);
  return audioContext;
}

/** Must be called directly from a user gesture (send, Enter, or the play button). */
export async function unlockAudioSession(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const context = getAudioContext();
    if (!context) return false;
    if (context.state !== "running") {
      await Promise.race([
        context.resume(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("unlock_timeout")), 2000); }),
      ]);
    }
    const unlocked = context.state === "running";
    gestureUnlocked = unlocked;
    try { if (unlocked) storage()?.setItem(KEY, "true"); } catch { /* Storage may be disabled. */ }
    notify();
    return unlocked;
  } catch {
    gestureUnlocked = false;
    notify();
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function isAudioUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  // sessionStorage is a hint only. A reload creates a new, suspended context and
  // therefore needs a fresh user gesture before it is safe to autoplay again.
  return gestureUnlocked && audioContext?.state === "running";
}

export function subscribeAudioUnlock(listener: (unlocked: boolean) => void): () => void {
  listeners.add(listener);
  listener(isAudioUnlocked());
  return () => listeners.delete(listener);
}

export function clearAudioUnlock(): void {
  gestureUnlocked = false;
  blockedNoticeShown = false;
  try { storage()?.removeItem(KEY); storage()?.removeItem(BLOCKED_NOTICE_KEY); } catch { /* optional */ }
  notify();
}

export function shouldAutoPlay(autoPlayEnabled: boolean, unlocked: boolean): boolean {
  return autoPlayEnabled && unlocked;
}

export function shouldShowBlockedNotice(): boolean {
  if (blockedNoticeShown) return false;
  blockedNoticeShown = true;
  return true;
}
