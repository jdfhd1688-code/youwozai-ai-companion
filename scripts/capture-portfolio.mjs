import { chromium } from "playwright-core";
import fixWebmDuration from "fix-webm-duration";
import fs from "node:fs/promises";
import path from "node:path";

const baseURL = process.env.CAPTURE_BASE_URL || "http://127.0.0.1:3000";
const edgePath = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const outputRoot = path.resolve(process.cwd(), "portfolio");
const screenshotDir = path.join(outputRoot, "screenshots");
const videoPath = path.join(outputRoot, "有我在APP演示视频.webm");

await fs.mkdir(screenshotDir, { recursive: true });

const browser = await chromium.launch({ executablePath: edgePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 1.5,
  colorScheme: "light",
  locale: "zh-CN",
});
const page = await context.newPage();

async function settle() {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450);
  await page.addStyleTag({ content: `
    #next-logo, [data-next-badge-root], nextjs-portal { display: none !important; }
    * { caret-color: transparent !important; }
  ` });
}

async function shot(name) {
  await settle();
  await page.screenshot({ path: path.join(screenshotDir, name), fullPage: false });
}

async function sendChat(text) {
  const input = page.getByPlaceholder("想说什么都可以…");
  await input.fill(text);
  const response = page.waitForResponse((r) => r.url().includes("/api/chat") && r.request().method() === "POST");
  await page.getByRole("button", { name: "发送" }).click();
  await response;
  await page.waitForTimeout(700);
}

try {
  const login = await context.request.post(`${baseURL}/api/auth/login`, {
    data: { email: "demo@youwozai.app", password: "Capybara123" },
  });
  if (!login.ok()) throw new Error(`Demo 登录失败：${login.status()} ${await login.text()}`);
  await page.goto(`${baseURL}/home`);
  await page.evaluate(async () => {
    await fetch("/api/settings/voice", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoPlay: false, speed: "natural" }),
    });
  });

  await shot("01-首页与小在.png");

  await page.goto(`${baseURL}/chat`);
  await sendChat("今天准备了很久的方案临时被改了，我有点委屈，也有点累。");
  await shot("02-陪伴聊天与情绪草稿.png");

  await page.goto(`${baseURL}/records`);
  await shot("03-情绪记录与趋势.png");

  await page.goto(`${baseURL}/letter`);
  await shot("04-每周来信.png");

  await page.goto(`${baseURL}/guardians`);
  await shot("05-守护圈权限.png");

  await page.goto(`${baseURL}/chat`);
  await sendChat("这是产品安全流程演示：最近我总想消失，早上也不想醒来，觉得没有意义。");
  await shot("06-High-Risk安全流程.png");

  const screenshotFiles = [
    "01-首页与小在.png",
    "02-陪伴聊天与情绪草稿.png",
    "03-情绪记录与趋势.png",
    "04-每周来信.png",
    "05-守护圈权限.png",
    "06-High-Risk安全流程.png",
  ];
  const slides = await Promise.all(screenshotFiles.map(async (file) => ({
    src: `data:image/png;base64,${(await fs.readFile(path.join(screenshotDir, file))).toString("base64")}`,
    title: ({
      "01-首页与小在.png": "从轻量陪伴开始",
      "02-陪伴聊天与情绪草稿.png": "聊天转化为可确认的情绪记录",
      "03-情绪记录与趋势.png": "让一次表达形成长期价值",
      "04-每周来信.png": "用真实记录生成一周回顾",
      "05-守护圈权限.png": "逐人逐字段管理分享权限",
      "06-High-Risk安全流程.png": "高风险进入固定安全工作流",
    })[file],
    body: ({
      "01-首页与小在.png": "卡皮巴拉 AI 伙伴小在，降低第一次开口的压力",
      "02-陪伴聊天与情绪草稿.png": "AI 只生成草稿，用户修改或确认后才会保存",
      "03-情绪记录与趋势.png": "记录支持查看、编辑、删除与周期聚合",
      "04-每周来信.png": "来信只依据已保存记录，不凭空制造发现",
      "05-守护圈权限.png": "加入守护圈不等于自动通知，敏感字段默认不分享",
      "06-High-Risk安全流程.png": "短句安抚、现实支持入口、授权确认与通知审计",
    })[file],
  })));

  const videoPage = await context.newPage();
  await videoPage.setViewportSize({ width: 1280, height: 720 });
  await videoPage.setContent("<canvas id='stage' width='1280' height='720'></canvas>");
  const base64 = await videoPage.evaluate(async ({ slides }) => {
    const canvas = document.querySelector("#stage");
    const ctx = canvas.getContext("2d");
    const images = await Promise.all(slides.map((slide) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = slide.src;
    })));
    const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
      .find((type) => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error("当前浏览器不支持 WebM 录制");
    const chunks = [];
    const recorder = new MediaRecorder(canvas.captureStream(20), {
      mimeType,
      videoBitsPerSecond: 1_400_000,
    });
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };

    const roundRect = (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
    };
    const background = () => {
      const gradient = ctx.createLinearGradient(0, 0, 1280, 720);
      gradient.addColorStop(0, "#fbf4ea");
      gradient.addColorStop(1, "#edf5ee");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1280, 720);
      ctx.fillStyle = "rgba(217,140,79,.12)";
      ctx.beginPath(); ctx.arc(1120, 90, 180, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(132,169,122,.12)";
      ctx.beginPath(); ctx.arc(90, 660, 230, 0, Math.PI * 2); ctx.fill();
    };
    const text = (value, x, y, size, weight = 500, color = "#453b35") => {
      ctx.fillStyle = color;
      ctx.font = `${weight} ${size}px "Microsoft YaHei", sans-serif`;
      ctx.fillText(value, x, y);
    };
    const drawIntro = (progress) => {
      background();
      ctx.globalAlpha = Math.min(1, progress * 2);
      text("有我在", 100, 280, 72, 800);
      text("AI 陪伴与情绪记录 MVP", 104, 342, 34, 600, "#9a6a3c");
      text("从自然表达，到可回顾记录，再到受控的现实支持", 106, 412, 24, 400, "#756960");
      text("产品演示  ·  所有内容均为模拟数据", 106, 610, 18, 500, "#8d8178");
      ctx.globalAlpha = 1;
    };
    const drawSlide = (slide, img, progress, index) => {
      background();
      const enter = Math.min(1, progress * 3);
      ctx.globalAlpha = enter;
      text(String(index + 1).padStart(2, "0"), 72, 92, 22, 700, "#d98c4f");
      text(slide.title, 72, 155, 38, 800);
      const words = slide.body.match(/.{1,20}/g) || [slide.body];
      words.forEach((line, i) => text(line, 74, 214 + i * 38, 22, 400, "#756960"));
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "rgba(77,57,42,.18)";
      ctx.shadowBlur = 28;
      roundRect(770, 26, 430, 668, 28); ctx.fill();
      ctx.shadowBlur = 0;
      roundRect(782, 38, 406, 644, 20); ctx.clip();
      const ratio = Math.max(406 / img.width, 644 / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      ctx.drawImage(img, 782 + (406 - w) / 2, 38 + (644 - h) / 2, w, h);
      ctx.restore(); ctx.save();
      ctx.globalAlpha = 1;
    };
    const drawOutro = (progress) => {
      background();
      text("这不是只有前端的页面原型", 100, 180, 44, 800);
      text("Next.js 全栈  ·  SQLite  ·  权限矩阵", 104, 270, 26, 600, "#9a6a3c");
      text("High Risk Safety Workflow  ·  LLM / TTS Provider", 104, 318, 26, 600, "#9a6a3c");
      text("35 项自动化测试  ·  SDD 与 Harness 工程资料", 104, 366, 26, 600, "#9a6a3c");
      text("当前定位：可运行、可验证的全栈 MVP", 104, 500, 28, 700, "#516f59");
      text("真实用户留存与商业价值仍待验证", 104, 550, 21, 400, "#756960");
      text("有我在  ·  AI Solution Portfolio", 104, 642, 18, 500, "#8d8178");
    };

    const sections = [{ type: "intro", duration: 8 },
      ...slides.map((slide, index) => ({ type: "slide", slide, index, duration: 12 })),
      { type: "outro", duration: 8 }];
    const total = sections.reduce((sum, s) => sum + s.duration, 0);
    recorder.start(1000);
    const started = performance.now();
    await new Promise((resolve) => {
      function frame(now) {
        const seconds = Math.min(total, (now - started) / 1000);
        let cursor = 0;
        let section = sections[sections.length - 1];
        for (const item of sections) {
          if (seconds <= cursor + item.duration) { section = item; break; }
          cursor += item.duration;
        }
        const progress = Math.min(1, (seconds - cursor) / section.duration);
        ctx.save();
        if (section.type === "intro") drawIntro(progress);
        else if (section.type === "slide") drawSlide(section.slide, images[section.index], progress, section.index);
        else drawOutro(progress);
        ctx.restore();
        if (seconds >= total) resolve(); else requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
    recorder.stop();
    await new Promise((resolve) => recorder.addEventListener("stop", resolve, { once: true }));
    const blob = new Blob(chunks, { type: mimeType });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }, { slides });
  const rawVideo = Buffer.from(base64, "base64");
  const fixedVideo = await fixWebmDuration(
    new Blob([rawVideo], { type: "video/webm" }),
    88_000,
    { logger: false },
  );
  await fs.writeFile(videoPath, Buffer.from(await fixedVideo.arrayBuffer()));
  await videoPage.close();
  console.log(JSON.stringify({ screenshots: screenshotFiles.length, videoPath }, null, 2));
} finally {
  await browser.close();
}
