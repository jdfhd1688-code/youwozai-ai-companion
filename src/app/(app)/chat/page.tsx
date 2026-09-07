import { getCurrentUser } from "@/lib/auth";
import { pickOpening } from "@/lib/companion";
import PageShell from "@/components/page-shell";
import ChatClient from "./chat-client";

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const opening = pickOpening();
  return <PageShell title="和小在聊聊" subtitle="想说什么都可以，不用先想好"><ChatClient user={user} opening={opening} /></PageShell>;
}
