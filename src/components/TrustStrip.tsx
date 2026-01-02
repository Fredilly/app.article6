"use client";

import { useCallback, useMemo, useState } from "react";

type AuditHash = {
  label: string;
  value?: string;
};

type TrustStripProps = {
  methodCode?: string;
  version?: string;
  generatedAt?: string;
  repoSha?: string;
  auditHashes?: AuditHash[];
};

function formatSha(value?: string): string {
  if (!value) return "—";
  return value.length > 10 ? value.slice(0, 7) : value;
}

function formatDateLabel(value?: string): string {
  if (!value) return "—";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
      date,
    );
  } catch {
    return value;
  }
}

function CopyButton({ value, label }: { value?: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 900);
    } catch {
      setCopied(false);
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!value}
      className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      aria-label={`Copy ${label}`}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function TrustStrip({
  methodCode,
  version,
  generatedAt,
  repoSha,
  auditHashes,
}: TrustStripProps) {
  const hashRows = useMemo(() => (auditHashes ?? []).filter((hash) => hash.label), [auditHashes]);

  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold text-slate-900">Method</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
            {methodCode ?? "—"}
          </span>
          <span className="text-slate-400">/</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
            {version ?? "—"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>
            repo:{" "}
            <span className="font-mono text-slate-700">{formatSha(repoSha)}</span>
          </span>
          <CopyButton value={repoSha} label="repo sha" />
          <span className="text-slate-300">|</span>
          <span>generated_at: {formatDateLabel(generatedAt)}</span>
        </div>
      </div>

      {hashRows.length ? (
        <div className="mt-3 grid gap-2">
          {hashRows.map((hash) => (
            <div
              key={hash.label}
              className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-700">{hash.label}</span>
                <span className="break-all font-mono text-xs text-slate-600">
                  {hash.value ?? "—"}
                </span>
              </div>
              <CopyButton value={hash.value} label={hash.label} />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 text-xs text-slate-500">audit hashes: —</div>
      )}
    </div>
  );
}
