"use client";

import { ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import { type ManifestRuleGroup } from "@/components/manifest/ManifestDetailsDrawer";

export type ManifestSortKey = "methodology" | "id" | "latestVersion" | "versionCount";
export type ManifestSortDirection = "asc" | "desc";

type ManifestTableProps = {
  rows: ManifestRuleGroup[];
  activeTags: string[];
  onToggleTag: (tag: string) => void;
  sortKey: ManifestSortKey;
  sortDirection: ManifestSortDirection;
  onSortChange: (key: ManifestSortKey) => void;
  onOpenDetails: (row: ManifestRuleGroup) => void;
};

function SortIcon({
  active,
  direction,
}: {
  active: boolean;
  direction: ManifestSortDirection;
}) {
  if (!active) return <ArrowUpDown className="h-4 w-4 text-slate-400" aria-hidden="true" />;
  return direction === "asc" ? (
    <ChevronUp className="h-4 w-4 text-slate-700" aria-hidden="true" />
  ) : (
    <ChevronDown className="h-4 w-4 text-slate-700" aria-hidden="true" />
  );
}

function highlightTags(
  tags: string[],
  activeTags: string[],
  onToggleTag: (tag: string) => void,
) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {tags.slice(0, 4).map(tag => {
        const active = activeTags.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            onClick={() => onToggleTag(tag)}
            aria-pressed={active}
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
              active
                ? "border-slate-800 bg-slate-800 text-white"
                : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            {tag}
          </button>
        );
      })}
      {tags.length > 4 ? (
        <span className="text-xs font-medium text-slate-500">+{tags.length - 4} more</span>
      ) : null}
    </div>
  );
}

export default function ManifestTable({
  rows,
  activeTags,
  onToggleTag,
  sortKey,
  sortDirection,
  onSortChange,
  onOpenDetails,
}: ManifestTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onSortChange("methodology")}
                  className="inline-flex items-center gap-2"
                >
                  Methodology
                  <SortIcon
                    active={sortKey === "methodology"}
                    direction={sortDirection}
                  />
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onSortChange("id")}
                  className="inline-flex items-center gap-2"
                >
                  Rule
                  <SortIcon active={sortKey === "id"} direction={sortDirection} />
                </button>
              </th>
              <th className="px-4 py-3">Tags</th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onSortChange("latestVersion")}
                  className="inline-flex items-center gap-2"
                >
                  Latest
                  <SortIcon
                    active={sortKey === "latestVersion"}
                    direction={sortDirection}
                  />
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onSortChange("versionCount")}
                  className="inline-flex items-center gap-2"
                >
                  Versions
                  <SortIcon
                    active={sortKey === "versionCount"}
                    direction={sortDirection}
                  />
                </button>
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map(row => (
              <tr key={row.key} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-4 font-semibold text-slate-900">
                  {row.methodology}
                </td>
                <td className="px-4 py-4">
                  <div className="space-y-1">
                    <div className="font-mono text-xs font-semibold text-slate-600">
                      {row.id}
                    </div>
                    <div className="line-clamp-2 text-sm font-medium text-slate-900">
                      {row.rule}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">{highlightTags(row.tags, activeTags, onToggleTag)}</td>
                <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-slate-900">
                  {row.latest.version}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-slate-900">
                  {row.versions.length}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => onOpenDetails(row)}
                    className="inline-flex min-h-[2.25rem] items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500 focus-visible:outline-offset-2"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                  No rules match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
