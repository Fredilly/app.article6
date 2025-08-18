'use client';

import { useState } from "react";
import { useChat } from "@/lib/useChat";

export default function Composer() {
  const [text, setText] = useState("");
  const [images, setImages] = useState("");
  const { sendMessage } = useChat();

  const doSubmit = () => {
    if (!text.trim()) return;
    const imgs = images
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    sendMessage(text, imgs.length ? imgs : undefined);
    setText("");
    setImages("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    doSubmit();
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      doSubmit();
    }
  };

  return (
    <form onSubmit={submit} className="p-4 border-t space-y-2">
      <textarea
        className="w-full border rounded p-2"
        placeholder="What would you like to verify?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        rows={3}
      />
      <input
        type="text"
        className="w-full border rounded p-2 text-sm"
        placeholder="Image URLs (comma separated)"
        value={images}
        onChange={(e) => setImages(e.target.value)}
      />
      <div className="flex justify-end">
        <button
          type="submit"
          className="bg-primary text-primary-foreground px-4 py-2 rounded"
        >
          Send
        </button>
      </div>
    </form>
  );
}
