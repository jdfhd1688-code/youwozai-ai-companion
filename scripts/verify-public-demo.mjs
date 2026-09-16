import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("public-demo/index.html", "utf8");
const script = fs.readFileSync("public-demo/app.js", "utf8");
const headers = fs.readFileSync("public-demo/_headers", "utf8");

assert.match(html, /这是公开体验版，请勿输入真实隐私信息。/);
assert.match(html, /This is a public demo\. Please do not enter real sensitive or private information\./);
assert.match(script, /localStorage/);
assert.match(script, /Safety Workflow/);
assert.match(script, /守护圈/);
assert.match(script, /每周来信/);
assert.match(script, /不能替代急救、诊断、治疗或专业支持/);
assert.doesNotMatch(`${html}\n${script}`, /OPENAI_API_KEY|TTS_API_KEY|Capybara123/);
assert.match(headers, /connect-src 'none'/);
console.log("Public demo static integrity checks passed (9 assertions)." );
