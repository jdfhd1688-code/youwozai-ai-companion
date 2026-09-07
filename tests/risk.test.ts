import { test } from "node:test";
import assert from "node:assert/strict";
import { assessRisk } from "../src/lib/risk";

test("low risk stays on the normal companion path", () => {
  const result = assessRisk("今天同事改了方案没告诉我，我很委屈，也有点烦。");
  assert.equal(result.level, "low");
  assert.equal(result.needsFixedSafety, false);
});

test("medium risk routes to enhanced support without fixed safety workflow", () => {
  const result = assessRisk("这半个月我觉得没有希望，不想见任何人，晚上也睡不好。");
  assert.equal(result.level, "medium");
  assert.equal(result.needsFixedSafety, false);
  assert.ok(result.evidence.length > 0);
});

test("high risk always enters the fixed safety workflow", () => {
  const result = assessRisk("我最近总是想，要是能消失就好了，早上也不想醒来。");
  assert.equal(result.level, "high");
  assert.equal(result.needsFixedSafety, true);
});

test("plain everyday text is not over-classified", () => {
  const result = assessRisk("今天天气不错，我出门买了杯咖啡，心情还行。");
  assert.equal(result.level, "low");
  assert.equal(result.needsFixedSafety, false);
});
