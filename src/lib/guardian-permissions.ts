import type { GuardianPermissions } from "./data-access";

export function buildGuardianPatch(body: Record<string, unknown>): Partial<GuardianPermissions> {
  const patch: Partial<GuardianPermissions> = {};
  if ("notifyOnHighRisk" in body) patch.notifyOnHighRisk = Boolean(body.notifyOnHighRisk);
  if ("shareNeedSupport" in body) patch.shareNeedSupport = Boolean(body.shareNeedSupport);
  if ("shareRiskLevel" in body) patch.shareRiskLevel = Boolean(body.shareRiskLevel);
  if ("shareEmotionLabels" in body) patch.shareEmotionLabels = Boolean(body.shareEmotionLabels);
  if ("shareTrend" in body) patch.shareTrend = Boolean(body.shareTrend);
  if ("shareStressor" in body) patch.shareStressor = Boolean(body.shareStressor);
  if ("personalMessage" in body) patch.personalMessage = String(body.personalMessage || "").slice(0, 200);
  return patch;
}
