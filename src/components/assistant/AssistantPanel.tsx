"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ASSISTANT_QUESTIONS, type AssistantQuestionId } from "@/lib/assistant/questions";
import { generateAnswer, type AssistantAnswer } from "@/lib/assistant/generateAnswer";
import { pickProvenanceFields } from "@/lib/trustFormat";
import { extractPackId } from "@/lib/packId";

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
  packTag?: string | null;
  provenanceJson?: unknown | null;
  onOpenRule?: (ruleId: string) => void;
  onOpenSection?: (sectionId: string) => void;
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

function EvidenceChip({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
    >
      {label}
    </button>
  );
}

export default function AssistantPanel(props: AssistantPanelProps) {
  const [active, setActive] = useState<AssistantQuestionId>("purpose_claims");

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

  return (
    <div className="mt-4 grid gap-3">
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

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-slate-900">Answer</div>
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() => {
              const filename = `article6__${props.methodCode}__${props.version}__assistant__${answer.question_id}.json`;
              downloadJson(answer, filename);
            }}
          >
            Export answer
          </button>
        </div>

        <div className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{answer.answer_md}</div>

        {evidenceRequired ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Evidence required: this answer currently has no linked evidence.
          </div>
        ) : null}

        <div className="mt-4 grid gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-700">Evidence</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {answer.evidence.length ? (
                answer.evidence.map((item) => {
                  const label = item.type === "rule" ? `Rule: ${item.id}` : item.type === "section" ? `Section: ${item.id}` : `Citation: ${item.id}`;
                  return (
                    <EvidenceChip
                      key={`${item.type}:${item.id}`}
                      label={label}
                      onClick={() => {
                        if (item.type === "rule") props.onOpenRule?.(item.id);
                        if (item.type === "section") props.onOpenSection?.(item.id);
                      }}
                    />
                  );
                })
              ) : (
                <span className="text-xs text-slate-500">No evidence linked.</span>
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
  );
}

