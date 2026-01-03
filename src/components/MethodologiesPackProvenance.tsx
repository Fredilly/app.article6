"use client";

import { useEffect, useMemo, useState } from "react";
import { equalsPack } from "@/lib/packId";
import packConfig from "../../config/methodologies_pack.json";

type Provenance = {
  repo?: string;
  sha?: string;
  generated_at?: string;
};

function pickString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function getPath(root: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = root;
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function readProvenanceTagOrSha(root: Record<string, unknown>): string | null {
  const candidates: string[][] = [
    ["provenance", "tag"],
    ["provenance", "pack_tag"],
    ["provenance", "pack", "tag"],
    ["provenance", "sha"],
    ["provenance", "pack_sha"],
    ["provenance", "pack", "sha"],
    ["tag"],
    ["pack_tag"],
    ["pack", "tag"],
    ["pack_sha"],
    ["pack", "sha"],
  ];

  for (const path of candidates) {
    const found = pickString(getPath(root, path));
    if (found && found.trim()) return found;
  }
  return null;
}

function shortSha(value?: string) {
  if (!value) return "—";
  return value.length > 12 ? value.slice(0, 12) : value;
}

export default function MethodologiesPackProvenance() {
  const [provenance, setProvenance] = useState<Provenance | null>(null);
  const [provenanceRaw, setProvenanceRaw] = useState<Record<string, unknown> | null>(null);
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
          setProvenanceRaw(null);
          setError("Invalid provenance JSON");
          return;
        }
        const record = json as Record<string, unknown>;
        setProvenanceRaw(record);
        setProvenance({
          repo: typeof record.repo === "string" ? record.repo : undefined,
          sha: typeof record.sha === "string" ? record.sha : undefined,
          generated_at: typeof record.generated_at === "string" ? record.generated_at : undefined,
        });
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setProvenance(null);
        setProvenanceRaw(null);
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

  const configTag = typeof packConfig?.tag === "string" ? packConfig.tag : null;

  const loadedTagOrSha = useMemo(() => {
    if (!provenanceRaw) return null;
    return readProvenanceTagOrSha(provenanceRaw);
  }, [provenanceRaw]);

  const mismatch = useMemo(() => {
    if (!provenanceRaw) return false;
    if (!configTag) return false;
    if (!loadedTagOrSha) return false;
    return !equalsPack(configTag, loadedTagOrSha);
  }, [configTag, loadedTagOrSha, provenanceRaw]);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
      <span className="font-semibold text-slate-600">Pack provenance</span>
      {mismatch ? (
        <span
          className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700"
          title={`Config: ${configTag ?? "—"}, Loaded: ${loadedTagOrSha ?? "—"}`}
        >
          Pack mismatch
        </span>
      ) : null}
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
