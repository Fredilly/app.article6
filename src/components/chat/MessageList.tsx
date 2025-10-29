import React, { useEffect, useRef } from "react";
import Image from "next/image";
import type { ChatMessage } from "@/lib/chat/schema";

export default function MessageList({ messages }: { messages: ChatMessage[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [messages]);
  return (
    <div ref={ref} className="flex-1 space-y-3 overflow-y-auto px-4 py-5">
      {messages.map((m, i) => (
        <div
          key={i}
          className={m.role === "user" ? "ml-auto max-w-[78%]" : "mr-auto max-w-[78%]"}
        >
          {m.image ? (
            <Image
              src={m.image}
              alt="user upload"
              width={1024}
              height={1024}
              unoptimized
              className="h-auto w-full max-w-md rounded-2xl border border-slate-200 object-contain shadow-sm"
            />
          ) : (
            <div
              className={
                m.role === "user"
                  ? "rounded-2xl bg-slate-900 px-4 py-3 text-sm leading-6 text-white shadow-sm"
                  : "rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm"
              }
            >
              {m.content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
