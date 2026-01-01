"use client";

import { ExternalLink, FileJson, Hash } from "lucide-react";
import Drawer from "@/components/ui/Drawer";
import HashCopyButton from "@/components/manifest/HashCopyButton";
import { type ManifestEntry } from "@/lib/manifest/cards";

function buildAnchorUrl(entry: ManifestEntry) {
  const anchorPath = entry.anchor ?? "";
  const pdfId = entry.pdfId ?? "";
  if (pdfId) return `/pdf/${pdfId}${anchorPath}`;
  return anchorPath || "#";
}

function shortHash(hash?: string) {
  if (!hash) return "n/a";
  return `${hash.slice(0, 12)}…`;
}

export type ManifestRuleGroup = {
  key: string;
  methodology: string;
  id: string;
  rule: string;
  tags: string[];
  versions: ManifestEntry[];
  latest: ManifestEntry;
};

type ManifestDetailsDrawerProps = {
  open: boolean;
  rule: ManifestRuleGroup | null;
  onClose: () => void;
};

export default function ManifestDetailsDrawer({
  open,
  rule,
  onClose,
}: ManifestDetailsDrawerProps) {
  const title = rule ? `${rule.methodology} · ${rule.id}` : "Details";
  const description = rule ? rule.rule : undefined;

  return (
    <Drawer open={open} title={title} description={description} onClose={onClose}>
      {!rule ? null : (
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
                <Hash className="h-4 w-4 text-slate-500" aria-hidden="true" />
                <span className="font-mono">SHA256 {shortHash(rule.latest.sha256)}</span>
                <HashCopyButton hash={rule.latest.sha256} />
              </span>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1">
                Latest: <span className="ml-2 font-semibold text-slate-900">{rule.latest.version}</span>
              </span>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1">
                Versions: <span className="ml-2 font-semibold text-slate-900">{rule.versions.length}</span>
              </span>
            </div>

            {rule.tags.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {rule.tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">No tags recorded.</p>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Versions</h3>
              <span className="text-xs text-slate-500">Click a version to open proof links.</span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Version</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rule.versions.map(entry => {
                    const pdfHref = buildAnchorUrl(entry);
                    const exportHref = entry.sha256 ? `/api/manifest/rule/${entry.sha256}` : "";
                    return (
                      <tr key={entry.version} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {entry.version}
                          {entry.version === rule.latest.version ? (
                            <span className="ml-2 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                              latest
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <a
                              href={pdfHref !== "#" ? pdfHref : undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                                pdfHref !== "#"
                                  ? "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900"
                                  : "cursor-not-allowed border-slate-100 bg-slate-100 text-slate-400"
                              }`}
                              aria-disabled={pdfHref === "#"}
                            >
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                              Open PDF
                            </a>
                            <a
                              href={exportHref || undefined}
                              download={entry.sha256 ? `rule-${entry.sha256}.json` : undefined}
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                                exportHref
                                  ? "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900"
                                  : "cursor-not-allowed border-slate-100 bg-slate-100 text-slate-400"
                              }`}
                              aria-disabled={!exportHref}
                            >
                              <FileJson className="h-3.5 w-3.5" aria-hidden="true" />
                              Export JSON
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </Drawer>
  );
}

