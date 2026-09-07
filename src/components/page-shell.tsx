import type { ReactNode } from "react";
import AppNav from "@/components/app-nav";
import TopRight from "@/components/top-right";

export default function PageShell({
  title,
  subtitle,
  children,
  backHref,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  backHref?: string;
}) {
  return (
    <>
      <header className="topbar">
        <div className="topbar-main">
          <h1 className="topbar-title">{title}</h1>
          {subtitle ? <div className="topbar-sub">{subtitle}</div> : null}
        </div>
        <TopRight backHref={backHref} />
      </header>
      <div className="page">{children}</div>
      <AppNav />
    </>
  );
}
