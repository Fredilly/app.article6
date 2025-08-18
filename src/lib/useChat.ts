'use client';

import { streamResponse } from "@/lib/stream";
import { useChatStore } from "@/lib/store";

export function useChat() {
  const sendMessage = async (text: string, images?: string[]) => {
    const state = useChatStore.getState();
    const id = state.activeId || state.newConversation();
    state.addMessage(id, { role: "user", content: text });
    state.addMessage(id, { role: "assistant", content: "" });
    const messages = useChatStore.getState().conversations[id].messages;

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        images,
        provider: state.provider,
        model: state.model,
        temperature: state.temperature,
      }),
    });

    await streamResponse(res, (token) => {
      useChatStore.setState((s) => {
        const convo = s.conversations[id];
        const msgs = convo.messages.slice();
        msgs[msgs.length - 1].content += token;
        return {
          conversations: {
            ...s.conversations,
            [id]: { ...convo, messages: msgs },
          },
        };
      });
    });
  };

  return { sendMessage };
}
