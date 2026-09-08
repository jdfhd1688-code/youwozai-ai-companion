import { chromium } from "playwright-core";

const baseURL = process.env.UI_BASE_URL || "http://127.0.0.1:3000";
const edgePath = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const browser = await chromium.launch({ executablePath: edgePath, headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "zh-CN" });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

const email = `phase2a-${Date.now()}@example.test`;
let registered = false;
let otherContext;

try {
  const register = await context.request.post(`${baseURL}/api/auth/register`, {
    data: { email, password: crypto.randomUUID(), nickname: "迁移验收用户" },
  });
  if (!register.ok()) throw new Error(`register ${register.status()}`);
  registered = true;

  const first = await context.request.post(`${baseURL}/api/chat`, { data: { text: "今天完成了一件拖了很久的事，松了一口气。" } });
  if (!first.ok()) throw new Error(`first chat ${first.status()}`);
  const firstData = await first.json();
  const second = await context.request.post(`${baseURL}/api/chat`, {
    data: { text: "其实还是有点担心明天的汇报。", sessionId: firstData.sessionId },
  });
  if (!second.ok()) throw new Error(`second chat ${second.status()}`);
  const secondData = await second.json();

  otherContext = await browser.newContext({ locale: "zh-CN" });
  const otherRegister = await otherContext.request.post(`${baseURL}/api/auth/register`, {
    data: { email: `phase2a-other-${Date.now()}@example.test`, password: crypto.randomUUID(), nickname: "隔离测试用户" },
  });
  if (!otherRegister.ok()) throw new Error(`other register ${otherRegister.status()}`);
  const forbiddenRead = await otherContext.request.get(`${baseURL}/api/chat?sessionId=${encodeURIComponent(firstData.sessionId)}`);
  const forbiddenWrite = await otherContext.request.post(`${baseURL}/api/chat`, {
    data: { text: "不能写入别人的会话", sessionId: firstData.sessionId },
  });
  if (forbiddenRead.status() !== 404 || forbiddenWrite.status() !== 404) throw new Error("conversation authorization regression");
  await otherContext.request.delete(`${baseURL}/api/me`);
  await otherContext.close();
  otherContext = undefined;

  const reload = await context.request.get(`${baseURL}/api/chat?sessionId=${encodeURIComponent(firstData.sessionId)}`);
  if (!reload.ok()) throw new Error(`reload ${reload.status()}`);
  const reloadData = await reload.json();
  const ids = reloadData.session.messages.map((message) => message.id);
  const sequences = reloadData.session.messages.map((message) => message.sequenceNo);
  for (const expected of [firstData.userMessage.id, firstData.assistantMessage.id, secondData.userMessage.id, secondData.assistantMessage.id]) {
    if (!ids.includes(expected)) throw new Error(`stable message missing ${expected}`);
  }
  if (!sequences.every((value, index) => value === index + 1)) throw new Error(`unstable ordering ${sequences.join(",")}`);

  const record = await context.request.put(`${baseURL}/api/chat`, {
    data: {
      sessionId: firstData.sessionId,
      sourceMessageId: secondData.userMessage.id,
      emotionLabels: ["焦虑"],
      intensity: 6,
      trigger: "明天的汇报",
      thought: "担心准备得不够好",
      response: "仍愿意继续准备",
      summary: "完成旧任务后，对明天汇报仍有一些担心。",
      riskLevel: "low",
    },
  });
  if (!record.ok()) throw new Error(`record ${record.status()}`);
  const recordData = await record.json();
  if (recordData.record.sourceConversationId !== firstData.sessionId || recordData.record.sourceMessageId !== secondData.userMessage.id) {
    throw new Error("emotion provenance mismatch");
  }

  await page.goto(`${baseURL}/chat`, { waitUntil: "networkidle" });
  for (const id of ids.slice(-4)) {
    if (!(await page.locator(`[data-message-id="${id}"]`).count())) throw new Error(`DOM message missing ${id}`);
  }
  await page.reload({ waitUntil: "networkidle" });
  for (const id of ids.slice(-4)) {
    if (!(await page.locator(`[data-message-id="${id}"]`).count())) throw new Error(`refresh message missing ${id}`);
  }
  const layout = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    inputVisible: Boolean(document.querySelector('input[placeholder="想说什么都可以…"]')),
    navigation: Array.from(document.querySelectorAll("nav.bottom-nav a span")).map((node) => node.textContent),
  }));
  if (layout.documentWidth > layout.viewportWidth || !layout.inputVisible) throw new Error(`mobile layout ${JSON.stringify(layout)}`);
  if (JSON.stringify(layout.navigation) !== JSON.stringify(["聊聊", "这一段路", "来信", "守护圈"])) throw new Error("mobile navigation mismatch");

  const high = await context.request.post(`${baseURL}/api/chat`, {
    data: { text: "最近总想消失，早上也不想醒来，觉得没有意义。", sessionId: firstData.sessionId },
  });
  const highData = await high.json();
  if (!high.ok() || highData.safety !== true || highData.userMessage.safetyLevel !== "high") throw new Error("high-risk persistence regression");

  if (consoleErrors.length) throw new Error(`console errors: ${consoleErrors.length}`);
  console.log(JSON.stringify({
    viewport: "390x844",
    conversationIdStable: true,
    stableMessageIds: ids.length,
    orderedSequences: sequences,
    refreshPersistence: true,
    emotionProvenance: true,
    crossUserIsolation: true,
    highRiskPersistence: true,
    navigation: layout.navigation,
    consoleErrors: 0,
  }, null, 2));
} finally {
  if (otherContext) {
    await otherContext.request.delete(`${baseURL}/api/me`).catch(() => undefined);
    await otherContext.close().catch(() => undefined);
  }
  if (registered) await context.request.delete(`${baseURL}/api/me`).catch(() => undefined);
  await browser.close();
}
