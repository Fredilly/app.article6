"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { extractPackId } from "@/lib/packId";
import { formatIso, pickProvenanceFields, shortSha } from "@/lib/trustFormat";

type TrustStripProps = {
  methodCode?: string;
  version?: string;
  packTag?: string | null;
  provenanceJson?: unknown | null;
  manifestRulesPath?: string | null;
};

type ExportArtifact = "provenance" | "META" | "rules" | "sections" | "rich";

function ensureLeadingSlash(value: string): string {
  return value.startsWith("/") ? value : `/${value}`;
}

function dirnameFromPath(value: string): string {
  const normalized = value.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx === -1 ? "" : normalized.slice(0, idx);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fall back
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function buildFilename(
  code: string | undefined,
  version: string | undefined,
  artifact: ExportArtifact,
  shaHint: string | undefined,
): string {
  const safeCode = (code ?? "unknown").trim() || "unknown";
  const safeVer = (version ?? "unknown").trim() || "unknown";
  const short = shaHint ? shortSha(shaHint) : "";
  const safeShort = short || "unknown";
  return `article6__${safeCode}__${safeVer}__${artifact}__${safeShort}.json`;
}

async function downloadJsonText(text: string, filename: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function fetchJsonText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const text = await response.text();
    JSON.parse(text);
    return text;
  } catch {
    return null;
  }
}

async function checkExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (res.status === 405) return true;
    return res.ok;
  } catch {
    return false;
  }
}

function ChipButton({
  label,
  value,
  display,
  className,
  onCopied,
}: {
  label: string;
  value?: string;
  display?: string;
  className?: string;
  onCopied?: () => void;
}) {
  const disabled = !value;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={async () => {
        if (!value) return;
        const ok = await copyText(value);
        if (ok) onCopied?.();
      }}
      title={value || ""}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      aria-label={`Copy ${label}`}
    >
      <span className="text-slate-500">{label}:</span>
      <span className="font-mono">{display ?? value ?? ""}</span>
    </button>
  );
}

export default function TrustStrip({
  methodCode,
  version,
  packTag,
  provenanceJson,
  manifestRulesPath,
}: TrustStripProps) {
  const provenancePicked = useMemo(() => pickProvenanceFields(provenanceJson), [provenanceJson]);
  const repoSha = provenancePicked.sha;
  const repo = provenancePicked.repo;
  const generatedAt = provenancePicked.generatedAt;
  const packIdFromTag = useMemo(() => (packTag ? extractPackId(packTag) : null), [packTag]);

  const rulesUrl = useMemo(() => {
    if (!manifestRulesPath) return null;
    return ensureLeadingSlash(manifestRulesPath);
  }, [manifestRulesPath]);

  const baseDir = useMemo(() => (rulesUrl ? dirnameFromPath(rulesUrl) : null), [rulesUrl]);
  const metaUrl = useMemo(() => (baseDir ? `${baseDir}/META.json` : null), [baseDir]);
  const sectionsUrl = useMemo(() => (rulesUrl ? rulesUrl.replace(/rules\.json$/i, "sections.json") : null), [rulesUrl]);
  const richUrl = useMemo(() => (baseDir ? `${baseDir}/rich.json` : null), [baseDir]);

  const [metaPicked, setMetaPicked] = useState(() => pickProvenanceFields(null));
  const [metaAvailable, setMetaAvailable] = useState(false);
  const [richAvailable, setRichAvailable] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMetaPicked(pickProvenanceFields(null));
      setMetaAvailable(false);
      if (!metaUrl) return;
      const exists = await checkExists(metaUrl);
      if (cancelled) return;
      setMetaAvailable(exists);
      if (!exists) return;
      const text = await fetchJsonText(metaUrl);
      if (cancelled) return;
      setMetaPicked(pickProvenanceFields(text ? JSON.parse(text) : null));
    })();
    return () => {
      cancelled = true;
    };
  }, [metaUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRichAvailable(false);
      if (!richUrl) return;
      const exists = await checkExists(richUrl);
      if (cancelled) return;
      setRichAvailable(exists);
    })();
    return () => {
      cancelled = true;
    };
  }, [richUrl]);

  const audit = metaPicked.auditHashes;

  const detailsRows = useMemo(() => {
    const rows: Array<{ key: string; label: string; value: string; display?: string }> = [];
    if (repo && repoSha) {
      rows.push({
        key: "github",
        label: "GitHub",
        value: `${repo}@${repoSha}`,
      });
    } else if (repo) {
      rows.push({ key: "github", label: "GitHub", value: repo });
    } else if (repoSha) {
      rows.push({ key: "github", label: "GitHub", value: repoSha });
    }

    const packSha = packIdFromTag ?? provenancePicked.packSha ?? null;
    if (packTag && packSha) {
      rows.push({ key: "pack", label: "pack", value: `${packTag}@${packSha}` });
    } else if (packTag) {
      rows.push({ key: "pack", label: "pack", value: packTag });
    } else if (packSha) {
      rows.push({ key: "pack", label: "pack", value: packSha });
    }

    if (generatedAt) {
      rows.push({ key: "generated_at", label: "generated_at", value: generatedAt });
    }

    if (audit?.rules) {
      rows.push({ key: "rules", label: "rules_sha256", value: audit.rules, display: shortSha(audit.rules) });
    }
    if (audit?.sections) {
      rows.push({
        key: "sections",
        label: "sections_sha256",
        value: audit.sections,
        display: shortSha(audit.sections),
      });
    }
    if (audit?.sourcePdf) {
      rows.push({
        key: "pdf",
        label: "source_pdf_sha256",
        value: audit.sourcePdf,
        display: shortSha(audit.sourcePdf),
      });
    }
    return rows;
  }, [audit?.rules, audit?.sections, audit?.sourcePdf, generatedAt, packIdFromTag, packTag, provenancePicked.packSha, repo, repoSha]);

  const handleCopied = useCallback((key: string) => {
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 900);
  }, []);

  const exportArtifact = useCallback(
    async (artifact: ExportArtifact) => {
      const filename = buildFilename(methodCode, version, artifact, repoSha);

      if (artifact === "provenance") {
        if (!provenanceJson) return;
        await downloadJsonText(JSON.stringify(provenanceJson, null, 2), filename);
        return;
      }

      const urlMap: Record<Exclude<ExportArtifact, "provenance">, string | null> = {
        META: metaUrl,
        rules: rulesUrl,
        sections: sectionsUrl,
        rich: richUrl,
      };

      const url = urlMap[artifact];
      if (!url) return;
      const text = await fetchJsonText(url);
      if (!text) return;
      await downloadJsonText(text, filename);
    },
    [methodCode, metaUrl, provenanceJson, repoSha, richUrl, rulesUrl, sectionsUrl, version],
  );

  const copyAllPayload = useMemo(() => {
    const github = repo && repoSha ? `${repo}@${repoSha}` : repo ?? repoSha ?? undefined;
    const packSha = packIdFromTag ?? provenancePicked.packSha ?? undefined;
    const pack = packTag && packSha ? `${packTag}@${packSha}` : packTag ?? packSha ?? undefined;
    const auditHashes =
      audit && (audit.rules || audit.sections || audit.sourcePdf)
        ? {
            rules_sha256: audit.rules,
            sections_sha256: audit.sections,
            source_pdf_sha256: audit.sourcePdf,
          }
        : undefined;
    const payload = {
      github,
      pack,
      generated_at: generatedAt,
      audit_hashes: auditHashes,
    };
    return Object.values(payload).some((value) => value != null) ? payload : null;
  }, [audit, generatedAt, packIdFromTag, packTag, provenancePicked.packSha, repo, repoSha]);

  const showStrip = Boolean(methodCode || version || generatedAt || metaAvailable || rulesUrl || provenanceJson);
  if (!showStrip) return null;

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <ChipButton
          label="source"
          value="Article6 Methodologies"
          display="Article6 Methodologies"
          onCopied={() => handleCopied("source")}
        />

        {generatedAt ? (
          <ChipButton
            label="generated"
            value={generatedAt}
            display={formatIso(generatedAt)}
            onCopied={() => handleCopied("generated")}
          />
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {copiedKey ? <span className="text-xs font-medium text-slate-500">Copied</span> : null}
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
              Export
            </summary>
            <div className="absolute right-0 z-10 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              <div className="flex flex-col p-2 text-sm">
                {provenanceJson ? (
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => exportArtifact("provenance")}
                  >
                    Export Provenance JSON
                  </button>
                ) : null}
                {metaAvailable ? (
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => exportArtifact("META")}
                  >
                    Export META.json
                  </button>
                ) : null}
                {rulesUrl ? (
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => exportArtifact("rules")}
                  >
                    Export rules.json
                  </button>
                ) : null}
                {sectionsUrl ? (
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => exportArtifact("sections")}
                  >
                    Export sections.json
                  </button>
                ) : null}
                {richAvailable ? (
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => exportArtifact("rich")}
                  >
                    Export rich.json
                  </button>
                ) : null}
              </div>
            </div>
          </details>
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
              Details
            </summary>
            <div className="absolute right-0 z-10 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              <div className="flex flex-col gap-2 p-3">
                {copyAllPayload ? (
                  <button
                    type="button"
                    className="self-start rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                    onClick={async () => {
                      const ok = await copyText(JSON.stringify(copyAllPayload));
                      if (ok) handleCopied("copy_all");
                    }}
                  >
                    Copy all
                  </button>
                ) : null}

                {detailsRows.length ? (
                  detailsRows.map((row) => (
                    <div key={row.key} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-700">{row.label}</div>
                        <div className="break-all font-mono text-xs text-slate-600">
                          {row.display ?? row.value}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                        onClick={async () => {
                          const ok = await copyText(row.value);
                          if (ok) handleCopied(row.key);
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-500">No additional provenance details.</div>
                )}
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
