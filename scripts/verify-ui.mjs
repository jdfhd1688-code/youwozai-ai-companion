import { chromium } from "playwright-core";

const baseURL = process.env.UI_BASE_URL || "http://127.0.0.1:3000";
const edgePath = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const browser = await chromium.launch({ executablePath: edgePath, headless: true });
const context = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: "zh-CN" });
const page = await context.newPage();
const consoleErrors = [];
const failedRequests = [];

page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("requestfailed", (request) => {
  failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || "failed"}`);
});

try {
  const login = await context.request.post(`${baseURL}/api/auth/login`, {
    data: { email: "demo@youwozai.app", password: "Capybara123" },
  });
  if (!login.ok()) throw new Error(`login ${login.status()}`);

  const routes = ["/home", "/chat", "/records", "/letter", "/guardians", "/privacy"];
  const results = [];
  for (const route of routes) {
    const response = await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
    results.push({ route, status: response?.status() || 0, title: await page.locator("h1").first().textContent() });
  }

  await page.goto(`${baseURL}/chat`, { waitUntil: "networkidle" });
  const mobileNav = await page.locator("nav.bottom-nav a span").allTextContents();
  if (JSON.stringify(mobileNav) !== JSON.stringify(["聊聊", "这一段路", "来信", "守护圈"])) {
    failedRequests.push(`navigation mismatch: ${mobileNav.join("|")}`);
  }

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${baseURL}/records`, { waitUntil: "networkidle" });
  const desktopJourney = await page.getByText("先从你确认保存过的经历慢慢回望").isVisible();
  if (!desktopJourney) failedRequests.push("desktop journey skeleton missing");

  const apiRoutes = ["/api/auth/me", "/api/records", "/api/letter", "/api/guardians", "/api/notifications", "/api/memories", "/api/settings/voice", "/api/tts"];
  for (const route of apiRoutes) {
    const response = await context.request.get(`${baseURL}${route}`);
    if (!response.ok()) failedRequests.push(`GET ${route} ${response.status()}`);
  }

  const emptyContext = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: "zh-CN" });
  const emptyPage = await emptyContext.newPage();
  const emptyEmail = `phase1-${Date.now()}@example.test`;
  const register = await emptyContext.request.post(`${baseURL}/api/auth/register`, {
    data: { email: emptyEmail, password: "Phase1Test123", nickname: "演示访客" },
  });
  if (!register.ok()) failedRequests.push(`empty-state register ${register.status()}`);
  else {
    await emptyPage.goto(`${baseURL}/records`, { waitUntil: "networkidle" });
    if (!(await emptyPage.getByText("还没有保存过心情记录。").isVisible())) failedRequests.push("journey empty state missing");
    await emptyContext.request.delete(`${baseURL}/api/me`);
  }
  await emptyContext.close();

  if (consoleErrors.length || failedRequests.length || results.some((item) => item.status !== 200 || !item.title)) {
    throw new Error(JSON.stringify({ results, consoleErrors, failedRequests }, null, 2));
  }
  console.log(JSON.stringify({ mobileViewport: "430x932", desktopViewport: "1280x800", routes: results, navigation: mobileNav, emptyState: "passed", consoleErrors: 0, failedRequests: 0 }, null, 2));
} finally {
  await browser.close();
}
