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
    <PageShell title="我走过的日子" subtitle={records.length ? `${records.length} 段被好好接住的心情` : "你留下的每一句，都会在这里"}>
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
