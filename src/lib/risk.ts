import type { RiskLevel } from "@/lib/db";

export type RiskAssessment = {
  level: RiskLevel;
  evidence: string[];
  flags: string[];
  needsFixedSafety: boolean;
};

const HIGH_FLAGS = [
  "想死",
  "去死",
  "自杀",
  "轻生",
  "不想活",
  "活着没意思",
  "结束生命",
  "结束自己",
  "伤害自己",
  "割腕",
  "跳楼",
  "了结",
  "告别世界",
  "想消失",
  "能消失就好了",
  "不想醒来",
  "早上不想醒来",
  "不想活了",
  "想离开这个世界",
  "不要醒来就好了",
  "不用醒来就好了",
  "不醒来就好了",
  "如果我不存在就好了",
  "想离开这个世界",
  "不想继续了",
  "不想再活下去了",
  "希望一切结束",
  "想割自己",
  "控制不住想伤害自己",
  "已经想好怎么做了",
  "我知道该怎么结束",
  "该怎么结束这一切",
  "要怎么结束这一切",
  "把该交代的事情都交代好了",
  "把事情交代好了",
  "已经跟大家说再见了",
  "今晚睡着以后就不要再醒",
  "睡着以后就不要再醒",
];

const MEDIUM_FLAGS = [
  "绝望",
  "撑不下去",
  "没有希望",
  "没有意义",
  "走不出来",
  "被困住",
  "无法摆脱",
  "不想见人",
  "想消失",
  "想一个人待着",
  "躲起来",
  "彻底崩溃",
  "坚持不了",
  "没有任何意义",
  "没有希望了",
  "已经到头了",
  "我受够了",
  "大家没有我可能更好",
  "大家没有我可能会过得更好",
  "我不想再拖累他们",
  "谢谢你们这些年",
  "彻底消失是不是会轻松一点",
];

const LOW_SUPPORT_FLAGS = [
  "难受",
  "委屈",
  "焦虑",
  "烦躁",
  "压力",
  "失眠",
  "睡不好",
  "心慌",
  "想哭",
  "低落",
  "害怕",
  "生气",
  "失落",
];

export function assessRisk(text: string): RiskAssessment {
  const compact = String(text || "").toLowerCase();
  const evidence: string[] = [];
  const flags: string[] = [];

  if (HIGH_FLAGS.some((flag) => compact.includes(flag))) {
    flags.push(...HIGH_FLAGS.filter((flag) => compact.includes(flag)).slice(0, 3));
    evidence.push("出现可能涉及自伤/轻生倾向的表达");
    return { level: "high", evidence, flags, needsFixedSafety: true };
  }

  if (MEDIUM_FLAGS.some((flag) => compact.includes(flag))) {
    flags.push(...MEDIUM_FLAGS.filter((flag) => compact.includes(flag)).slice(0, 3));
    evidence.push("出现持续痛苦或社会退缩相关表达");
    return { level: "medium", evidence, flags, needsFixedSafety: false };
  }

  const lowMatched = LOW_SUPPORT_FLAGS.filter((flag) => compact.includes(flag)).slice(0, 3);
  if (lowMatched.length > 0) {
    flags.push(...lowMatched);
    evidence.push("出现需要陪伴支持的情绪表达");
    return { level: "low", evidence, flags, needsFixedSafety: false };
  }

  return { level: "low", evidence: [], flags: [], needsFixedSafety: false };
}

export const RISK_DISPLAY: Record<RiskLevel, { label: string; tone: string }> = {
  low: { label: "较低", tone: "warm" },
  medium: { label: "中", tone: "blue" },
  high: { label: "较高", tone: "orange" },
};
