"use client";

import { useMemo, useState } from "react";
import { ExternalLink, FileJson } from "lucide-react";
import clsx from "clsx";

import HashCopyButton from "@/components/manifest/HashCopyButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { ManifestRule, RuleVersionOption } from "../_types";
import { TagChip } from "./TagChip";
import VersionSwitcher from "./VersionSwitcher";
import { getRulePdfPage, getRulePdfUrl } from "./pdfUtils";

export type RuleCardProps = {
  rule: ManifestRule;
  onTagToggle: (tag: string) => void;
  isTagActive: (tag: string) => boolean;
  versions: RuleVersionOption[];
};

export function RuleCard({ rule, onTagToggle, isTagActive, versions }: RuleCardProps) {
  const [exporting, setExporting] = useState(false);
  const pdfUrl = getRulePdfUrl(rule);
  const pdfPage = getRulePdfPage(rule);
  const tags = Array.isArray(rule.tags) ? rule.tags : [];
  const truncatedHash = useMemo(() => {
    if (!rule.sha256) return "—";
    return `${rule.sha256.slice(0, 12)}…`;
  }, [rule.sha256]);

  const handleExport = async () => {
    if (!rule.sha256 || exporting) return;
    setExporting(true);
    try {
      const response = await fetch(`/api/manifest/rule/${rule.sha256}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rule-${rule.sha256}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.warn("[RuleCard] Failed to export JSON", error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <article className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-900">{rule.rule}</h3>
          <p className="text-sm text-slate-600">{rule.methodology} · {rule.version}</p>
        </div>
        <VersionSwitcher rule={rule} versions={versions} />
      </header>

      <div className="flex flex-wrap gap-2">
        {tags.length > 0 ? (
          tags.map(tag => (
            <TagChip key={tag} tag={tag} active={isTagActive(tag)} onToggle={onTagToggle} />
          ))
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">No tags</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <span className="font-mono">SHA256 {truncatedHash}</span>
          <HashCopyButton hash={rule.sha256} />
        </div>
        <div className="flex items-center gap-2">
          <Tooltip content={pdfPage ? `Open PDF • page ${pdfPage}` : "Open PDF"}>
            <a
              href={pdfUrl || "#"}
              target={pdfUrl.startsWith("/") ? "_blank" : undefined}
              rel={pdfUrl.startsWith("/") ? "noopener noreferrer" : undefined}
              className={clsx(
                "inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 font-medium text-slate-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2",
                pdfUrl
                  ? "hover:border-slate-300 hover:text-slate-900"
                  : "cursor-not-allowed opacity-40",
              )}
              aria-disabled={!pdfUrl}
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              <span className="text-sm">Open PDF</span>
            </a>
          </Tooltip>
          <Tooltip content="Export rule JSON">
            <button
              type="button"
              className="inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 font-medium text-slate-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={handleExport}
              disabled={!rule.sha256 || exporting}
              aria-label="Export rule JSON"
            >
              <FileJson className="h-4 w-4" aria-hidden="true" />
              <span className="text-sm">Export JSON</span>
            </button>
          </Tooltip>
        </div>
      </div>
    </article>
  );
}

export default RuleCard;
