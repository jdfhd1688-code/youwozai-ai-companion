import Link from "next/link";
import { MessageCircle, Mail, ShieldCheck, History } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { countsForUser } from "@/lib/data-access";
import PageShell from "@/components/page-shell";
import Mascot from "@/components/mascot";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "夜深了，还在想着事情吗";
  if (hour < 11) return "早上好，新的一天慢慢来";
  if (hour < 14) return "中午好，别忘了给自己喘口气";
  if (hour < 18) return "下午好，今天辛苦啦";
  return "晚上好，今天有没有什么想放下的";
}

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const counts = countsForUser(user.id);
  const date = new Date();
  const dateText = `${date.getMonth() + 1}月${date.getDate()}日 · ${["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()]}`;

  return (
    <PageShell title={`你好，${user.nickname}`} subtitle={dateText}>
      <section className="card center" style={{ paddingTop: 26 }}>
        <p style={{ margin: "0 0 4px", color: "#a4662e", fontWeight: 650 }}>{greeting()}，我是小在</p>
        <div className="mascot-wrap floaty" style={{ marginTop: 8 }}>
          <Mascot size={184} mood="smile" />
        </div>
        <p className="muted" style={{ lineHeight: 1.75, margin: "10px 4px 22px" }}>
          我在。你不用先想清楚自己是什么情绪，
          <br />
          想说的时候慢慢说就好。
        </p>
        <Link className="btn btn-primary btn-block" href="/chat">
          <MessageCircle size={19} />
          和小在聊聊
        </Link>
        <div className="row wrap" style={{ marginTop: 12, gap: 8 }}>
          <Link className="btn btn-soft" style={{ flex: 1 }} href="/letter">
            <Mail size={17} />
            每周来信
          </Link>
          <Link className="btn btn-soft" style={{ flex: 1 }} href="/guardians">
            <ShieldCheck size={17} />
            守护圈
          </Link>
        </div>
      </section>

      <section className="soft-card" style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#a4662e" }}>{counts.recordCount}</div>
          <div className="tiny muted">段心情记录</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#5a7e8c" }}>{counts.chatCount}</div>
          <div className="tiny muted">次轻轻开口</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#6c8a72" }}>{counts.guardCount}</div>
          <div className="tiny muted">位守护人</div>
        </div>
      </section>

      <Link href="/records" className="card row" style={{ display: "flex", marginTop: 14 }}>
        <div>
          <div style={{ fontWeight: 750 }}>看看我走过的日子</div>
          <p className="tiny muted" style={{ margin: "5px 0 0" }}>每一段被记录下来的心情，都在那里安静地陪着你</p>
        </div>
        <History size={22} style={{ color: "#b99b7c", flex: "0 0 auto" }} />
      </Link>
    </PageShell>
  );
}
