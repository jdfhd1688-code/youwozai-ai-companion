import { getCurrentUser } from "@/lib/auth";
import { listGuardians, listAiMemories, listEmotionRecords } from "@/lib/data-access";
import PageShell from "@/components/page-shell";
import PrivacyClient from "./privacy-client";

export default async function PrivacyPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const guardians = listGuardians(user.id);
  const memories = listAiMemories(user.id);
  const records = listEmotionRecords(user.id);
  return (
    <PageShell title="我 · 隐私中心" subtitle="系统记住什么、分享什么，都由你说了算">
      <PrivacyClient user={user} guardians={guardians} memories={memories} records={records} />
    </PageShell>
  );
}
