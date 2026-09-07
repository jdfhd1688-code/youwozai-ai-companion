import { test } from "node:test";
import assert from "node:assert/strict";
import { VoicePlaybackManager } from "../src/lib/voice-playback";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
function fixture() {
  let unlocked = true;
  let active = 0;
  let maximum = 0;
  let calls = 0;
  const sources: any[] = [];
  const context = {
    state: "running", currentTime: 0,
    decodeAudioData: async () => ({ duration: 10, tag: "new" }),
    createBufferSource() {
      const source: any = {
        onended: null, buffer: null, offset: 0, stopped: false,
        connect() {}, disconnect() {},
        start(_when: number, offset: number) {
          source.offset = offset;
          active++;
          maximum = Math.max(maximum, active);
        },
        stop() { if (!source.stopped) { active--; source.stopped = true; } },
        end() { source.stop(); source.onended?.(); },
      };
      sources.push(source);
      return source;
    },
  };
  const fetchFn = (async (url: string | URL | Request) => {
    if (String(url).startsWith("data:")) return new Response(new Uint8Array([1]));
    calls++;
    return Response.json({ provider: "openai", dataUrl: "data:audio/mpeg;base64,AQ==" });
  }) as typeof fetch;
  const options = { context: () => context as unknown as AudioContext, unlocked: () => unlocked, fetch: fetchFn, synthesis: () => null };
  return { options, context, sources, calls: () => calls, maximum: () => maximum,
    setUnlocked: (value: boolean) => { unlocked = value; } };
}

test("locked audio makes no TTS request and prompts only once", async () => {
  const f = fixture(); f.setUnlocked(false);
  const player = new VoicePlaybackManager(f.options);
  assert.equal(await player.play("one", "测试", "chat", "natural"), "blocked");
  assert.equal(f.calls(), 0);
  assert.ok(player.getSnapshot().notice);
  player.dismissNotice();
  assert.equal(await player.play("one", "测试", "chat", "natural"), "blocked");
  assert.equal(player.getSnapshot().notice, null);
});

test("same message auto playback supports pause/resume without refetching", async () => {
  const f = fixture(); const player = new VoicePlaybackManager(f.options);
  await player.play("message-1", "测试", "chat", "natural");
  assert.equal(player.getSnapshot().ownerId, "message-1");
  f.context.currentTime = 3;
  player.pause("message-1");
  assert.equal(player.getSnapshot().status, "paused");
  assert.equal(player.resume("message-1"), "started");
  assert.equal(f.calls(), 1);
  assert.equal(f.sources[1].offset, 3);
  f.sources[1].end();
  assert.equal(player.getSnapshot().status, "idle");
  assert.equal(f.maximum(), 1);
});

test("rapid replacement, including same message, never overlaps", async () => {
  const f = fixture(); const player = new VoicePlaybackManager(f.options);
  await player.play("one", "测试", "chat", "natural");
  await player.play("one", "测试", "chat", "natural");
  await player.play("two", "测试", "safety", "fast");
  assert.equal(f.sources[0].stopped, true);
  assert.equal(f.sources[1].stopped, true);
  assert.equal(f.maximum(), 1);
  player.stop();
});

test("late response is discarded even when transport ignores abort", async () => {
  const f = fixture(); const pending = deferred<Response>();
  let signal: AbortSignal | undefined;
  const player = new VoicePlaybackManager({ ...f.options, fetch: (async (url, init) => {
    if (String(url) === "/api/tts" && JSON.parse(String(init?.body)).text === "old") {
      signal = init?.signal as AbortSignal;
      return pending.promise;
    }
    return f.options.fetch(url, init);
  }) as typeof fetch });
  const old = player.play("old", "old", "chat", "natural");
  await player.play("new", "new", "chat", "natural");
  assert.equal(signal?.aborted, true);
  pending.resolve(Response.json({ provider: "browser" }));
  assert.equal(await old, "cancelled");
  assert.equal(player.getSnapshot().ownerId, "new");
  assert.equal(f.maximum(), 1);
  player.stop();
});

test("old decoding cannot overwrite new message buffer used for resume", async () => {
  const f = fixture();
  const entered = deferred<boolean>(); const pending = deferred<any>();
  let decodes = 0;
  f.context.decodeAudioData = async () => {
    if (++decodes === 1) { entered.resolve(true); return pending.promise; }
    return { duration: 10, tag: "new" };
  };
  const player = new VoicePlaybackManager(f.options);
  const old = player.play("old", "old", "chat", "natural");
  await entered.promise;
  await player.play("new", "new", "chat", "natural");
  pending.resolve({ duration: 10, tag: "old" });
  assert.equal(await old, "cancelled");
  player.pause("new"); player.resume("new");
  assert.equal(f.sources.at(-1).buffer.tag, "new");
  player.stop();
});

test("page cleanup cancels pending generation and no sound starts later", async () => {
  const f = fixture(); const pending = deferred<Response>();
  const player = new VoicePlaybackManager({ ...f.options, fetch: (() => pending.promise) as typeof fetch });
  const work = player.play("one", "测试", "chat", "natural");
  player.stop();
  pending.resolve(Response.json({ provider: "openai", dataUrl: "data:audio/mpeg;base64,AQ==" }));
  assert.equal(await work, "cancelled");
  assert.equal(f.sources.length, 0);
  assert.equal(player.getSnapshot().status, "idle");
});

test("interruption pauses animations; resuming while locked is blocked", async () => {
  const f = fixture(); const player = new VoicePlaybackManager(f.options);
  await player.play("one", "测试", "chat", "natural");
  f.context.state = "suspended";
  player.interrupt();
  assert.equal(player.getSnapshot().status, "paused");
  f.setUnlocked(false);
  assert.equal(player.resume("one"), "blocked");
  player.stop();
});

test("provider failure uses safety fallback; speaking starts on actual onstart", async () => {
  const f = fixture(); let utterance: any;
  const player = new VoicePlaybackManager({ ...f.options,
    fetch: (async () => { throw new Error("network"); }) as typeof fetch,
    utterance: () => ({}) as SpeechSynthesisUtterance,
    synthesis: () => ({
      getVoices: () => [], cancel() {}, pause() {}, resume() {},
      speak(value: any) { utterance = value; },
    }) as unknown as SpeechSynthesis,
  });
  const work = player.play("safety", "测试", "safety", "fast");
  await new Promise((r) => setImmediate(r));
  assert.equal(player.getSnapshot().status, "loading");
  assert.equal(utterance.rate, 0.82);
  utterance.onstart();
  assert.equal(await work, "started");
  assert.equal(player.getSnapshot().provider, "browser");
  assert.equal(player.getSnapshot().status, "playing");
  utterance.onend();
  assert.equal(player.getSnapshot().status, "idle");
});

test("speech permission error is visible and not treated as successful playing", async () => {
  const f = fixture();
  const player = new VoicePlaybackManager({ ...f.options,
    fetch: (async () => Response.json({ provider: "browser" })) as typeof fetch,
    utterance: () => ({}) as SpeechSynthesisUtterance,
    synthesis: () => ({
      getVoices: () => [], cancel() {},
      speak(u: any) { queueMicrotask(() => u.onerror({ error: "not-allowed" })); },
    }) as unknown as SpeechSynthesis,
  });
  assert.equal(await player.play("one", "测试", "chat", "natural"), "blocked");
  assert.equal(player.getSnapshot().status, "idle");
  assert.ok(player.getSnapshot().notice);
});

test("request timeout leaves loading even if browser speech is unavailable", async () => {
  const f = fixture();
  const player = new VoicePlaybackManager({ ...f.options, timeoutMs: 10,
    fetch: ((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    })) as typeof fetch,
  });
  assert.equal(await player.play("one", "测试", "chat", "natural"), "unavailable");
  assert.equal(player.getSnapshot().reason, "timeout");
  assert.equal(player.getSnapshot().status, "idle");
});
