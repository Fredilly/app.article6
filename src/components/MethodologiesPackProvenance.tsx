"use client";

import { useEffect, useMemo, useState } from "react";

type Provenance = {
  repo?: string;
  sha?: string;
  generated_at?: string;
};

function shortSha(value?: string) {
  if (!value) return "—";
  return value.length > 12 ? value.slice(0, 12) : value;
}

export default function MethodologiesPackProvenance() {
  const [provenance, setProvenance] = useState<Provenance | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/_provenance/methodologies_PROVENANCE.json", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = (await response.json()) as unknown;
        if (cancelled) return;
        if (!json || typeof json !== "object") {
          setProvenance(null);
          setError("Invalid provenance JSON");
          return;
        }
        const record = json as Record<string, unknown>;
        setProvenance({
          repo: typeof record.repo === "string" ? record.repo : undefined,
          sha: typeof record.sha === "string" ? record.sha : undefined,
          generated_at: typeof record.generated_at === "string" ? record.generated_at : undefined,
        });
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setProvenance(null);
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rawJson = useMemo(() => {
    if (!provenance) return "";
    return JSON.stringify(provenance, null, 2);
  }, [provenance]);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
      <span className="font-semibold text-slate-600">Pack provenance</span>
      {provenance ? (
        <>
          <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700">
            {provenance.repo ?? "—"}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700">
            {shortSha(provenance.sha)}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700">
            {provenance.generated_at ?? "—"}
          </span>
          <button
            type="button"
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(rawJson);
              } catch {
                // ignore
              }
            }}
          >
            Copy provenance
          </button>
        </>
      ) : (
        <span className="text-[11px] text-slate-400">
          {error ? `Unavailable (${error})` : "—"}
        </span>
      )}
    </div>
  );
}

