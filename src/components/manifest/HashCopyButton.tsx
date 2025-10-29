"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import Tooltip from "@/components/ui/Tooltip";

type HashCopyButtonProps = {
  hash?: string;
};

export default function HashCopyButton({ hash }: HashCopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const canCopy = Boolean(hash);
  const tooltipContent = copyError
    ? copyError
    : copied
    ? "Copied"
    : "Copy SHA-256";

  async function handleCopy() {
    if (!hash || !canCopy) return;
    try {
      await navigator.clipboard.writeText(hash);
      setCopyError(null);
      setCopied(true);
    } catch (error) {
      setCopyError(
        error instanceof Error
          ? error.message
          : "Unable to copy hash. Use manual selection.",
      );
    }
  }

  return (
    <Tooltip content={tooltipContent}>
      <button
        type="button"
        aria-label="Copy SHA-256"
        onClick={handleCopy}
        disabled={!canCopy}
        className={`flex h-11 w-11 items-center justify-center rounded-full border text-slate-600 transition ${
          canCopy
            ? "border-slate-200 bg-white hover:border-slate-300 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500 focus-visible:outline-offset-2"
            : "cursor-not-allowed border-slate-100 bg-slate-100 text-slate-300"
        }`}
      >
        {copied ? (
          <Check className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Copy className="h-4 w-4" aria-hidden="true" />
        )}
        <span className="sr-only">Copy SHA-256 hash</span>
      </button>
    </Tooltip>
  );
}
