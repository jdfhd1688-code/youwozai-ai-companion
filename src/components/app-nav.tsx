"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, History, Mail, Shield } from "lucide-react";

const ITEMS = [
  { href: "/chat", label: "聊聊", icon: MessageCircle },
  { href: "/records", label: "这一段路", icon: History },
  { href: "/letter", label: "来信", icon: Mail },
  { href: "/guardians", label: "守护圈", icon: Shield },
];

export default function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="bottom-nav" aria-label="主导航">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={active ? "active" : ""}>
            <Icon size={20} strokeWidth={2.1} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
