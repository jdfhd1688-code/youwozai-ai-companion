import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const baseUrl = process.env.DEMO_URL || "http://127.0.0.1:4173";
const executablePath = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await chromium.launch({ headless: true, executablePath });

async function verify(viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()}`));
  const response = await page.goto(baseUrl, { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200);
  await page.getByText("这是公开体验版，请勿输入真实隐私信息。").waitFor();
  await page.getByRole("button", { name: "和小在聊聊" }).click();
  await page.getByRole("button", { name: "体验 High Risk Safety Workflow" }).click();
  await page.getByText("小在会陪着你").waitFor();
  await page.getByRole("button", { name: "保存这段心情" }).click();
  await page.getByRole("heading", { name: "我走过的日子" }).waitFor();
  await page.getByRole("button", { name: /来信/ }).click();
  await page.getByRole("heading", { name: "有我在·每周来信" }).waitFor();
  await page.getByRole("button", { name: /守护圈/ }).click();
  await page.getByText("加入守护圈 ≠ 自动收到通知").waitFor();
  const permission = page.getByRole("switch", { name: "分享持续低落等趋势" });
  assert.equal(await permission.getAttribute("aria-checked"), "false");
  await permission.click();
  assert.equal(await permission.getAttribute("aria-checked"), "true");
  await page.getByRole("button", { name: /隐私/ }).click();
  await page.locator("#content").getByText("This is a public demo. Please do not enter real sensitive or private information.").waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(overflow, false);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(failedRequests, []);
  const stored = await page.evaluate(() => localStorage.getItem("youwozai-public-demo-v1"));
  assert.ok(stored?.includes("模拟 High Risk 表达"));
  await context.close();
}

try {
  await verify({ width: 1440, height: 900 });
  await verify({ width: 390, height: 844 });
  console.log(`Public demo browser verification passed at ${baseUrl} (desktop + mobile).`);
} finally {
  await browser.close();
}
