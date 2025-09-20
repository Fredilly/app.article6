import type { ChatMessage } from "./schema";
import type { QueryResponse } from "@/lib/engine/types";
export type { QueryResponse } from "@/lib/engine/types";

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

export async function retrieveQuery(text: string): Promise<QueryResponse> {
  const res = await fetch("/api/query?text=" + encodeURIComponent(text), { method: "GET" });
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    throw new Error(raw || `HTTP ${res.status}`);
  }
  return (await res.json()) as QueryResponse;
}
