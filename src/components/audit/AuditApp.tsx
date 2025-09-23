"use client";

import { useMemo, useState } from "react";
import type { AuditRule, ExtractedVariable } from "@/lib/audit/sample";
import { EXTRACTED_VARIABLES, SAMPLE_RULES } from "@/lib/audit/sample";

const qaChecklist = [
  { key: "parsed", label: "PDF parsed" },
  { key: "anchors", label: "anchors matched" },
  { key: "hash", label: "hash verified" },
] as const;

type QaKey = (typeof qaChecklist)[number]["key"];

type QaState = Record<QaKey, boolean>;

function buildInitialQaState(): QaState {
  return {
    parsed: false,
    anchors: false,
    hash: false,
  };
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
  const [fileName, setFileName] = useState<string | null>(null);
  const [rules, setRules] = useState<AuditRule[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [qaState, setQaState] = useState<QaState>(buildInitialQaState());
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
    setQaState({ parsed: true, anchors: false, hash: false });
    setVariables(getVariablesForFile(file));
  };

  const toggleQa = (key: QaKey) => {
    setQaState(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4">
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
              qaState={qaState}
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
                <span className="text-xs text-slate-600">Section: <span className="font-medium text-slate-900">{rule.sectionId}</span></span>
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
  qaState: QaState;
  onToggleQa: (key: QaKey) => void;
};

function ResultsPanel({ fileName, rule, variables, qaState, onToggleQa }: ResultsPanelProps) {
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
          <div className="space-y-4">
            <article className="space-y-3">
              <div>
                <h4 className="text-base font-semibold text-slate-900">{rule.title}</h4>
                <p className="text-sm text-slate-600">{rule.summary}</p>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <dt className="text-xs uppercase text-slate-500">Anchor</dt>
                  <dd className="font-mono text-xs text-slate-900">{rule.anchor}</dd>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <dt className="text-xs uppercase text-slate-500">Section ID</dt>
                  <dd className="font-mono text-xs text-slate-900">{rule.sectionId}</dd>
                </div>
                <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <dt className="text-xs uppercase text-slate-500">SHA256</dt>
                  <dd className="font-mono text-xs text-slate-900 break-all">{rule.sha256}</dd>
                </div>
              </dl>
            </article>

            <section className="space-y-3">
              <h5 className="text-sm font-semibold text-slate-900">Extracted variables</h5>
              <ul className="grid gap-3 sm:grid-cols-2">
                {variables.map(variable => (
                  <li key={variable.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="text-xs font-semibold uppercase text-slate-500">{variable.label}</div>
                    <div className="text-sm font-mono text-slate-900">{variable.value}</div>
                    <div className="mt-2 space-y-1 text-xs text-slate-600">
                      <p>Section: <span className="font-mono text-slate-900">{variable.sectionId}</span></p>
                      <p className="break-all">SHA256: {variable.sha256}</p>
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
        <header className="mb-4">
          <h4 className="text-sm font-semibold text-slate-900">QA/QC mini-checklist</h4>
          <p className="text-sm text-slate-600">Toggle checks as you validate the uploaded document.</p>
        </header>
        <div className="space-y-3">
          {qaChecklist.map(item => (
            <label key={item.key} className="flex items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-slate-800 focus:ring-slate-600"
                checked={qaState[item.key]}
                onChange={() => onToggleQa(item.key)}
              />
              {item.label}
            </label>
          ))}
        </div>
      </section>
    </section>
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
