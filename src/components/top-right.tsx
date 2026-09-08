"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Home as HomeIcon, UserRound } from "lucide-react";

export default function TopRight({ backHref }: { backHref?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {backHref ? (
        <button className="icon-btn" aria-label="返回" onClick={() => router.push(backHref)}>
          <ArrowLeft size={20} />
        </button>
      ) : pathname !== "/home" ? (
        <button className="icon-btn" aria-label="回到首页" onClick={() => router.push("/home")}>
          <HomeIcon size={20} />
        </button>
      ) : null}
      {pathname !== "/privacy" ? (
        <button className="icon-btn" aria-label="打开我的设置与隐私" onClick={() => router.push("/privacy")}>
          <UserRound size={20} />
        </button>
      ) : null}
    </div>
  );
}
