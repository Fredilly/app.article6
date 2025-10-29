import React, { useRef, useState } from "react";
import { Plus } from "lucide-react";

export default function Composer({
  onSend,
  onUploadImage,
  disabled
}: {
  onSend: (text: string) => void;
  onUploadImage: (dataUrl: string) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        onUploadImage(result);
      }
      e.target.value = "";
    };
    reader.readAsDataURL(file);
  }

  return (
    <form
      className="flex items-center gap-2 border-t border-slate-100 bg-white/90 px-3 py-2"
      onSubmit={e => {
        e.preventDefault();
        if (!text.trim() || disabled) return;
        onSend(text.trim());
        setText("");
      }}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        aria-label="Upload image"
        onClick={() => fileRef.current?.click()}
        disabled={disabled}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
      </button>
      <input
        className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-0 disabled:cursor-not-allowed disabled:bg-slate-100"
        placeholder="Type here…"
        value={text}
        onChange={e => setText(e.target.value)}
        disabled={disabled}
      />
      <button
        type="submit"
        disabled={disabled}
        className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500/70"
      >
        Send
      </button>
    </form>
  );
}
