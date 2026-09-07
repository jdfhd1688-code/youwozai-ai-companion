import { test } from "node:test";
import assert from "node:assert/strict";
import { VoiceCoordinator } from "../src/lib/voice";
import { SAFETY_ACTIONS } from "../src/lib/safety-content";
import {
  generateSpeechDataUrl,
  sceneInstruction,
  sceneSpeedMultiplier,
  speechCacheKey,
  speedMultiplier,
  ttsVoice,
} from "../src/lib/tts";

test("voice coordinator stops the previous voice before playing a new one", () => {
  const coordinator = new VoiceCoordinator();
  let stopped: string | null = null;
  coordinator.play("one", (id) => {
    stopped = id;
  });
  coordinator.play("two", (id) => {
    stopped = id;
  });
  assert.equal(stopped, "one");
  assert.equal(coordinator.getActiveId(), "two");
});

test("safety TTS uses a slower and calmer scene", () => {
  assert.ok(speedMultiplier("slow") < speedMultiplier("natural"));
  assert.ok(sceneSpeedMultiplier("safety", "fast") < sceneSpeedMultiplier("chat", "natural"));
  assert.match(sceneInstruction("safety"), /克制/);
  assert.match(sceneInstruction("safety"), /不卖萌/);
  assert.notEqual(ttsVoice("safety"), ttsVoice("chat"));
  assert.notEqual(speechCacheKey("test", "safety", "alloy", "slow"), speechCacheKey("test", "chat", "alloy", "slow"));
});

test("OpenAI is the primary TTS provider and receives the safety voice profile", async () => {
  const oldKey = process.env.TTS_API_KEY;
  const oldVoice = process.env.TTS_VOICE;
  const oldSafetyVoice = process.env.TTS_SAFETY_VOICE;
  process.env.TTS_API_KEY = "test-key";
  process.env.TTS_VOICE = "coral";
  process.env.TTS_SAFETY_VOICE = "sage";
  let requestBody: any;
  const fakeFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
  }) as typeof fetch;

  try {
    const result = await generateSpeechDataUrl("安全语音测试-唯一", "safety", "fast", fakeFetch);
    assert.equal(result.provider, "openai");
    assert.equal(requestBody.model, "gpt-4o-mini-tts");
    assert.equal(requestBody.voice, "sage");
    assert.equal(requestBody.speed, 0.82);
    assert.match(requestBody.instructions, /高风险陪伴场景/);
  } finally {
    if (oldKey === undefined) delete process.env.TTS_API_KEY; else process.env.TTS_API_KEY = oldKey;
    if (oldVoice === undefined) delete process.env.TTS_VOICE; else process.env.TTS_VOICE = oldVoice;
    if (oldSafetyVoice === undefined) delete process.env.TTS_SAFETY_VOICE; else process.env.TTS_SAFETY_VOICE = oldSafetyVoice;
  }
});

test("high risk UI exposes exactly three primary safety actions", () => {
  assert.deepEqual(
    SAFETY_ACTIONS.map((action) => action.id),
    ["contact-guardian", "help-now", "continue-with-me"]
  );
});

test("emotion extraction leaves trigger blank when there is no clear event", async () => {
  const { extractEmotionDraft } = await import("../src/lib/companion");
  const draft = extractEmotionDraft("最近我总是想，要是能消失就好了，早上也不想醒来，觉得这样下去真的没有意义。");
  assert.equal(draft.riskLevel, "high");
  assert.equal(draft.trigger, "");
  assert.ok(draft.thought.includes("消失"));
});

test("LLM extraction retries once and falls back when JSON is invalid", async () => {
  const { extractStructuredDraft } = await import("../src/lib/llm");
  process.env.LLM_API_KEY = "test";
  process.env.LLM_BASE_URL = "https://example.test/v1";
  process.env.LLM_MODEL = "test-model";
  let calls = 0;
  const fallback = {
    emotionLabels: ["低落"],
    intensity: 8,
    trigger: "",
    thought: "",
    response: "",
    summary: "fallback",
    riskLevel: "high" as const,
  };
  const fakeFetch = (async () => {
    calls += 1;
    return new Response(JSON.stringify({ choices: [{ message: { content: "{bad json" } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  const result = await extractStructuredDraft("我想消失", fallback, fakeFetch);
  assert.equal(calls, 2);
  assert.deepEqual(result, fallback);
});
