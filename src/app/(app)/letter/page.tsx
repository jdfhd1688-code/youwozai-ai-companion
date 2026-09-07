import { getCurrentUser } from "@/lib/auth";
import { latestLetterOrNull } from "@/lib/weekly-letter";
import PageShell from "@/components/page-shell";
import LetterClient from "./letter-client";

export default async function LetterPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const payload = latestLetterOrNull(user.id, user.nickname);
  return (
    <PageShell title="有我在·每周来信" subtitle="只写你的真实记录，不写我不知道的事">
      <LetterClient initialPayload={payload} nickname={user.nickname} />
    </PageShell>
  );
}
