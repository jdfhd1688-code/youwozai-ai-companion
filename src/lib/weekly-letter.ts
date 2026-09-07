import {
  insertWeeklyLetter,
  listEmotionRecordsBetween,
  listWeeklyLetters,
} from "./data-access";
import type { EmotionRecordRow, WeeklyLetterRow } from "./data-access";

export type ChartData = {
  periodStart: string;
  periodEnd: string;
  days: Array<{ day: string; intensity: number; labels: string[]; records: number }>;
  labelDistribution: Array<{ label: string; count: number; percent: number }>;
  topStressors: Array<{ stressor: string; count: number }>;
  riskCounts: { low: number; medium: number; high: number };
  recordCount: number;
  activeDays: number;
  avgIntensity: number;
};

function dateKey(iso: string): string {
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildChartData(records: EmotionRecordRow[]): ChartData {
  const byDay = new Map<string, { intensity: number; labels: string[]; records: number }>();
  const labelCount = new Map<string, number>();
  const stressorCount = new Map<string, number>();
  let totalIntensity = 0;
  const riskCounts = { low: 0, medium: 0, high: 0 };

  for (const record of records) {
    const key = dateKey(record.createdAt);
    const existing = byDay.get(key) || { intensity: 0, labels: [] as string[], records: 0 };
    existing.intensity += record.intensity;
    existing.records += 1;
    existing.labels.push(...record.emotionLabels);
    byDay.set(key, existing);
    totalIntensity += record.intensity;
    riskCounts[record.riskLevel] += 1;
    for (const label of record.emotionLabels) labelCount.set(label, (labelCount.get(label) || 0) + 1);
    if (record.trigger) {
      const short = record.trigger.slice(0, 18);
      stressorCount.set(short, (stressorCount.get(short) || 0) + 1);
    }
  }

  const sortedDays = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b));
  const days = sortedDays.map(([day, value]) => ({
    day,
    intensity: Math.round(value.intensity / value.records),
    labels: Array.from(new Set(value.labels)),
    records: value.records,
  }));

  const totalLabelCount = Array.from(labelCount.values()).reduce((a, b) => a + b, 0) || 1;
  const labelDistribution = Array.from(labelCount.entries())
    .map(([label, count]) => ({ label, count, percent: Math.round((count / totalLabelCount) * 100) }))
    .sort((a, b) => b.count - a.count);

  const topStressors = Array.from(stressorCount.entries())
    .map(([stressor, count]) => ({ stressor, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const recordCount = records.length;
  return {
    periodStart: records[0]?.createdAt || "",
    periodEnd: records[records.length - 1]?.createdAt || "",
    days,
    labelDistribution,
    topStressors,
    riskCounts,
    recordCount,
    activeDays: byDay.size,
    avgIntensity: recordCount ? Math.round((totalIntensity / recordCount) * 10) / 10 : 0,
  };
}

function pickTrendLabel(chart: ChartData): string {
  const top = chart.labelDistribution[0];
  return top ? top.label : "复杂";
}

function composeSummary(chart: ChartData, nickname: string): string {
  const top = chart.labelDistribution.slice(0, 2).map((d) => d.label).join("、");
  if (chart.recordCount === 0) return `这周还没有留下记录，等你想说的时候，我都在。`;
  if (chart.recordCount === 1) {
    return `这周你留下了一段记录，我看见${top || "一种还不太容易被命名的感受"}被你认真接住了。`;
  }
  const streak = chart.activeDays >= 3 ? `有 ${chart.activeDays} 天都愿意留一点时间给自己` : `在 ${chart.activeDays} 天里给情绪留了位置`;
  return `这周你一共写下 ${chart.recordCount} 段心情，${streak}。${top ? `“${top}”是你这周最常出现的感受，平均强度 ${chart.avgIntensity}/10。` : ""}我没有把任何一天当成“数据”，每一段都是你愿意开口的证据。`;
}

function composeInsight(chart: ChartData): string {
  if (chart.recordCount < 3) {
    return "记录还不多，我不会急着“看穿”你。等再多留几段，那些反复出现的感受才会慢慢露出轮廓。";
  }
  const repeatedLabels = chart.labelDistribution.filter((d) => d.count >= 2).slice(0, 3).map((d) => d.label);
  const repeatedStressors = chart.topStressors.filter((s) => s.count >= 2).slice(0, 3).map((s) => s.stressor);
  const parts: string[] = [];
  if (repeatedLabels.length >= 1) {
    parts.push(`“${repeatedLabels[0]}”在这周出现过不止一次，它可能不是偶然路过，而是一封常常被忽略的便条`);
  }
  if (repeatedStressors.length >= 1) {
    parts.push(`几次记录都提到了“${repeatedStressors[0]}”`);
  }
  if (parts.length === 0) {
    return "这一周的感受还比较分散，我暂时只看到一个规律：你愿意在情绪来的时候停下来看看它，这件事本身已经在改变什么。";
  }
  return `我发现了一个小小的规律：${parts.join("，")}。这不是诊断，只是一种“原来它常来”的观察。`;
}

function composePromise(chart: ChartData, nickname: string): string {
  const top = pickTrendLabel(chart);
  const topCount = chart.labelDistribution[0]?.count || 0;
  if (topCount >= 2) {
    return `下周不急着消灭“${top}”。它来的时候，试着给它 3 分钟：只说出来，不解决、不评判。`;
  }
  if (chart.avgIntensity >= 7) {
    return `下周给自己留一次“什么都不用做好”的休息，睡饱或发一会儿呆都算数。`;
  }
  return `下周挑一个感觉还好的时刻，把那天的光亮也记一句给我听。`;
}

export type LetterPayload = {
  letter: WeeklyLetterRow;
  chart: ChartData;
  milestones: Array<{ title: string; achieved: boolean; date?: string }>;
};

export function latestLetterOrNull(userId: string, nickname: string): LetterPayload | null {
  const existing = listWeeklyLetters(userId);
  if (existing[0]) {
    return {
      letter: existing[0],
      chart: JSON.parse(existing[0].chartData),
      milestones: buildMilestones(userId),
    };
  }
  return null;
}

export function generateLetterForUser(userId: string, nickname: string): LetterPayload {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  let records = listEmotionRecordsBetween(userId, sevenDaysAgo.toISOString(), now.toISOString());
  let isThirtyDayFallback = false;
  if (records.length < 3) {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    records = listEmotionRecordsBetween(userId, thirtyDaysAgo.toISOString(), now.toISOString());
    isThirtyDayFallback = true;
  }
  const chart = buildChartData(records);
  if (records.length === 0) {
    throw new Error("还没有可用来写周信的心情记录，先和小在聊聊并保存一段心情吧");
  }
  const periodStart = chart.periodStart.slice(0, 10);
  const periodEnd = chart.periodEnd.slice(0, 10);
  const summaryText = composeSummary(chart, nickname);
  const insightText = composeInsight(chart);
  const nextWeekPromise = composePromise(chart, nickname);
  const opening = `${nickname}，见字如面。这封小在的信，只写给你的真实记录，不写我不知道的事。`;
  const closing = "这一周，谢谢你愿意在那些说不清的时刻里，还想起有我在。";
  const greeting = isThirtyDayFallback ? "（这一周记录较少，我参考了你最近 30 天的记录）" : "";
  const letter = insertWeeklyLetter({
    userId,
    periodStart,
    periodEnd,
    summaryText: `${opening}\n\n${summaryText}\n\n${greeting}`,
    insightText,
    nextWeekPromise,
    chartData: chart,
  });
  const completeText = `${letter.summaryText}\n\n${letter.insightText}\n\n${letter.nextWeekPromise}\n\n${closing}\n\n—— 小在`;
  return {
    letter: { ...letter, summaryText: completeText },
    chart,
    milestones: buildMilestones(userId),
  };
}

export function buildMilestones(userId: string) {
  const records = listEmotionRecordsBetween(
    userId,
    new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    new Date().toISOString()
  );
  const first = records[0];
  const daySet = new Set(records.map((r) => dateKey(r.createdAt)));
  const letterDone = listWeeklyLetters(userId).length > 0;
  const milestones = [
    { title: "第一次认真记录自己的感受", achieved: records.length > 0, date: first?.createdAt },
    { title: "连续记录 7 天", achieved: daySet.size >= 7 },
    { title: "第一次主动联系守护人", achieved: false },
    { title: "第一次完成一封每周来信", achieved: letterDone },
  ];
  return milestones;
}
