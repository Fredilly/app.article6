"use client";

import React, { useMemo, useState } from "react";
import JSZip from "jszip";
import { diffIndexes, indexManifest } from "@/lib/manifestDiff";

type Loaded = { name: string; manifest: unknown };

async function readFileAsText(file: File) {
  return await file.text();
}

async function loadManifestFromZip(file: File): Promise<unknown> {
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const mf = zip.file("manifest.json");
  if (!mf) throw new Error("manifest.json not found inside zip");
  const text = await mf.async("string");
  return JSON.parse(text);
}

async function loadManifest(file: File): Promise<Loaded> {
  if (file.name.toLowerCase().endsWith(".zip")) {
    return { name: file.name, manifest: await loadManifestFromZip(file) };
  }
  const text = await readFileAsText(file);
  return { name: file.name, manifest: JSON.parse(text) };
}

export function IntegrityDiffPanel() {
  const [a, setA] = useState<Loaded | null>(null);
  const [b, setB] = useState<Loaded | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const diff = useMemo(() => {
    if (!a || !b) return null;
    const A = indexManifest(a.manifest);
    const B = indexManifest(b.manifest);
    return diffIndexes(A, B);
  }, [a, b]);

  async function onPick(which: "a" | "b", file: File | null) {
    setErr(null);
    if (!file) return;
    setBusy(true);
    try {
      const loaded = await loadManifest(file);
      if (which === "a") setA(loaded);
      else setB(loaded);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm font-semibold text-slate-900">Integrity Diff</div>
        <div className="text-xs text-slate-500">Compare two manifests or two audit-pack zips</div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm text-slate-700">
          <div className="text-xs text-slate-500">A (baseline)</div>
          <input
            type="file"
            accept=".json,.zip,application/json,application/zip"
            onChange={(e) => void onPick("a", e.target.files?.[0] ?? null)}
            disabled={busy}
            className="block w-full text-xs text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
          />
          {a && <div className="text-xs text-slate-500">Loaded: {a.name}</div>}
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <div className="text-xs text-slate-500">B (candidate)</div>
          <input
            type="file"
            accept=".json,.zip,application/json,application/zip"
            onChange={(e) => void onPick("b", e.target.files?.[0] ?? null)}
            disabled={busy}
            className="block w-full text-xs text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
          />
          {b && <div className="text-xs text-slate-500">Loaded: {b.name}</div>}
        </label>
      </div>

      {err && <div className="text-sm text-red-600">Error: {err}</div>}

      {diff && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-4 text-sm text-slate-700">
            <div>
              Added: <span className="font-semibold">{diff.counts.added}</span>
            </div>
            <div>
              Removed: <span className="font-semibold">{diff.counts.removed}</span>
            </div>
            <div>
              Changed: <span className="font-semibold">{diff.counts.changed}</span>
            </div>
          </div>

          <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">Added files</summary>
            <pre className="mt-2 max-h-56 overflow-auto text-xs text-slate-700">
              {diff.added.join("\n") || "(none)"}
            </pre>
          </details>

          <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">Removed files</summary>
            <pre className="mt-2 max-h-56 overflow-auto text-xs text-slate-700">
              {diff.removed.join("\n") || "(none)"}
            </pre>
          </details>

          <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">
              Changed files (sha256)
            </summary>
            <pre className="mt-2 max-h-56 overflow-auto text-xs text-slate-700">
              {diff.changed.join("\n") || "(none)"}
            </pre>
          </details>
        </div>
      )}

      {!diff && !err && (
        <div className="text-xs text-slate-500">
          Upload two files to see the diff. (Accepts <code>manifest.json</code> or{" "}
          <code>audit-pack.zip</code>.)
        </div>
      )}
    </div>
  );
}
