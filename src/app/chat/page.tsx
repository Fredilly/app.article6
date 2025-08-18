"use client";

import { useState, FormEvent } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const userMessage: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage, { role: "assistant", content: "..." }]);
    setInput("");

    try {
      const res = await fetch("/api/qwen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userMessage.content })
      });
      const data = await res.json();
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { role: "assistant", content: data.response };
        return newMessages;
      });
    } catch {
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          role: "assistant",
          content: "Error",
        };
        return newMessages;
      });
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-2">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`max-w-xs p-2 rounded-lg ${
              m.role === "user"
                ? "ml-auto bg-blue-500 text-white"
                : "mr-auto bg-gray-200"
            }`}
          >
            {m.content}
          </div>
        ))}
      </div>
      <form
        onSubmit={handleSubmit}
        className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex space-x-2"
      >
        <input
          className="flex-1 border rounded p-2"
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
          Send
        </button>
      </form>
    </div>
  );
}

