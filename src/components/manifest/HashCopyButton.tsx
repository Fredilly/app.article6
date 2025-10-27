"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Check } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import clsx from "clsx";

type HashCopyButtonProps = {
  hash: string | undefined;
  className?: string;
};

export function HashCopyButton({ hash, className }: HashCopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const isCopyable = typeof hash === "string" && hash.length > 0;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    if (!isCopyable) return;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(hash);
      } else {
        const fallback = document.createElement("textarea");
        fallback.value = hash;
        fallback.setAttribute("readonly", "true");
        fallback.style.position = "absolute";
        fallback.style.left = "-9999px";
        document.body.appendChild(fallback);
        fallback.select();
        document.execCommand("copy");
        document.body.removeChild(fallback);
      }
      setCopied(true);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        timeoutRef.current = null;
      }, 1500);
    } catch (error) {
      console.warn("[HashCopyButton] Failed to copy hash", error);
    }
  };

  return (
    <Tooltip
      content={copied ? "Copied" : isCopyable ? "Copy SHA-256" : "Hash unavailable"}
      delay={copied ? 0 : 150}
    >
      <button
        type="button"
        aria-label="Copy SHA-256"
        onClick={handleCopy}
        disabled={!isCopyable}
        className={clsx(
          "inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40",
          copied ? "border-emerald-500 text-emerald-600" : "hover:border-slate-300 hover:text-slate-900",
          className,
        )}
      >
        {copied ? <Check className="h-5 w-5" aria-hidden="true" /> : <Copy className="h-5 w-5" aria-hidden="true" />}
      </button>
    </Tooltip>
  );
}

export default HashCopyButton;
