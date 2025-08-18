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
      className="border-t p-3 flex items-center gap-2"
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
        className="rounded-xl border px-3 py-2 disabled:opacity-50"
      >
        <Plus className="h-5 w-5" />
      </button>
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
