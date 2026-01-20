"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ASSISTANT_QUESTIONS, type AssistantQuestionId } from "@/lib/assistant/questions";
import {
  WHERE_DEFINED_CATEGORIES,
  generateAnswer,
  type AssistantAnswer,
  type PromptCategory,
} from "@/lib/assistant/generateAnswer";
import { buildProofBundleV1 } from "@/lib/proof/bundle";
import { exportAuditZipFromStorage } from "@/lib/proof/auditZip";
import { pickProvenanceFields } from "@/lib/trustFormat";
import { extractPackId } from "@/lib/packId";
import type { AOI, EvidencePin } from "@/lib/proofMap/types";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { applyUrlUpdates } from "@/lib/nav/urlState";

type RuleSummary = { id: string; title: string; snippet: string; tags?: string[]; text?: string };
type SectionSummary = { id: string; title: string; textSnippet?: string; text?: string };

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
  onNavigateEvidence?: (type: "rule" | "section", id: string) => void;
};

const GENERATION_DELAY_MS = 220;

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

export default function AssistantPanel(props: AssistantPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { onNavigateEvidence } = props;
  const [active, setActive] = useState<AssistantQuestionId>("important_rules");
  const [category, setCategory] = useState<PromptCategory>("eligibility");
  const [toast, setToast] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reviewActor, setReviewActor] = useState("");
  const [reviewAction, setReviewAction] = useState<"note" | "approve" | "reject" | "needs_more_evidence">("note");
  const [reviewNote, setReviewNote] = useState("");
  const generationTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (generationTimerRef.current) {
        window.clearTimeout(generationTimerRef.current);
      }
    };
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 900);
  }, []);

  const triggerGenerating = useCallback(() => {
    setIsGenerating(true);
    if (generationTimerRef.current) {
      window.clearTimeout(generationTimerRef.current);
    }
    generationTimerRef.current = window.setTimeout(() => setIsGenerating(false), GENERATION_DELAY_MS);
  }, []);

  const hasSelection = Boolean(props.methodCode?.trim()) && Boolean(props.version?.trim());

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
      category: active === "where_defined" ? category : undefined,
      provenance,
    });
  }, [active, category, props.methodCode, props.rules, props.sections, props.version, provenance]);

  const navigateToEvidence = useCallback(
    (type: "rule" | "section", id: string) => {
      if (onNavigateEvidence) {
        onNavigateEvidence(type, id);
        return;
      }
      if (!pathname) return;
      const tab = type === "rule" ? "rules" : "sections";
      const next = applyUrlUpdates(searchParams, { tab, focus: id });
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }, 
    [onNavigateEvidence, pathname, router, searchParams],
  );

  const navigateToVerify = useCallback(
    (mode: "list" | "map") => {
      if (!pathname) return;
      const next = applyUrlUpdates(searchParams, { tab: "verify", mode, focus: null });
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const handleExportPack = useCallback(async () => {
    try {
      const packId = props.packTag ? extractPackId(props.packTag) : undefined;
      const packDigest = pickedProvenance.packSha ?? packId ?? pickedProvenance.packTag ?? undefined;
      const hasReviewInput = Boolean(reviewActor.trim() || reviewNote.trim() || reviewAction !== "note");
      const reviewEntry = hasReviewInput
        ? { actor: reviewActor.trim(), action: reviewAction, note: reviewNote.trim() }
        : undefined;

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

      const zipBytes = await exportAuditZipFromStorage(bundle, {
        rules: props.rules,
        sections: props.sections,
        reviewEntry,
      });
      const filename = `article6__${props.methodCode}__${props.version}__proof.audit.zip`;
      downloadBytes(zipBytes, filename, "application/zip");
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e));
    }
  }, [
    pickedProvenance.generatedAt,
    pickedProvenance.packSha,
    pickedProvenance.packTag,
    props.aoi,
    props.evidencePins,
    props.methodCode,
    props.packTag,
    props.program,
    props.rules,
    props.sections,
    props.sector,
    props.version,
    reviewAction,
    reviewActor,
    reviewNote,
    showToast,
  ]);

  const handlePromptSelect = useCallback(
    (id: AssistantQuestionId) => {
      setActive(id);
      triggerGenerating();
    },
    [triggerGenerating],
  );

  const handleCategorySelect = useCallback(
    (id: PromptCategory) => {
      setCategory(id);
      triggerGenerating();
    },
    [triggerGenerating],
  );

  const actionsDisabled = !hasSelection || isGenerating;
  const isWhereDefined = active === "where_defined";

  return (
    <div className="mt-4 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="text-sm font-semibold text-slate-900">Method Assistant</div>
        <div className="mt-1 text-xs text-slate-500">Guided, evidence-first answers (no freeform).</div>
        {hasSelection ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {ASSISTANT_QUESTIONS.map((question) => (
              <button
                key={question.id}
                type="button"
                disabled={actionsDisabled}
                onClick={() => handlePromptSelect(question.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors",
                  active === question.id
                    ? "border-slate-300 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  actionsDisabled ? "cursor-not-allowed opacity-60" : "",
                )}
              >
                {question.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="p-4">
        {toast ? (
          <div className="fixed bottom-4 right-4 z-50 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow">
            {toast}
          </div>
        ) : null}

        {!hasSelection ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">Assistant disabled</div>
            <div className="mt-2 text-sm text-slate-700">Select a method version to enable guided help.</div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            {isWhereDefined ? (
              <div>
                <div className="text-xs font-semibold text-slate-700">Choose a section focus</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {WHERE_DEFINED_CATEGORIES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={actionsDisabled}
                      onClick={() => handleCategorySelect(item.id)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-semibold shadow-sm",
                        category === item.id
                          ? "border-slate-300 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                        actionsDisabled ? "cursor-not-allowed opacity-60" : "",
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="text-xs font-semibold text-slate-700">Answer</div>
              <div className="mt-2 text-sm leading-relaxed text-slate-700">{answer.answer}</div>
            </div>

            <div className="mt-4">
              <div className="text-xs font-semibold text-slate-700">Evidence</div>
              {answer.evidence.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {answer.evidence.map((item) => (
                    <button
                      key={`${item.type}:${item.id}`}
                      type="button"
                      onClick={() => navigateToEvidence(item.type, item.id)}
                      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                      title={item.title ?? undefined}
                    >
                      {item.type === "rule" ? `Rule: ${item.id}` : `Section: ${item.id}`}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-xs text-slate-500">
                  No direct matches found — try the Rules or Sections tabs with keyword search.
                </div>
              )}
            </div>

            {answer.assumptions?.length ? (
              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-700">Assumptions</div>
                <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">
                  {answer.assumptions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-4">
              <div className="text-xs font-semibold text-slate-700">Next actions</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {answer.next_actions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    disabled={actionsDisabled}
                    className={cn(
                      "rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50",
                      actionsDisabled ? "cursor-not-allowed opacity-60" : "",
                    )}
                    onClick={() => {
                      if (action.id === "open_verify") return navigateToVerify("list");
                      if (action.id === "add_evidence") return navigateToVerify("map");
                      if (action.id === "export_pack") return void handleExportPack();
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
              <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                <summary className="cursor-pointer font-semibold text-slate-700">
                  Add review note (optional)
                </summary>
                <div className="mt-3 grid gap-3 text-xs text-slate-700">
                  <label className="grid gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Actor
                    </span>
                    <input
                      type="text"
                      value={reviewActor}
                      onChange={(event) => setReviewActor(event.target.value)}
                      placeholder="Name or role"
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Action
                    </span>
                    <select
                      value={reviewAction}
                      onChange={(event) =>
                        setReviewAction(event.target.value as "note" | "approve" | "reject" | "needs_more_evidence")
                      }
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                    >
                      <option value="note">Note</option>
                      <option value="approve">Approve</option>
                      <option value="reject">Reject</option>
                      <option value="needs_more_evidence">Needs more evidence</option>
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Note
                    </span>
                    <textarea
                      value={reviewNote}
                      onChange={(event) => setReviewNote(event.target.value)}
                      rows={3}
                      placeholder="Short note for the review log"
                      className="resize-none rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                    />
                  </label>
                </div>
              </details>
            </div>

            {isGenerating ? (
              <div className="mt-4 text-xs text-slate-500">Generating grounded answer…</div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
