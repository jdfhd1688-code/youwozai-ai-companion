const STORAGE_KEY = "youwozai-public-demo-v1";
const initialState = {
  records: [
    { id: "r1", day: "9月6日 20:00", labels: ["低落", "无助"], intensity: 9, trigger: "连续几天觉得撑不住，想请假又不敢", summary: "连续几天的低落叠加成无助，身体和心理都有点撑不住。", risk: "high" },
    { id: "r2", day: "9月5日 22:00", labels: ["焦虑", "迷茫"], intensity: 8, trigger: "周末晚上想到下周全是会", summary: "周日晚上被下周的日程压住，焦虑和迷茫一起出现。", risk: "medium" },
    { id: "r3", day: "9月5日 12:00", labels: ["开心", "安心"], intensity: 6, trigger: "妈妈打来电话问了句吃没吃饭", summary: "有人惦记，让这一天多了一点安心。", risk: "low" }
  ],
  guardian: { notify: true, risk: true, labels: true, trend: false, stressor: false },
  messages: [],
  autoplay: false
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function loadState() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (value && Array.isArray(value.records) && value.guardian) return value;
  } catch {}
  return clone(initialState);
}
let state = loadState();
let view = "home";
let draft = null;
const content = document.querySelector("#content");
const head = document.querySelector("#page-head");
const title = document.querySelector("#page-title");
const subtitle = document.querySelector("#page-subtitle");

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function mascot() { return '<div class="mascot" aria-label="小在"><span class="sprout">♣</span><span class="face"><i></i><i></i><b>⌣</b></span></div>'; }
function chips(labels) { return `<div class="chips">${labels.map((x) => `<span class="chip">${escapeHtml(x)}</span>`).join("")}</div>`; }
function setView(next) { view = next; window.scrollTo(0, 0); render(); }
function riskLabel(risk) { return risk === "high" ? "较高" : risk === "medium" ? "中" : "较低"; }

function homeView() {
  return `<div class="stack">
    <div class="welcome"><div><h1>你好，阿乐</h1><p>今天也可以慢慢来</p></div><span>公开体验</span></div>
    <article class="hero-card"><h2>下午好，今天辛苦啦，我是小在</h2>${mascot()}<p>我在。你不用先想清楚自己是什么情绪，想说的时候慢慢说就好。</p>
      <button class="button primary wide" data-go="chat">和小在聊聊</button>
      <div class="two"><button class="button" data-go="letter">每周来信</button><button class="button" data-go="guardians">守护圈</button></div>
      <button class="voice-link" id="speak-welcome" type="button">听小在说</button>
    </article>
    <div class="stats"><div><b>${state.records.length}</b><span>段模拟心情</span></div><div><b>7</b><span>天模拟记录</span></div><div><b>1</b><span>位模拟守护人</span></div></div>
    <button class="card-link" data-go="records"><div><b>看看我走过的日子</b><span>每一段被记录下来的心情，都在那里安静地陪着你</span></div><b>→</b></button>
  </div>`;
}

function chatView() {
  const messages = state.messages.map((message) => `<div class="bubble ${message.role === "user" ? "mine" : ""} ${message.risk === "high" ? "safety" : ""}">${escapeHtml(message.text)}</div>`).join("");
  const draftCard = draft ? `<article class="draft"><h3>小在帮你写的小结</h3>${chips(draft.labels)}<p>${escapeHtml(draft.summary)}</p><small>风险标记只用于安全分流，不是诊断。保存后只留在当前浏览器。</small><button class="button primary wide" id="save-draft">保存这段心情</button></article>` : "";
  const safety = state.messages.at(-1)?.risk === "high" ? `<article class="safety-card"><h3>小在会陪着你</h3><button class="button wide">联系我的模拟守护人</button><button class="button wide">查看即时求助方式</button><button class="button primary wide">我现在是安全的，继续陪我聊</button><small>如存在紧迫危险，请立即联系当地紧急服务。小在不能替代急救、诊断、治疗或专业支持。</small></article>` : "";
  return `<div class="stack"><div class="chat-list"><div class="bubble">本巴拉上线啦，今天发生啥？我耳朵已经竖起来了。</div>${messages}</div>${draftCard}${safety}
    ${state.messages.length ? "" : `<div class="prompts"><p>不知道怎么开口，也可以先体验模拟场景：</p><button data-prompt="今天有点累">♡ 今天有点累</button><button data-prompt="有件事想吐槽">♡ 有件事想吐槽</button><button data-prompt="其实我也说不清楚……">♡ 其实我也说不清楚……</button></div>`}
    <div class="composer"><input id="chat-input" maxlength="300" aria-label="模拟消息" placeholder="请只输入模拟内容…"><button class="button primary" id="send-message" aria-label="发送">↑</button></div>
    <button class="text-link" id="safety-demo">体验 High Risk Safety Workflow</button>
  </div>`;
}

function recordsView() {
  return `<div class="stack">${state.records.map((record) => `<article class="record-card"><div class="record-head"><h2>${escapeHtml(record.day)}</h2><span class="risk ${record.risk}">${riskLabel(record.risk)}</span></div>${chips(record.labels)}<p><b>触发：</b>${escapeHtml(record.trigger)}</p><blockquote>${escapeHtml(record.summary)}</blockquote></article>`).join("")}</div>`;
}
function letterView() {
  const avg = (state.records.reduce((sum, record) => sum + record.intensity, 0) / state.records.length).toFixed(1);
  return `<div class="stack"><article class="notice"><b>成长相册 · 模拟数据</b><p>✓ 第一次认真记录自己的感受<br>✓ 连续记录 7 天<br>✓ 第一次完成一封每周来信</p></article><article class="letter"><h2>阿乐，见字如面</h2><small>公开 Demo 模拟周报</small><p>这周你一共留下 ${state.records.length} 段心情。你愿意开口的每一天，都不是微不足道的小事。</p><h3>情绪足迹</h3><p>${state.records.length} 段记录 · 平均强度 ${avg}/10</p><div class="bars">${state.records.slice(0, 7).map((record) => `<i class="bar-${record.intensity}"></i>`).join("")}</div><h3>一个模拟观察</h3><p>当计划突然变化时，你更容易感到焦虑；而来自家人的一句问候，会让你重新找到一点安心。</p></article></div>`;
}
function permission(key, label, help) {
  return `<div class="permission"><div><b>${label}</b><small>${help}</small></div><button class="switch" role="switch" aria-label="${label}" aria-checked="${Boolean(state.guardian[key])}" data-permission="${key}"></button></div>`;
}
function guardiansView() {
  return `<div class="stack"><article class="notice"><b>加入守护圈 ≠ 自动收到通知</b><p>每位守护人都要单独开启权限；公开 Demo 不会真的发送任何消息。</p></article><article class="guardian-card"><div class="guardian-person"><span>姐</span><div><h2>姐姐</h2><p>虚构关系 · 联系方式已脱敏</p></div></div>${permission("notify", "高风险时允许联系", "达到高风险且用户再次确认后才会考虑通知")}${permission("risk", "分享风险等级", "仅展示为“较高”，不是诊断")}${permission("labels", "分享主要情绪标签", "不分享聊天原文")}${permission("trend", "分享持续低落等趋势", "默认关闭")}${permission("stressor", "分享压力来源", "默认关闭")}</article><article class="notice"><b>Safety Workflow</b><p>所有通知均为站内模拟。未经授权和当次确认，不会分享信息。</p></article></div>`;
}
function privacyView() {
  return `<div class="stack"><article class="settings-card"><h2>公开体验与隐私</h2><p>这是公开体验版，请勿输入真实隐私信息。</p><p lang="en">This is a public demo. Please do not enter real sensitive or private information.</p><ul class="privacy-list"><li>预置人物、关系、记录均为虚构模拟数据。</li><li>输入和设置只保存在当前浏览器 localStorage。</li><li>不会上传到服务器，不使用真实 API key。</li><li>这不是医疗诊断、治疗或紧急救援产品。</li></ul><button class="button wide" id="reset-demo">重置本机 Demo 数据</button></article><a class="github-link" href="https://github.com/jdfhd1688-code/youwozai-ai-companion" target="_blank" rel="noopener noreferrer">查看 GitHub 源码与完整工程资料</a></div>`;
}

function speak(text, slow = false) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "zh-CN"; utterance.rate = slow ? .78 : .92; speechSynthesis.speak(utterance);
}
function sendMessage(text) {
  const clean = text.trim().slice(0, 300); if (!clean) return;
  const high = /消失|不想醒|没有意义|伤害自己|活不下去/.test(clean);
  const reply = high ? "我在这里。你现在的安全比什么都重要。先不用独自扛着，我们一起把下一步变得简单一点。" : "我听到了。准备很久的事情突然被改掉，委屈和疲惫一起涌上来，确实很难受。";
  state.messages.push({ role: "user", text: clean }, { role: "assistant", text: reply, risk: high ? "high" : "low" });
  draft = { id: `r-${Date.now()}`, day: "今天 · 模拟", labels: high ? ["低落", "无助"] : ["委屈", "疲惫"], intensity: high ? 9 : 7, trigger: high ? "模拟 High Risk 表达" : "模拟计划变化", summary: high ? "今天不安的感觉比较强，这个状态值得被认真对待。" : "计划突然变化带来委屈和疲惫，需要一点时间缓冲。", risk: high ? "high" : "low" };
  saveState(); render(); if (state.autoplay) speak(reply, high);
}

function bindEvents() {
  document.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.go)));
  document.querySelectorAll("[data-prompt]").forEach((button) => button.addEventListener("click", () => sendMessage(button.dataset.prompt)));
  document.querySelectorAll("[data-permission]").forEach((button) => button.addEventListener("click", () => { const key = button.dataset.permission; state.guardian[key] = !state.guardian[key]; saveState(); render(); }));
  document.querySelector("#speak-welcome")?.addEventListener("click", () => speak("下午好，我是小在。你不用先想清楚自己是什么情绪，想说的时候慢慢说就好。"));
  document.querySelector("#send-message")?.addEventListener("click", () => sendMessage(document.querySelector("#chat-input").value));
  document.querySelector("#chat-input")?.addEventListener("keydown", (event) => { if (event.key === "Enter") sendMessage(event.currentTarget.value); });
  document.querySelector("#safety-demo")?.addEventListener("click", () => sendMessage("这是安全流程模拟：最近我总想消失，觉得没有意义。"));
  document.querySelector("#save-draft")?.addEventListener("click", () => { state.records.unshift(draft); draft = null; saveState(); setView("records"); });
  document.querySelector("#reset-demo")?.addEventListener("click", () => { state = clone(initialState); draft = null; saveState(); render(); });
}
function render() {
  const meta = { chat: ["和小在聊聊", "模拟对话不会离开当前浏览器"], records: ["我走过的日子", `${state.records.length} 段模拟心情记录`], letter: ["有我在·每周来信", "基于模拟记录生成"], guardians: ["守护圈", "授权、确认与安全流程演示"], privacy: ["隐私与 Demo 说明", "公开体验版"] };
  head.hidden = view === "home"; if (meta[view]) [title.textContent, subtitle.textContent] = meta[view];
  content.innerHTML = ({ home: homeView, chat: chatView, records: recordsView, letter: letterView, guardians: guardiansView, privacy: privacyView })[view]();
  document.querySelectorAll(".bottom-nav button").forEach((button) => { button.classList.toggle("active", button.dataset.view === view); button.setAttribute("aria-current", button.dataset.view === view ? "page" : "false"); });
  bindEvents();
}
document.querySelector("#back-home").addEventListener("click", () => setView("home"));
document.querySelectorAll(".bottom-nav button").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
render();
