"use client";

import Image from "next/image";
import { useState } from "react";

interface Message {
  role: string;
  content: string;
}

export default function VlmPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const apiUrl =
    process.env.NEXT_PUBLIC_VLM_API_URL || "http://localhost:8000";

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const send = async () => {
    const nextMessages = [...messages, { role: "user", content: input }];
    setMessages(nextMessages);
    setInput("");
    const payload: { messages: Message[]; images?: string[] } = {
      messages: nextMessages,
    };
    if (image) payload.images = [image];
    const res = await fetch(`${apiUrl}/api/vlm/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setMessages([...nextMessages, { role: "assistant", content: data.text }]);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex gap-6">
        <div className="flex-1 flex flex-col space-y-4">
          <div className="border rounded p-2 flex-1 overflow-y-auto h-96">
            {messages.map((m, i) => (
              <div key={i} className="mb-2">
                <span className="font-bold">{m.role}:</span> {m.content}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="border p-2 flex-1"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
            />
            <button
              className="border px-4"
              onClick={send}
              disabled={!input}
            >
              Send
            </button>
            <button
              className="border px-4"
              onClick={() => {
                setMessages([]);
                setImage(null);
              }}
            >
              Clear
            </button>
          </div>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFile}
          />
        </div>
        <div className="w-1/3 border rounded flex items-center justify-center">
          {image ? (
            <Image
              src={image}
              alt="preview"
              className="max-w-full"
              width={400}
              height={400}
            />
          ) : (
            <span className="text-sm text-gray-500">No image</span>
          )}
        </div>
      </div>
    </div>
  );
}
