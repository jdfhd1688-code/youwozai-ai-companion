import type { Metadata, Viewport } from "next";
import "./globals.css";
import { VoiceLifecycle } from "@/components/voice-player";

export const metadata: Metadata = {
  title: "有我在",
  description: "和小在聊聊，把说不清的情绪好好安放。",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "有我在",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f0e6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="app-shell">{children}<VoiceLifecycle /></div>
      </body>
    </html>
  );
}
