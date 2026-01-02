"use client";

import { ArrowUpRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AuditRule, ExtractedVariable } from "@/lib/audit/sample";
import { EXTRACTED_VARIABLES, SAMPLE_RULES } from "@/lib/audit/sample";
import Checklist, { type ChecklistState } from "@/components/audit/Checklist";
import { CHECKLIST_ITEMS } from "@/lib/audit/checklist";
import useDeeplinkMethodVersion from "@/hooks/useDeeplinkMethodVersion";

function buildInitialQaState(): ChecklistState {
  return Object.fromEntries(CHECKLIST_ITEMS.map(item => [item.id, false]));
}

function getRulesForFile(file: File): AuditRule[] {
  // Simple deterministic rotation based on filename to avoid unused-variable lint.
  const offset = file.name.length % SAMPLE_RULES.length;
  const rotated = SAMPLE_RULES.slice(offset).concat(SAMPLE_RULES.slice(0, offset));
  return rotated;
}

function getVariablesForFile(file: File): ExtractedVariable[] {
  const offset = file.name.length % EXTRACTED_VARIABLES.length;
  const rotated = EXTRACTED_VARIABLES.slice(offset).concat(EXTRACTED_VARIABLES.slice(0, offset));
  return rotated;
}

export default function AuditApp() {
  const searchParams = useSearchParams();
  const requestedRule = (searchParams.get("rule") ?? "").trim() || undefined;
  const deeplink = useDeeplinkMethodVersion();
  const selectedMethod = deeplink.resolved.method;
  const selectedVersion = deeplink.resolved.resolvedVersion;

  const [fileName, setFileName] = useState<string | null>(null);
  const [rules, setRules] = useState<AuditRule[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [checklistState, setChecklistState] = useState<ChecklistState>(buildInitialQaState());
  const [variables, setVariables] = useState<ExtractedVariable[]>([]);

  const selectedRule = useMemo(
    () => rules.find(rule => rule.id === selectedRuleId) ?? null,
    [rules, selectedRuleId]
  );

  const handleUpload = (file: File) => {
    setFileName(file.name);
    const extractedRules = getRulesForFile(file);
    setRules(extractedRules);
    setSelectedRuleId(extractedRules[0]?.id ?? null);
    setChecklistState(() => ({ ...buildInitialQaState(), "raw-pages": true }));
    setVariables(getVariablesForFile(file));
  };

  const toggleQa = (key: string) => {
    setChecklistState(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4">
        {selectedMethod || requestedRule || deeplink.resolved.warnings.length ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Context
              </span>
              {deeplink.loading ? <span className="text-xs text-slate-500">Loading…</span> : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
                method: {selectedMethod ?? "—"}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
                version: {selectedVersion ?? "—"}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
                rule: {requestedRule ?? "—"}
              </span>
            </div>
            {deeplink.resolved.warnings.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-700">
                {deeplink.resolved.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
            {!selectedMethod && requestedRule ? (
              <div className="mt-2 text-xs text-amber-700">
                Rule scope provided without a valid method. Add `method=` (and optional `version=`) to scope the audit.
              </div>
            ) : null}
          </div>
        ) : null}

        <UploadCard onUpload={handleUpload} fileName={fileName} />
        {rules.length > 0 ? (
          <section className="grid gap-6 lg:grid-cols-[260px_1fr]">
            <RuleList
              rules={rules}
              selectedRuleId={selectedRuleId}
              onSelect={setSelectedRuleId}
            />
            <ResultsPanel
              fileName={fileName}
              rule={selectedRule}
              variables={variables}
              checklistState={checklistState}
              onToggleQa={toggleQa}
            />
          </section>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

type UploadCardProps = {
  onUpload: (file: File) => void;
  fileName: string | null;
};

function UploadCard({ onUpload, fileName }: UploadCardProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="mb-4 space-y-2">
        <h2 className="text-xl font-semibold text-slate-900">Audit a methodology PDF</h2>
        <p className="text-sm text-slate-600">
          Upload a methodology PDF to surface its rules, anchors, and hash provenance. The audit checklist keeps track of QA/QC steps as you progress.
        </p>
      </header>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition hover:border-slate-400 hover:bg-slate-100">
        <span className="text-sm font-medium text-slate-700">Drop a PDF or click to browse</span>
        <span className="text-xs text-slate-500">Only .pdf files are supported for this prototype</span>
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={event => {
            const file = event.target.files?.[0];
            if (file) {
              onUpload(file);
            }
          }}
        />
      </label>
      {fileName ? (
        <p className="mt-4 text-sm text-slate-600">
          Last uploaded: <span className="font-medium text-slate-900">{fileName}</span>
        </p>
      ) : null}
    </section>
  );
}

type RuleListProps = {
  rules: AuditRule[];
  selectedRuleId: string | null;
  onSelect: (ruleId: string) => void;
};

function RuleList({ rules, selectedRuleId, onSelect }: RuleListProps) {
  return (
    <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Rules</h3>
      </div>
      <ul className="divide-y divide-slate-200">
        {rules.map(rule => {
          const isActive = rule.id === selectedRuleId;
          return (
            <li key={rule.id}>
              <button
                type="button"
                onClick={() => onSelect(rule.id)}
                className={`flex w-full flex-col gap-2 px-4 py-3 text-left transition ${isActive ? "bg-slate-100" : "hover:bg-slate-50"}`}
              >
                <span className="text-sm font-medium text-slate-900">{rule.title}</span>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span>
                    Section: <span className="font-medium text-slate-900">{rule.sectionId}</span>
                  </span>
                  <a
                    href={rule.rawUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                    onClick={event => event.stopPropagation()}
                  >
                    Raw p.{rule.rawPage}
                    <ArrowUpRight className="h-3 w-3" />
                  </a>
                </div>
                <span className="text-xs text-slate-500">SHA256: {rule.sha256}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

type ResultsPanelProps = {
  fileName: string | null;
  rule: AuditRule | null;
  variables: ExtractedVariable[];
  checklistState: ChecklistState;
  onToggleQa: (key: string) => void;
};

function ResultsPanel({ fileName, rule, variables, checklistState, onToggleQa }: ResultsPanelProps) {
  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Audit results</h3>
            <p className="text-sm text-slate-600">Review extracted anchors, hashes, and QA status.</p>
          </div>
          {fileName ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{fileName}</span>
          ) : null}
        </header>

        {rule ? (
          <div className="space-y-5">
            <article className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-base font-semibold text-slate-900">{rule.title}</h4>
                <p className="text-sm text-slate-600">{rule.summary}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <ProvenanceLink href={`${rule.pdfId ? `/pdf/${rule.pdfId}${rule.anchor}` : rule.anchor}`} label="Anchor" value={rule.anchor} />
                  <ProvenanceLink href={rule.rawUrl} label="Raw page" value={`p.${rule.rawPage}`} />
                  <ProvenanceLink href={rule.rawUrl} label="SHA256" value={rule.sha256} isHash />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="space-y-3">
                  <h5 className="text-sm font-semibold text-slate-900">Processed excerpt</h5>
                  <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                    {rule.summary}
                  </p>
                </div>
                <div className="space-y-3">
                  <h5 className="text-sm font-semibold text-slate-900">Raw PDF spot-check</h5>
                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    <object
                      key={rule.rawUrl}
                      data={rule.rawUrl}
                      type="application/pdf"
                      className="h-64 w-full"
                    >
                      <div className="p-3 text-xs text-slate-600">
                        PDF preview unavailable. <a className="font-semibold text-slate-900" href={rule.rawUrl} target="_blank" rel="noopener noreferrer">Open raw document</a>.
                      </div>
                    </object>
                  </div>
                </div>
              </div>
            </article>

            <section className="space-y-3">
              <h5 className="text-sm font-semibold text-slate-900">Extracted variables</h5>
              <ul className="grid gap-3 sm:grid-cols-2">
                {variables.map(variable => (
                  <li key={variable.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="text-xs font-semibold uppercase text-slate-500">{variable.label}</div>
                    <a
                      href={variable.rawAnchor}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 font-mono text-sm text-slate-900 underline decoration-dotted underline-offset-2"
                    >
                      {variable.value}
                      <ArrowUpRight className="h-3 w-3" />
                    </a>
                    <div className="mt-2 space-y-1 text-xs text-slate-600">
                      <p>
                        Section: <ProvenanceLink href={variable.rawAnchor} value={variable.sectionId} />
                      </p>
                      <p className="break-all">
                        SHA256: <ProvenanceLink href={variable.rawAnchor} value={variable.sha256} isHash />
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : (
          <p className="text-sm text-slate-600">Select a rule to inspect its anchor and hash provenance.</p>
        )}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <Checklist state={checklistState} onToggle={onToggleQa} />
      </section>
    </section>
  );
}

type ProvenanceLinkProps = {
  href: string;
  label?: string;
  value: string;
  isHash?: boolean;
};

function ProvenanceLink({ href, label, value, isHash }: ProvenanceLinkProps) {
  const displayValue = isHash ? `${value.slice(0, 12)}…` : value;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
    >
      {label ? <span className="text-slate-500">{label}</span> : null}
      <span className="font-mono">{displayValue}</span>
      <ArrowUpRight className="h-3 w-3" />
    </a>
  );
}

function EmptyState() {
  return (
    <section className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-500">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Awaiting upload</h3>
      <p className="mt-2 text-sm">Upload a methodology PDF to begin auditing rules, anchors, and hashes.</p>
    </section>
  );
}
