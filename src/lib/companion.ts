import { assessRisk } from "./risk";
import type { RiskAssessment } from "./risk";
import type { StructuredDraft } from "./data-access";
import type { RiskLevel } from "./db";

const OPENINGS = [
  "报告！今天的小在已经准备好听你碎碎念啦。",
  "本巴拉上线啦，今天发生啥？我耳朵已经竖起来了。",
  "今天想让我听你吐槽，还是偷偷藏一个小故事？",
  "呀，你来啦。今天有没有什么小情绪想先放我这里？",
];

export function pickOpening(): string {
  return OPENINGS[Math.floor(Math.random() * OPENINGS.length)];
}

type EmotionCandidate = { label: string; keywords: string[]; base: number };

const EMOTION_CATALOG: EmotionCandidate[] = [
  { label: "安心", keywords: ["放松", "安心", "平静", "踏实", "没事了"], base: 4 },
  { label: "开心", keywords: ["开心", "高兴", "快乐", "兴奋", "好笑", "满足", "幸福"], base: 6 },
  { label: "委屈", keywords: ["委屈", "被冤枉", "不被理解", "冤枉", "白费"], base: 6 },
  { label: "失落", keywords: ["失落", "空落落", "失望", "没意思", "提不起劲"], base: 6 },
  { label: "难过", keywords: ["难过", "想哭", "伤心", "哭", "悲伤"], base: 7 },
  { label: "低落", keywords: ["低落", "心情不好", "沮丧", "阴天", "闷闷"], base: 6 },
  { label: "焦虑", keywords: ["焦虑", "担心", "紧张", "心慌", "不安", "害怕", "恐惧"], base: 7 },
  { label: "烦躁", keywords: ["烦躁", "烦", "暴躁", "坐不住", "火大"], base: 6 },
  { label: "生气", keywords: ["生气", "愤怒", "气死", "讨厌", "恼火"], base: 6 },
  { label: "疲惫", keywords: ["累", "疲惫", "没力气", "耗尽", "瘫"], base: 6 },
  { label: "孤独", keywords: ["孤独", "一个人", "没人", "孤单", "没有人陪"], base: 7 },
  { label: "无助", keywords: ["无助", "没办法", "帮不了", "无力"], base: 8 },
  { label: "迷茫", keywords: ["迷茫", "不知道怎么办", "想不明白", "困惑"], base: 6 },
  { label: "压抑", keywords: ["压抑", "喘不过气", "堵着", "闷着"], base: 7 },
  { label: "愧疚", keywords: ["愧疚", "对不起", "内疚", "自责", "怪自己"], base: 6 },
  { label: "平静", keywords: ["还好", "普通", "一般", "没什么", "正常"], base: 4 },
];

function countMatches(text: string, keywords: string[]): number {
  return keywords.reduce((sum, keyword) => (text.includes(keyword) ? sum + 1 : sum), 0);
}

export function extractEmotionDraft(rawText: string, riskOverride?: RiskAssessment): StructuredDraft {
  const text = String(rawText || "");
  const matches = EMOTION_CATALOG.map((item) => ({
    item,
    hits: countMatches(text, item.keywords),
  }))
    .filter((m) => m.hits > 0)
    .sort((a, b) => b.hits - a.hits || b.item.base - a.item.base);

  let labels: string[] = [];
  if (matches.length === 0) {
    const assessment = riskOverride ?? assessRisk(text);
    labels = assessment.level === "high" ? ["不安"] : assessment.level === "medium" ? ["低落"] : ["平静"];
  } else {
    labels = matches.slice(0, 3).map((m) => m.item.label);
    if (!labels.includes("平静") && matches.length >= 1 && matches[0].item.label !== "平静") {
      const moreNumeric = labels.some((label) =>
        ["委屈", "难过", "低落", "焦虑", "烦躁", "生气", "疲惫", "孤独", "无助", "迷茫", "压抑", "愧疚"].includes(label)
      );
      if (moreNumeric) {
        labels = labels.slice(0, 2);
      }
    }
  }

  const positiveHits = countMatches(text, ["开心", "高兴", "满足", "放松", "平静"]);
  const negativeHits = countMatches(text, ["难过", "委屈", "生气", "焦虑", "低落", "压抑", "孤独"]);
  const sentenceCount = Math.max(1, text.split(/[。！？!?；;\n]/).filter((s) => s.trim().length > 2).length);
  const baseIntensity = negativeHits >= 2 ? 7 : positiveHits >= 2 ? 6 : 5;
  let intensity = Math.min(10, Math.max(1, baseIntensity + Math.min(3, Math.floor(sentenceCount / 2))));
  if (labels.includes("无助") || labels.includes("压抑") || labels.includes("孤独")) intensity = Math.max(intensity, 7);

  const assessment = riskOverride ?? assessRisk(text);
  const trigger = inferTrigger(text, labels, assessment.level);
  const thought = assessment.needsFixedSafety
    ? "希望消失、不想醒来、觉得生活没有意义"
    : inferThought(text);
  const response = inferResponse(text);
  const riskLevel = assessment.level;
  const summary = buildSummary(labels, intensity, trigger, riskLevel);

  return { emotionLabels: labels, intensity, trigger, thought, response, summary, riskLevel };
}

function inferTrigger(text: string, labels: string[], riskLevel: RiskLevel): string {
  if (riskLevel === "high" || riskLevel === "medium") return "";
  const pattern =
    /因为(.*?)(所以|，|,|。|\.|！|!|？|\?|$)|(?:今天|昨天|早上|下午|晚上|工作|同事|朋友|家人|爸妈|对象|男朋友|女朋友|同学|领导|考试|项目|加班)([^，。,。！!？?]{2,30})/;
  const match = text.match(pattern);
  if (match) {
    const candidate = (match[1] || match[2] || "").trim().slice(0, 45);
    if (candidate) return candidate;
  }
  const sentences = text.split(/[。！？!?\n；;，,]/).filter(Boolean).map((s) => s.trim()).filter((s) => s.length >= 4);
  if (sentences.length > 0) return sentences[0].slice(0, 60);
  return labels[0] || "今天发生的一件小事";
}

function inferThought(text: string): string {
  const pattern = /(?:觉得|感觉|认为|担心|怕|想)([^，。！？!?\n]{2,60})/;
  const match = text.match(pattern);
  if (match) {
    const thought = match[1].trim().slice(0, 80);
    if (thought) return thought;
  }
  if (/为什么|是不是我|怪我|我不够|我不好|都怪我/.test(text)) {
    return "好像在怀疑自己，觉得是不是自己的问题";
  }
  return "";
}

function inferResponse(text: string): string {
  const pattern = /(?:我(?:(?:就|便|会|只好|只能|一直|忍不住|最后|当时|后来))?([^，。！？!?\n]{2,40}))/;
  const match = text.match(pattern);
  if (match && /哭|说|吵|忍|睡|发呆|躲|走|做|删|发|想|坐|站|听|看/.test(match[1])) {
    return match[1].trim().slice(0, 60);
  }
  if (/想哭/.test(text)) return "想哭但没有真的哭出来";
  if (/失眠|睡不好|睡不着/.test(text)) return "夜里翻来覆去，睡不踏实";
  if (/不想说话/.test(text)) return "不想跟人说话，只想安静待着";
  if (/哭了|哭了出来/.test(text)) return "没忍住哭了";
  if (/躲起来|不想见人/.test(text)) return "把自己藏起来，不太想见人";
  return "";
}

function buildSummary(labels: string[], intensity: number, trigger: string, riskLevel: RiskLevel): string {
  const labelText = labels.length ? labels.join("、") : "有点复杂的心情";
  const intensityText = intensity >= 8 ? "很强" : intensity >= 5 ? "比较强" : "中等偏轻";
  if (riskLevel === "high") {
    return `今天${labelText}的感觉比较强。${trigger ? `“${trigger}”之后，心里像被压住了。` : "心里像被压住了。"}这个状态值得被认真对待，先照顾好自己。`;
  }
  if (riskLevel === "medium") {
    return `最近${labelText}持续了一段时间，强度${intensityText}。${trigger ? `“${trigger}”让这件事变得更难消化。` : ""}不是小题大做，这些感受是真实存在的。`;
  }
  if (labels.includes("开心") || labels.includes("安心") || labels.includes("平静")) {
    return `今天有一份${labelText}的感受${trigger ? `，来自“${trigger}”` : ""}。这些光亮也被小在好好记下来了。`;
  }
  return `今天${labelText}的感觉${intensityText}。${trigger ? `主要是因为“${trigger}”` : ""}，说出来的那一刻，它就没有完全压在心里了。`;
}

export function localReply(input: {
  text: string;
  userId: string;
  nickname: string;
  priorUserMessages: number;
  riskOverride?: RiskAssessment;
}): { message: string; kind: "chat" | "safety" | "draft"; draft?: StructuredDraft } {
  const assessment = input.riskOverride ?? assessRisk(input.text);
  const draft = extractEmotionDraft(input.text, assessment);
  const nickname = input.nickname || "你";
  const firstLabel = draft.emotionLabels[0] || "复杂的心情";
  const isFirstMessage = input.priorUserMessages === 0;

  if (assessment.needsFixedSafety) {
    return {
      message: `我有点担心你。现在先别一个人扛着，好吗？`,
      kind: "safety",
      draft,
    };
  }

  if (draft.riskLevel === "medium" && isFirstMessage) {
    return {
      message: `${nickname}，听起来这件事已经压了你一阵子了，${firstLabel}的感觉一点也不轻。\n\n你先不用硬撑。如果愿意，可以试着找一个你信任的人说说话；不想找人的话，也让自己稍微歇一下，别把“撑住”当成唯一选项。\n\n我想再多听一点点：这样难受的感觉，是今天突然出现的，还是已经悄悄跟了你很多天？`,
      kind: "chat",
    };
  }

  if (draft.riskLevel === "low" && isFirstMessage && !shouldExtractImmediately(input.text, draft)) {
    return {
      message: chooseLowPressureFollowUp(firstLabel, draft),
      kind: "chat",
    };
  }

  if (draft.riskLevel === "low" && isFirstMessage) {
    return {
      message: `${nickname}，我已经听好了，也帮你把这些感受整理了一下。`,
      kind: "draft",
    };
  }

  return {
    message: `${nickname}，我已经听好了，也帮你把这些感受整理了一下。`,
    kind: "draft",
  };
}

function shouldExtractImmediately(text: string, draft: StructuredDraft): boolean {
  const rich =
    text.length >= 70 || /(后来|然后|当时|其实|因为|所以|最近|每天|一直|可是|但是)/.test(text);
  return rich;
}

function chooseLowPressureFollowUp(firstLabel: string, draft: StructuredDraft): string {
  const choices: string[] = [
    `听起来那一刻真的挺不好受的。最让你难受的，是发生的事情本身，还是它让你开始怀疑自己的那一秒？`,
    `我听到你说“${draft.trigger.slice(0, 18)}”。如果给这阵${firstLabel}的感觉打个分，一到十，它现在在你心里是几分？`,
    `嗯，我在听。那件事发生的时候，你身体或心里有什么感觉？比如哪里发紧，或是一直想做什么又忍住了？`,
    `谢谢你愿意说给我听。${firstLabel}不是小事。如果它是你的一位朋友，你觉得它最想提醒你注意什么？`,
  ];
  return choices[Math.floor(Math.random() * choices.length)];
}

export function draftMessageFrom(draft: StructuredDraft): string {
  const labelText = draft.emotionLabels.join("、");
  if (draft.riskLevel === "high") {
    return `小在把这次对话看得很重。我整理出的情绪记录包含“${labelText}”和较高的风险提示，仅供你本人和已授权守护人参考，不构成任何诊断。你可以先不保存，也可以随时修改。`;
  }
  return `我帮你把这阵心情收进了一封小小记录里：${labelText}，强度 ${draft.intensity}/10。你可以看看，再决定要不要保存。`;
}
