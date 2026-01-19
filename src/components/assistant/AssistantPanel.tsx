"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ASSISTANT_QUESTIONS, type AssistantQuestionId } from "@/lib/assistant/questions";
import { generateAnswer, type AssistantAnswer } from "@/lib/assistant/generateAnswer";
import { buildProofBundleV1 } from "@/lib/proof/bundle";
import { exportAuditZipFromStorage } from "@/lib/proof/auditZip";
import { pickProvenanceFields } from "@/lib/trustFormat";
import { extractPackId } from "@/lib/packId";
import type { AOI, EvidencePin } from "@/lib/proofMap/types";
import { buildEvidencePin, dedupeStrings, evidencePinFingerprint, isDuplicateEvidencePin } from "@/lib/proofMap/pins";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { applyUrlUpdates } from "@/lib/nav/urlState";

type RuleSummary = { id: string; title: string; snippet: string };
type SectionSummary = { id: string; title: string; textSnippet?: string };

type AssistantPanelProps = {
  program?: string;
  sector?: string;
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
  aoi?: AOI | null;
  evidencePins?: EvidencePin[];
  onAddEvidencePin?: (pin: EvidencePin) => void;
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

function downloadBytes(bytes: Uint8Array, filename: string, mime: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: mime });
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState<AssistantQuestionId>("purpose_claims");
  const [toast, setToast] = useState<string | null>(null);
  const lastPinFingerprintRef = useRef<{ fp: string; atMs: number } | null>(null);

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

  const pickedProvenance = useMemo(() => pickProvenanceFields(props.provenanceJson), [props.provenanceJson]);

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
  const hasSelection = Boolean(props.methodCode?.trim()) && Boolean(props.version?.trim());

  const setTabParam = useCallback(
    (tab: "rules" | "sections" | "map") => {
      if (!pathname) return;
      const next = applyUrlUpdates(searchParams, { tab, focus: null });
      if (next === searchParams.toString()) return;
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const currentEvidenceIds = useMemo(() => {
    const ids = answer.evidence
      .filter((item) => item.type === "rule" || item.type === "section")
      .map((item) => item.id);
    return dedupeStrings(ids);
  }, [answer.evidence]);

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
        <div className="mt-2 text-xs text-slate-500">
          Guided, evidence-linked answers. No verification or pass/fail claims.
        </div>
      </div>

      <div className="p-4">
        {toast ? (
          <div className="fixed bottom-4 right-4 z-50 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow">
            {toast}
          </div>
        ) : null}
        {!hasSelection ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">Assistant</div>
            <div className="mt-2 text-sm text-slate-700">
              Select a method version to enable guided help.
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Choose a version above, then return to the Assistant tab.
            </div>
          </div>
        ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-slate-900">Answer</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={async () => {
                const cited_ids = currentEvidenceIds;
                if (!cited_ids.length) return;
                const question = ASSISTANT_QUESTIONS.find((q) => q.id === answer.question_id);
                const pin: EvidencePin = buildEvidencePin({
                  title: question?.label ?? "Assistant evidence",
                  aoi_id: props.aoi?.id ?? undefined,
                  aoi_fingerprint: props.aoi?.aoi_fingerprint ?? undefined,
                  cited_ids,
                });
                const fp = await evidencePinFingerprint({ title: pin.title, cited_ids: pin.cited_ids ?? [] });
                const last = lastPinFingerprintRef.current;
                if (last && last.fp === fp && Date.now() - last.atMs < 2_000) {
                  showToast("Pin already exists.");
                  return;
                }
                const duplicate = await isDuplicateEvidencePin(props.evidencePins ?? [], {
                  title: pin.title,
                  cited_ids: pin.cited_ids ?? [],
                });
                if (duplicate) {
                  showToast("Pin already exists.");
                  return;
                }
                lastPinFingerprintRef.current = { fp, atMs: Date.now() };
                props.onAddEvidencePin?.(pin);
                showToast("Pins added");
              }}
              disabled={!currentEvidenceIds.length}
              title={!currentEvidenceIds.length ? "No evidence to add." : undefined}
            >
              Add pins
            </button>
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={async () => {
              const packId = props.packTag ? extractPackId(props.packTag) : undefined;
              const packDigest = pickedProvenance.packSha ?? packId ?? pickedProvenance.packTag ?? undefined;

              const bundle = await buildProofBundleV1({
                program: props.program,
                sector: props.sector,
                code: props.methodCode,
                version: props.version,
                source: "Article6 Methodologies",
                generated_at: pickedProvenance.generatedAt,
                provenance: pickedProvenance,
                pack_digest: packDigest,
                aoi: props.aoi ?? undefined,
                evidence_pins: props.evidencePins ?? undefined,
                rules: props.rules,
                sections: props.sections,
              });

              const filename = `article6__${props.methodCode}__${props.version}__proof.bundle.json`;
              downloadJson(bundle, filename);
              }}
            >
              Export answer
            </button>
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={async () => {
                try {
                  const packId = props.packTag ? extractPackId(props.packTag) : undefined;
                  const packDigest = pickedProvenance.packSha ?? packId ?? pickedProvenance.packTag ?? undefined;

                  const bundle = await buildProofBundleV1({
                    program: props.program,
                    sector: props.sector,
                    code: props.methodCode,
                    version: props.version,
                    source: "Article6 Methodologies",
                    generated_at: pickedProvenance.generatedAt,
                    provenance: pickedProvenance,
                    pack_digest: packDigest,
                    aoi: props.aoi ?? undefined,
                    evidence_pins: props.evidencePins ?? undefined,
                    rules: props.rules,
                    sections: props.sections,
                  });

                  const zipBytes = await exportAuditZipFromStorage(bundle);
                  const filename = `article6__${props.methodCode}__${props.version}__proof.audit.zip`;
                  downloadBytes(zipBytes, filename, "application/zip");
                } catch (e) {
                  showToast(e instanceof Error ? e.message : String(e));
                }
              }}
            >
              Export ZIP
            </button>
          </div>
        </div>
        <div className="mt-2 text-[11px] text-slate-500">
          Adds pins from cited ids. Does not change AOI.
        </div>

        <div className="mt-3">
          <AnswerBody markdown={answer.answer_md} />
        </div>

        {evidenceRequired ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            No grounded evidence found for this prompt.
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
                <span className="text-xs text-slate-500">No grounded evidence found.</span>
              )}
            </div>
          </div>

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
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={() => setTabParam("rules")}
              >
                Open Rules tab
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={() => setTabParam("sections")}
              >
                Open Sections tab
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={() => setTabParam("map")}
              >
                Open Verify tab
              </button>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Verify workflow: upload an AOI, then search STAC evidence and export an Evidence Snapshot.
            </div>
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
        )}
      </div>
    </div>
  );
}
