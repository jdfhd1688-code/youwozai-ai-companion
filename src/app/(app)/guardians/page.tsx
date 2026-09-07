import { getCurrentUser } from "@/lib/auth";
import { listGuardians, listNotificationEvents } from "@/lib/data-access";
import PageShell from "@/components/page-shell";
import GuardiansClient from "./guardians-client";

export default async function GuardiansPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const guardians = listGuardians(user.id);
  const events = listNotificationEvents(user.id);
  return (
    <PageShell title="守护圈" subtitle="他们是你现实里，可以轻轻敲敲门的人">
      <GuardiansClient user={user} initialGuardians={guardians} initialEvents={events} />
    </PageShell>
  );
}
