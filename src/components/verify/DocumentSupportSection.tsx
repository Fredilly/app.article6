"use client";

import type { DocumentSupportEntry } from "@/lib/verify/documentSupport";

type DocumentSupportSectionProps = {
  entries: DocumentSupportEntry[];
};

function kindLabel(kind: DocumentSupportEntry["kind"]): string {
  switch (kind) {
    case "pdd_excerpt":
      return "PDD";
    case "workbook_value":
      return "Workbook";
    case "document":
      return "Document";
  }
}

function kindTone(kind: DocumentSupportEntry["kind"]): string {
  switch (kind) {
    case "pdd_excerpt":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "workbook_value":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "document":
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export default function DocumentSupportSection({ entries }: DocumentSupportSectionProps) {
  if (entries.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        Document & workbook support
      </div>
      <div className="mt-3 space-y-3">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 text-sm font-semibold text-slate-900 truncate">
                {entry.title}
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${kindTone(entry.kind)}`}
              >
                {kindLabel(entry.kind)}
              </span>
            </div>
            {entry.excerpt ? (
              <div className="mt-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                <pre className="whitespace-pre-wrap font-sans text-xs leading-5 text-slate-700">
                  {entry.excerpt}
                </pre>
              </div>
            ) : null}
            <div className="mt-2 text-[11px] text-slate-500">{entry.provenance}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        Linked evidence support — reviewer must assess sufficiency.
      </div>
    </div>
  );
}
