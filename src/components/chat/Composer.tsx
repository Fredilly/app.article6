import React, { useState } from "react";

export default function Composer({
  onSend,
  disabled
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  return (
    <form
      className="border-t p-3 flex items-center gap-2"
      onSubmit={e => {
        e.preventDefault();
        if (!text.trim() || disabled) return;
        onSend(text.trim());
        setText("");
      }}
    >
      <input
        className="flex-1 rounded-xl border px-3 py-2 outline-none"
        placeholder="Type here…"
        value={text}
        onChange={e => setText(e.target.value)}
        disabled={disabled}
      />
      <button
        type="submit"
        disabled={disabled}
        className="rounded-xl bg-black text-white px-4 py-2 disabled:opacity-50"
      >
        Send
      </button>
    </form>
  );
}
