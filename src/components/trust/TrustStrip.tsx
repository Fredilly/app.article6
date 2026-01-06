"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { extractPackId } from "@/lib/packId";
import { formatIso, pickProvenanceFields, shortSha } from "@/lib/trustFormat";
import { importProofBundleFile } from "@/lib/proof/import";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
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
  const [importStatus, setImportStatus] = useState<{
    kind: "idle" | "error" | "switch";
    message?: string;
    target?: { code: string; version: string };
    bundleText?: string;
  }>({ kind: "idle" });

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

  const datasetRelease = useMemo(() => {
    const packSha = packIdFromTag ?? provenancePicked.packSha ?? null;
    if (packTag && packSha) return `${packTag}@${packSha}`;
    if (packTag) return packTag;
    if (packSha) return packSha;
    return null;
  }, [packIdFromTag, packTag, provenancePicked.packSha]);

  const auditFingerprintsPayload = useMemo(() => {
    const payload = {
      rules_fingerprint: audit?.rules ?? undefined,
      sections_fingerprint: audit?.sections ?? undefined,
      source_pdf_fingerprint: audit?.sourcePdf ?? undefined,
    };
    return Object.values(payload).some((value) => value != null) ? payload : null;
  }, [audit?.rules, audit?.sections, audit?.sourcePdf]);

  const technicalProvenancePayload = useMemo(() => {
    const github = repo && repoSha ? `${repo}@${repoSha}` : repo ?? repoSha ?? undefined;
    const pack = datasetRelease ?? undefined;
    const payload = { github, pack };
    return Object.values(payload).some((value) => value != null) ? payload : null;
  }, [datasetRelease, repo, repoSha]);

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
              <div className="flex flex-col gap-3 p-3">
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-900">Dataset</div>
                  <div className="mt-2 grid gap-2 text-xs text-slate-700">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-slate-500">Source</span>
                      <span className="text-right font-medium text-slate-800">Article6 Methodologies</span>
                    </div>
                    {datasetRelease ? (
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-slate-500">Release</span>
                        <span className="break-all text-right font-mono text-[11px] text-slate-700">{datasetRelease}</span>
                      </div>
                    ) : null}
                    {generatedAt ? (
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-slate-500">Generated</span>
                        <span className="text-right font-medium text-slate-800">{formatIso(generatedAt)}</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <details className="rounded-lg border border-slate-100 bg-white">
                  <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-slate-900">
                    Audit fingerprints
                    <span className="ml-2 text-[11px] font-medium text-slate-500">(collapsed)</span>
                  </summary>
                  <div className="grid gap-2 px-3 pb-3 text-xs text-slate-700">
                    <div className="text-[11px] text-slate-500">
                      Fingerprints for the audited artifacts used by this dataset.
                    </div>
                    <div className="grid gap-2">
                      {audit?.rules ? (
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-slate-500">Rules fingerprint</span>
                          <span className="font-mono text-[11px] text-slate-700">{shortSha(audit.rules)}</span>
                        </div>
                      ) : null}
                      {audit?.sections ? (
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-slate-500">Sections fingerprint</span>
                          <span className="font-mono text-[11px] text-slate-700">{shortSha(audit.sections)}</span>
                        </div>
                      ) : null}
                      {audit?.sourcePdf ? (
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-slate-500">Source PDF fingerprint</span>
                          <span className="font-mono text-[11px] text-slate-700">{shortSha(audit.sourcePdf)}</span>
                        </div>
                      ) : null}
                      {!audit?.rules && !audit?.sections && !audit?.sourcePdf ? (
                        <div className="text-xs text-slate-500">No audit fingerprints available.</div>
                      ) : null}
                    </div>
                    {auditFingerprintsPayload ? (
                      <button
                        type="button"
                        className="mt-1 self-start rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                        onClick={async () => {
                          const ok = await copyText(JSON.stringify(auditFingerprintsPayload, null, 2));
                          if (ok) handleCopied("audit_fingerprints");
                        }}
                      >
                        Copy all
                      </button>
                    ) : null}
                  </div>
                </details>

                <details className="rounded-lg border border-slate-100 bg-white">
                  <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-slate-900">
                    Technical provenance
                  </summary>
                  <div className="grid gap-2 px-3 pb-3 text-xs text-slate-700">
                    <div className="text-[11px] text-slate-500">For auditors and implementation review.</div>
                    <div className="grid gap-2">
                      {repo || repoSha ? (
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-slate-500">GitHub</span>
                          <span className="break-all text-right font-mono text-[11px] text-slate-700">
                            {repo && repoSha ? `${repo}@${shortSha(repoSha)}` : repo ?? repoSha ?? ""}
                          </span>
                        </div>
                      ) : null}
                      {datasetRelease ? (
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-slate-500">Pack</span>
                          <span className="break-all text-right font-mono text-[11px] text-slate-700">{datasetRelease}</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {technicalProvenancePayload ? (
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                          onClick={async () => {
                            const ok = await copyText(JSON.stringify(technicalProvenancePayload, null, 2));
                            if (ok) handleCopied("technical_provenance");
                          }}
                        >
                          Copy technical provenance
                        </button>
                      ) : null}
                      <label className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                        Import bundle
                        <input
                          type="file"
                          accept=".json,.bundle.json,.zip,application/json,application/zip"
                          className="hidden"
                          onChange={async (event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (!file) return;
                            const current = { code: (methodCode ?? "").trim(), version: (version ?? "").trim() };
                            const result = await importProofBundleFile(file, current);
                            if (result.ok) {
                              window.dispatchEvent(new Event("proofbundle:imported"));
                              setImportStatus({ kind: "idle" });
                              return;
                            }

                            if (result.code === "SWITCH_REQUIRED" && result.target) {
                              const bundleText = file.name.toLowerCase().endsWith(".zip") ? undefined : await file.text();
                              setImportStatus({ kind: "switch", message: result.message, target: result.target, bundleText });
                              return;
                            }

                            setImportStatus({ kind: "error", message: result.message });
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </details>
        </div>
      </div>
      {importStatus.kind !== "idle" ? (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className={importStatus.kind === "error" ? "text-rose-700" : "text-slate-700"}>
              {importStatus.message}
            </div>
            <div className="flex items-center gap-2">
              {importStatus.kind === "switch" && importStatus.target && importStatus.bundleText ? (
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  onClick={() => {
                    const target = importStatus.target;
                    if (!target) return;
                    try {
                      window.sessionStorage.setItem("pending:proof-bundle@1", importStatus.bundleText ?? "");
                    } catch {
                      // ignore
                    }
                    router.push(
                      `/m/${encodeURIComponent(target.code)}/v/${encodeURIComponent(target.version)}`,
                    );
                    setImportStatus({ kind: "idle" });
                  }}
                >
                  Switch and load
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={() => setImportStatus({ kind: "idle" })}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
