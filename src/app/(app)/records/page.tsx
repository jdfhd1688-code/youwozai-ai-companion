import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { listEmotionRecords } from "@/lib/data-access";
import PageShell from "@/components/page-shell";
import RecordsClient from "./records-client";

export default async function RecordsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const records = listEmotionRecords(user.id);
  return (
    <PageShell title="我的这一段路" subtitle={records.length ? `${records.length} 段被好好接住的经历` : "你留下的每一句，都会在这里"}>
      <section className="soft-card" style={{ marginBottom: 14 }}>
        <strong>先从你确认保存过的经历慢慢回望</strong>
        <p className="tiny muted" style={{ margin: "6px 0 0", lineHeight: 1.7 }}>
          现在这里按时间放好你的情绪和经历。以后只有经过你确认，小在才会把反复出现的重要事情、人物和一段时间的变化串在一起。
        </p>
      </section>
      {records.length === 0 ? (
        <section className="card empty">
          <p>还没有保存过心情记录。</p>
          <Link className="btn btn-primary" href="/chat" style={{ marginTop: 8 }}>
            <MessageCircle size={18} />
            和小在聊聊
          </Link>
        </section>
      ) : (
        <RecordsClient initialRecords={records} />
      )}
    </PageShell>
  );
}
