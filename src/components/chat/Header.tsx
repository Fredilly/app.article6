'use client';

import { useEffect, useState } from "react";
import clsx from "clsx";
import { useChatStore } from "@/lib/store";

export default function Header() {
  const provider = useChatStore((s) => s.provider);
  const model = useChatStore((s) => s.model);
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/chat")
      .then((r) => r.json())
      .then(() => setOk(true))
      .catch(() => setOk(false));
  }, [provider, model]);

  return (
    <div className="flex items-center justify-between border-b p-4">
      <h1 className="font-semibold">Modular Chat UI</h1>
      <div className="flex items-center space-x-2 text-sm">
        <span>{provider}</span>
        <span>{model}</span>
        <span
          className={clsx(
            "w-2 h-2 rounded-full",
            ok === null ? "bg-gray-400" : ok ? "bg-green-500" : "bg-red-500"
          )}
        />
      </div>
    </div>
  );
}
