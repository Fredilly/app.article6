'use client';

import ReactMarkdown from "react-markdown";
import clsx from "clsx";
import { useChatStore } from "@/lib/store";

export default function MessageList() {
  const activeId = useChatStore((s) => s.activeId);
  const conversation = useChatStore((s) =>
    activeId ? s.conversations[activeId] : undefined
  );
  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Try asking me something...
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
      {conversation.messages.map((m, i) => (
        <div
          key={i}
          className={clsx(
            "max-w-prose",
            m.role === "user" ? "self-end" : "self-start"
          )}
        >
          <div
            className={clsx(
              "rounded-lg p-3",
              m.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            )}
          >
            <ReactMarkdown>{m.content}</ReactMarkdown>
          </div>
        </div>
      ))}
    </div>
  );
}
