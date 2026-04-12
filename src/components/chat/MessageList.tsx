import React, { useEffect, useRef } from "react";
import Image from "next/image";
import type { ChatMessage } from "@/lib/chat/schema";

export default function MessageList({
  messages,
  children,
}: {
  messages: ChatMessage[];
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ref.current || typeof ref.current.scrollTo !== "function") return;
    ref.current.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [children, messages]);
  return (
    <div ref={ref} className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
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
              className="rounded-3xl h-auto w-full max-w-md border border-gray-200 object-contain shadow-sm"
            />
          ) : (
            <div
              className={
                m.role === "user"
                  ? "rounded-3xl bg-gray-900 px-5 py-3 text-sm leading-6 text-white shadow"
                  : "rounded-3xl border border-gray-200 bg-white px-5 py-3 text-sm leading-6 text-gray-700 shadow-sm"
              }
            >
              {m.content}
            </div>
          )}
        </div>
      ))}
      {children}
    </div>
  );
}
