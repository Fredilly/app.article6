import type { ChatMessage } from "./schema";

export async function sendChat(messages: ChatMessage[]): Promise<ChatMessage[]> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { messages: ChatMessage[] };
  return data.messages;
}
