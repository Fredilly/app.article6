import React, { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/chat/schema";

export default function MessageList({ messages }: { messages: ChatMessage[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [messages]);
  return (
    <div ref={ref} className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map((m, i) => (
        <div
          key={i}
          className={
            m.role === "user"
              ? "ml-auto max-w-[80%] rounded-2xl bg-black text-white px-4 py-2"
              : "mr-auto max-w-[80%] rounded-2xl bg-gray-100 px-4 py-2"
          }
        >
          {m.content}
        </div>
      ))}
    </div>
  );
}
