"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ASSISTANT_QUESTIONS, type AssistantQuestionId } from "@/lib/assistant/questions";
import { generateAnswer, type AssistantAnswer } from "@/lib/assistant/generateAnswer";
import { buildAssistantBundle } from "@/lib/assistant/bundle";
import { pickProvenanceFields } from "@/lib/trustFormat";
import { extractPackId } from "@/lib/packId";
import GeoVistaCard from "@/components/assistant/GeoVistaCard";
import { getVerification } from "@/services/geovista/client";
import type { GeoVistaVerification } from "@/services/geovista/types";

type RuleSummary = { id: string; title: string; snippet: string };
type SectionSummary = { id: string; title: string; textSnippet?: string };

type AssistantPanelProps = {
  methodCode: string;
  version: string;
  hasPrevious: boolean;
  rules: RuleSummary[];
  sections: SectionSummary[];
  rich?: unknown | null;
  meta?: unknown | null;
  manifestRulesPath?: string | null;
  packTag?: string | null;
  provenanceJson?: unknown | null;
  onNavigateEvidence?: (type: "rule" | "section", id: string) => void;
};

function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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

function EvidenceChip({
  label,
  onClick,
  title,
}: {
  label: string;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
    >
      {label}
    </button>
  );
}

function ensureLeadingSlash(value: string): string {
  return value.startsWith("/") ? value : `/${value}`;
}

function dirnameFromPath(value: string): string {
  const normalized = value.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx === -1 ? "" : normalized.slice(0, idx);
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

function pickMetaAuditHashes(meta: unknown): Record<string, string> | null {
  if (!meta || typeof meta !== "object") return null;
  const record = meta as Record<string, unknown>;
  const auditHashes = record.audit_hashes;
  if (!auditHashes || typeof auditHashes !== "object") return null;
  const a = auditHashes as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of ["rules_json_sha256", "sections_json_sha256", "source_pdf_sha256"]) {
    const value = a[key];
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
  }
  return Object.keys(out).length ? out : null;
}

function evidenceCaption(item: AssistantAnswer["evidence"][number]): string | null {
  if (item.excerpt && item.excerpt.trim()) return item.excerpt.trim();
  if (item.quality === "low") return "Excerpt unavailable (low confidence).";
  return null;
}

function AnswerBody({ markdown }: { markdown: string }) {
  const nodes = useMemo(() => {
    const lines = markdown.split("\n");
    return lines.map((raw, index) => {
      const line = raw.replace(/\s+$/g, "");
      if (!line.trim()) return { kind: "spacer" as const, key: `sp-${index}` };
      if (line.startsWith("## ")) {
        return { kind: "heading" as const, key: `h-${index}`, text: line.slice(3).trim() };
      }
      return { kind: "p" as const, key: `p-${index}`, text: line };
    });
  }, [markdown]);

  return (
    <div className="max-w-2xl">
      {nodes.map((node) => {
        if (node.kind === "spacer") return <div key={node.key} className="h-2" />;
        if (node.kind === "heading") {
          return (
            <div
              key={node.key}
              className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              {node.text}
            </div>
          );
        }
        return (
          <div key={node.key} className="text-sm leading-relaxed text-slate-700">
            {node.text}
          </div>
        );
      })}
    </div>
  );
}

export default function AssistantPanel(props: AssistantPanelProps) {
  const [active, setActive] = useState<AssistantQuestionId>("purpose_claims");
  const [toast, setToast] = useState<string | null>(null);
  const [geovista, setGeovista] = useState<GeoVistaVerification | null>(null);
  const [geovistaLoading, setGeovistaLoading] = useState(false);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 900);
  }, []);

  const changesDisabled = !props.hasPrevious;

  const provenance = useMemo(() => {
    const picked = pickProvenanceFields(props.provenanceJson);
    const repo_sha = picked.sha;
    const packSha = props.packTag ? extractPackId(props.packTag) : undefined;
    const pack = props.packTag && packSha ? `${props.packTag}@${packSha}` : props.packTag ?? undefined;
    return { pack, generated_at: picked.generatedAt, repo_sha };
  }, [props.packTag, props.provenanceJson]);

  const answer: AssistantAnswer = useMemo(() => {
    return generateAnswer({
      questionId: active,
      methodCode: props.methodCode,
      version: props.version,
      rules: props.rules,
      sections: props.sections,
      rich: props.rich ?? null,
      meta: props.meta ?? null,
      provenance,
    });
  }, [active, props.methodCode, props.meta, props.rich, props.rules, props.sections, props.version, provenance]);

  const evidenceRequired = answer.evidence.length === 0;
  const geovistaEnabled = process.env.NEXT_PUBLIC_GEOVISTA_ENABLED === "true";

  useEffect(() => {
    if (!geovistaEnabled) {
      setGeovista(null);
      setGeovistaLoading(false);
      return;
    }
    if (!props.methodCode || !props.version) return;

    const cited_ids = answer.evidence
      .filter((item) => item.type === "rule" || item.type === "section")
      .map((item) => item.id);

    if (!cited_ids.length) {
      setGeovista(null);
      setGeovistaLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setGeovistaLoading(true);
      const verification = await getVerification({
        method_code: props.methodCode,
        method_version: props.version,
        cited_ids,
        question_id: answer.question_id,
      });
      if (cancelled) return;
      setGeovista(verification);
      setGeovistaLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [answer.evidence, answer.question_id, geovistaEnabled, props.methodCode, props.version]);

  return (
    <div className="mt-4 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex flex-wrap gap-2">
          {ASSISTANT_QUESTIONS.map((question) => {
            const disabled = question.id === "changes_vs_previous" ? changesDisabled : false;
            return (
              <button
                key={question.id}
                type="button"
                disabled={disabled}
                onClick={() => setActive(question.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors",
                  active === question.id
                    ? "border-slate-300 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  disabled ? "cursor-not-allowed opacity-50" : "",
                )}
                title={disabled ? "No previous version available." : undefined}
              >
                {question.label}
              </button>
            );
          })}
        </div>
        <div className="mt-2 text-xs text-slate-500">Evidence-linked answers. Exportable for audit.</div>
      </div>

      <div className="p-4">
        {toast ? (
          <div className="fixed bottom-4 right-4 z-50 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow">
            {toast}
          </div>
        ) : null}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-slate-900">Answer</div>
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={async () => {
              const evidenceRules: unknown[] = [];
              const evidenceSections: unknown[] = [];
              const seenRules = new Set<string>();
              const seenSections = new Set<string>();

              const unique = new Set<string>();
              const targets = answer.evidence.filter((item) => item.type === "rule" || item.type === "section");
              await Promise.all(
                targets.map(async (item) => {
                  const key = `${item.type}:${item.id}`;
                  if (unique.has(key)) return;
                  unique.add(key);

                  if (item.type === "rule") {
                    const json = await fetchJson(
                      `/api/methods/${encodeURIComponent(props.methodCode)}/v/${encodeURIComponent(props.version)}/rules?id=${encodeURIComponent(item.id)}`,
                    );
                    if (json && typeof json === "object" && (json as Record<string, unknown>).rule) {
                      if (!seenRules.has(item.id)) {
                        seenRules.add(item.id);
                        evidenceRules.push((json as Record<string, unknown>).rule as unknown);
                      }
                    }
                  }

                  if (item.type === "section") {
                    const json = await fetchJson(
                      `/api/methods/${encodeURIComponent(props.methodCode)}/v/${encodeURIComponent(props.version)}/sections?id=${encodeURIComponent(item.id)}`,
                    );
                    if (json && typeof json === "object" && (json as Record<string, unknown>).section) {
                      if (!seenSections.has(item.id)) {
                        seenSections.add(item.id);
                        evidenceSections.push((json as Record<string, unknown>).section as unknown);
                      }
                    }
                  }
                }),
              );

              const packId = props.packTag ? extractPackId(props.packTag) : undefined;
              const metaUrl = props.manifestRulesPath
                ? `${dirnameFromPath(ensureLeadingSlash(props.manifestRulesPath))}/META.json`
                : null;
              const metaJson = metaUrl ? await fetchJson(metaUrl) : null;
              const auditHashes = pickMetaAuditHashes(metaJson);

              const bundle = buildAssistantBundle({
                answer,
                evidencePayloads: { rules: evidenceRules, sections: evidenceSections },
                provenance: {
                  pack_tag: props.packTag ?? undefined,
                  pack_id: packId ?? undefined,
                  generated_at: provenance.generated_at,
                  repo_sha: provenance.repo_sha,
                  audit_hashes: auditHashes ?? undefined,
                },
                geovista: geovista ?? undefined,
              });

              const filename = `article6__${props.methodCode}__${props.version}__assistant__${answer.question_id}.bundle.json`;
              downloadJson(bundle, filename);
            }}
          >
            Export answer
          </button>
        </div>

        <div className="mt-3">
          <AnswerBody markdown={answer.answer_md} />
        </div>

        {evidenceRequired ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Evidence required: this answer currently has no linked evidence.
          </div>
        ) : null}

        <div className="mt-4 grid gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-700">Evidence</div>
            <div className="mt-2 grid gap-2">
              {answer.evidence.length ? (
                answer.evidence.map((item) => {
                  const label = item.type === "rule" ? `Rule: ${item.id}` : item.type === "section" ? `Section: ${item.id}` : `Citation: ${item.id}`;
                  const caption = evidenceCaption(item);
                  const canLink = item.type === "rule" || item.type === "section";
                  return (
                    <div key={`${item.type}:${item.id}`} className="flex flex-col items-start gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <EvidenceChip
                          label={label}
                          title={caption ?? undefined}
                          onClick={() => {
                            if (canLink) props.onNavigateEvidence?.(item.type, item.id);
                          }}
                        />
                        {canLink ? (
                          <button
                            type="button"
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                            onClick={async () => {
                              const url = new URL(window.location.href);
                              const tab = item.type === "rule" ? "rules" : "sections";
                              url.searchParams.set("tab", tab);
                              url.searchParams.set("focus", item.id);
                              window.history.replaceState(null, "", url.toString());
                              const ok = await copyText(url.toString());
                              if (ok) showToast("Copied");
                            }}
                          >
                            Copy link
                          </button>
                        ) : null}
                      </div>
                      {caption ? <div className="text-xs text-slate-500">{caption}</div> : null}
                    </div>
                  );
                })
              ) : (
                <span className="text-xs text-slate-500">No evidence linked.</span>
              )}
            </div>
          </div>

          {geovistaEnabled && (geovistaLoading || geovista) ? (
            <GeoVistaCard loading={geovistaLoading} verification={geovista} />
          ) : null}

          <div>
            <div className="text-xs font-semibold text-slate-700">Assumptions</div>
            <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">
              {answer.assumptions.length ? (
                answer.assumptions.map((item) => <li key={item}>{item}</li>)
              ) : (
                <li>None</li>
              )}
            </ul>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-700">Next actions</div>
            <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">
              {answer.next_actions.length ? (
                answer.next_actions.map((item) => <li key={item}>{item}</li>)
              ) : (
                <li>None</li>
              )}
            </ul>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
