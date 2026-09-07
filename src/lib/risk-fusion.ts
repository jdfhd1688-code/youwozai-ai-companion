import { assessRisk } from "./risk";
import type { RiskAssessment } from "./risk";
import type { RiskLevel } from "./db";

export type SemanticRisk = {
  riskLevel: RiskLevel;
  signals: string[];
  reason: string;
  confidence: number;
};

export type TrendRisk = {
  riskLevel: RiskLevel;
  signals: string[];
  recentIntensity: number;
  negativeRatio: number;
};

export function deterministicRiskFusion(
  rule: RiskAssessment,
  semantic?: SemanticRisk | null,
  trend?: TrendRisk | null
): RiskAssessment {
  const signals = [...rule.flags];
  const evidence = [...rule.evidence];

  if (rule.level === "high") {
    return { level: "high", evidence, flags: signals, needsFixedSafety: true };
  }

  if (semantic?.riskLevel === "high" && semantic.confidence >= 0.72) {
    return { level: "high", evidence: [...evidence, semantic.reason], flags: [...signals, ...semantic.signals], needsFixedSafety: true };
  }

  if (trend?.riskLevel === "high" && trend.recentIntensity >= 8 && trend.negativeRatio >= 0.7) {
    return { level: "high", evidence: [...evidence, ...trend.signals], flags: signals, needsFixedSafety: true };
  }

  if (semantic?.riskLevel === "medium" || rule.level === "medium" || trend?.riskLevel === "medium") {
    return {
      level: "medium",
      evidence: [...evidence, ...(semantic?.signals || []), ...(trend?.signals || [])],
      flags: [...signals, ...(semantic?.signals || [])],
      needsFixedSafety: false,
    };
  }

  return rule;
}

export function buildTrendRisk(input: {
  recentCount: number;
  negativeCount: number;
  averageIntensity: number;
}): TrendRisk | null {
  const negativeRatio = input.recentCount > 0 ? input.negativeCount / input.recentCount : 0;
  if (input.recentCount >= 3 && negativeRatio >= 0.7 && input.averageIntensity >= 8) {
    return {
      riskLevel: "high",
      signals: ["近期多个高强度低落/焦虑记录持续出现"],
      recentIntensity: input.averageIntensity,
      negativeRatio,
    };
  }
  if (input.recentCount >= 3 && negativeRatio >= 0.5) {
    return {
      riskLevel: "medium",
      signals: ["近期低落或焦虑情绪出现较频繁"],
      recentIntensity: input.averageIntensity,
      negativeRatio,
    };
  }
  return null;
}

export { assessRisk };
