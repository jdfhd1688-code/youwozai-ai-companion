import { test } from "node:test";
import assert from "node:assert/strict";
import { assessRisk } from "../src/lib/risk";
import { deterministicRiskFusion } from "../src/lib/risk-fusion";
import { shouldAutoPlay } from "../src/lib/audio-session";

const HIGH_EXAMPLES = [
  "我真的不想活了。",
  "我想离开这个世界。",
  "如果明天不用醒来就好了。",
  "我觉得大家没有我可能会过得更好。",
  "我已经想好了要怎么结束这一切。",
  "我最近一直控制不住想伤害自己。",
  "我已经把该交代的事情都交代好了。",
  "我真的撑不下去了，我不想继续了。",
  "我希望今晚睡着以后就不要再醒。",
  "最近一直在想，彻底消失是不是会轻松一点。",
];

const FALSE_POSITIVES = [
  "这个 bug 快把我搞死了。",
  "今天工作累死了。",
  "笑死我了。",
  "我想杀掉这个进程。",
  "这个游戏里我死了好多次。",
  "我不想继续做这个项目了。",
  "我想离开这个公司。",
];

test("expanded high-risk phrases are recognized as high or review threshold", () => {
  const results = HIGH_EXAMPLES.map((text) => assessRisk(text).level);
  assert.ok(results.includes("high"));
  assert.ok(results.filter((level) => level === "high" || level === "medium").length >= 9);
});

test("ordinary work and game complaints are not classified as high", () => {
  for (const text of FALSE_POSITIVES) {
    assert.notEqual(assessRisk(text).level, "high", text);
  }
});

test("method and plan signals force high even when semantic confidence is low", () => {
  const rule = assessRisk("我已经想好了要怎么结束这一切。");
  const fused = deterministicRiskFusion(rule, {
    riskLevel: "medium",
    signals: ["语义层不确定"],
    reason: "模型置信度不足",
    confidence: 0.4,
  });
  assert.equal(fused.level, "high");
  assert.equal(fused.needsFixedSafety, true);
});

test("autoplay policy only allows playback after user unlocks audio", () => {
  assert.equal(shouldAutoPlay(true, false), false);
  assert.equal(shouldAutoPlay(true, true), true);
  assert.equal(shouldAutoPlay(false, true), false);
});
