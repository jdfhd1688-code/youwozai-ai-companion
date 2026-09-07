"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Home as HomeIcon } from "lucide-react";

export default function TopRight({ backHref }: { backHref?: string }) {
  const router = useRouter();
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {backHref ? (
        <button className="icon-btn" aria-label="返回" onClick={() => router.push(backHref)}>
          <ArrowLeft size={20} />
        </button>
      ) : (
        <button className="icon-btn" aria-label="回到首页" onClick={() => router.push("/home")}>
          <HomeIcon size={20} />
        </button>
      )}
    </div>
  );
}
