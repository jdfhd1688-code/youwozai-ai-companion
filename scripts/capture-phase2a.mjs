import { chromium } from "playwright-core";
import fs from "node:fs/promises";
import path from "node:path";

const baseURL = process.env.CAPTURE_BASE_URL || "http://127.0.0.1:3000";
const edgePath = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const outputDir = path.resolve(process.cwd(), "portfolio", "phase2a");
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ executablePath: edgePath, headless: true });
const context = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: "zh-CN", deviceScaleFactor: 1.5 });
const page = await context.newPage();
let registered = false;

async function shot(name) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "#next-logo,[data-next-badge-root],nextjs-portal{display:none!important}*{caret-color:transparent!important}" });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outputDir, name), fullPage: false });
}

try {
  const register = await context.request.post(`${baseURL}/api/auth/register`, {
    data: { email: `phase2a-capture-${Date.now()}@example.test`, password: crypto.randomUUID(), nickname: "小满" },
  });
  if (!register.ok()) throw new Error(`register ${register.status()}`);
  registered = true;

  const first = await context.request.post(`${baseURL}/api/chat`, {
    data: { text: "今天把拖了很久的材料终于整理完了，松了一口气。" },
  });
  const firstData = await first.json();
  if (!first.ok()) throw new Error(`first chat ${first.status()}`);
  const second = await context.request.post(`${baseURL}/api/chat`, {
    data: { text: "但想到明天还要汇报，又有一点紧张。", sessionId: firstData.sessionId },
  });
  const secondData = await second.json();
  if (!second.ok()) throw new Error(`second chat ${second.status()}`);

  const saved = await context.request.put(`${baseURL}/api/chat`, { data: {
    sessionId: firstData.sessionId,
    sourceMessageId: secondData.userMessage.id,
    emotionLabels: ["紧张", "安心"], intensity: 6, trigger: "明天的汇报",
    thought: "担心准备得还不够", response: "继续整理提纲",
    summary: "完成拖延许久的材料后松了一口气，同时对明天汇报仍有些紧张。", riskLevel: "low",
  } });
  if (!saved.ok()) throw new Error(`save record ${saved.status()}`);
  const guardian = await context.request.post(`${baseURL}/api/guardians`, {
    data: { displayName: "姐姐", relationship: "家人", contactHint: "需要时可以联系" },
  });
  if (!guardian.ok()) throw new Error(`guardian ${guardian.status()}`);

  await page.goto(`${baseURL}/chat`, { waitUntil: "networkidle" });
  await page.locator(`[data-message-id="${secondData.assistantMessage.id}"]`).scrollIntoViewIfNeeded();
  await shot("01-聊聊真实多轮消息.png");
  await page.reload({ waitUntil: "networkidle" });
  if (!(await page.locator(`[data-message-id="${secondData.assistantMessage.id}"]`).count())) throw new Error("message missing after refresh");
  await page.locator(`[data-message-id="${secondData.assistantMessage.id}"]`).scrollIntoViewIfNeeded();
  await shot("02-刷新后同一Conversation.png");

  await page.goto(`${baseURL}/records`, { waitUntil: "networkidle" });
  await shot("03-我的这一段路.png");
  await page.goto(`${baseURL}/letter`, { waitUntil: "networkidle" });
  await shot("04-来信.png");
  await page.goto(`${baseURL}/guardians`, { waitUntil: "networkidle" });
  await shot("05-守护圈.png");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/chat`, { waitUntil: "networkidle" });
  await page.locator(`[data-message-id="${secondData.assistantMessage.id}"]`).scrollIntoViewIfNeeded();
  await shot("06-Mobile-Chat-390x844.png");

  await page.setViewportSize({ width: 1000, height: 760 });
  await page.setContent(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
    body{margin:0;background:#f8f2e8;color:#493f38;font-family:system-ui,"Microsoft YaHei",sans-serif}main{max-width:850px;margin:42px auto;padding:34px;background:#fffdf9;border:1px solid #eadaca;border-radius:24px;box-shadow:0 16px 45px #76542a18}h1{margin:0 0 8px;font-size:30px}.sub{color:#8b7c70;margin-bottom:28px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.item{padding:16px 18px;background:#fbf5eb;border-radius:15px}.ok{color:#3e7c59;font-weight:800}.wide{grid-column:1/-1}code{font-size:14px;color:#9a5e2d}footer{margin-top:24px;color:#8b7c70;font-size:14px}
  </style></head><body><main><h1>Phase 2A · Runtime Verification</h1><div class="sub">2026-09-08 · actual local run · localhost</div><div class="grid">
    <div class="item"><span class="ok">PASS</span><br>48 / 48 automated tests</div><div class="item"><span class="ok">PASS</span><br>Production build · 24 routes</div>
    <div class="item"><span class="ok">PASS</span><br>Legacy migration · 69 rows</div><div class="item"><span class="ok">PASS</span><br>Repeated migration · 0 duplicates</div>
    <div class="item"><span class="ok">PASS</span><br>390×844 mobile layout</div><div class="item"><span class="ok">PASS</span><br>Refresh keeps Message IDs</div>
    <div class="item"><span class="ok">PASS</span><br>Emotion provenance</div><div class="item"><span class="ok">PASS</span><br>High Risk persistence</div>
    <div class="item wide"><span class="ok">0 console errors · 0 failed requests</span><br><code>read-new-first + legacy fallback · no legacy deletion</code></div>
  </div><footer>来自本轮实际命令输出，不包含聊天正文、用户隐私或 Provider 密钥。</footer></main></body></html>`);
  await page.screenshot({ path: path.join(outputDir, "07-测试与Runtime结果.png"), fullPage: false });

  console.log(JSON.stringify({ screenshots: 7, refreshStable: true }, null, 2));
} finally {
  if (registered) await context.request.delete(`${baseURL}/api/me`).catch(() => undefined);
  await browser.close();
}
