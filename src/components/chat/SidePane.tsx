import React, { useMemo, useState } from "react";
import type { EngineResult } from "@/lib/engine/types";

export function pickTitle(result: EngineResult) {
  return (
    result.section_title ??
    result.sectionTitle ??
    result.section ??
    result.text?.split("\n")[0]?.slice(0, 120) ??
    result.id
  );
}

export function pickBody(result: EngineResult) {
  return result.text ?? result.section ?? "";
}

type GroupedResult = {
  key: string;
  title: string;
  body: string;
  items: EngineResult[];
  primary: EngineResult;
};

function VariantRow({ item, isPrimary }: { item: EngineResult; isPrimary: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200/70 bg-white/70 px-3 py-2 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
        <span className="font-mono" title={item.id}>
          {item.id}
        </span>
        <div className="flex items-center gap-2">
          {typeof item.score === "number" ? (
            <span className="rounded-full bg-gray-900/80 px-2 py-0.5 text-[11px] font-medium text-white">
              {item.score.toFixed(2)}
            </span>
          ) : null}
          {isPrimary ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              primary
            </span>
          ) : null}
        </div>
      </div>
      <div className="mt-2 space-y-1 text-[11px] text-gray-500">
        {item.refs?.length ? <p className="truncate">refs: {item.refs.join(", ")}</p> : null}
        {item.sha256 ? <p className="font-mono">sha256: {item.sha256}</p> : null}
      </div>
    </div>
  );
}

export function buildGroups(results: EngineResult[]): GroupedResult[] {
  const map = new Map<string, GroupedResult>();

  results.forEach((result, index) => {
    const title = pickTitle(result);
    const body = pickBody(result) || "";
    const key = `${title}::${body}`;
    const existing = map.get(key);

    if (existing) {
      existing.items.push(result);
      if ((result.score ?? -Infinity) > (existing.primary.score ?? -Infinity)) {
        existing.primary = result;
      }
    } else {
      map.set(key, {
        key: `${key}-${index}`,
        title,
        body,
        items: [result],
        primary: result,
      });
    }
  });

  return Array.from(map.values()).sort((a, b) => (b.primary.score ?? 0) - (a.primary.score ?? 0));
}

export default function SidePane({ results }: { results: EngineResult[] }) {
  const groups = useMemo(() => buildGroups(results ?? []), [results]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const hasResults = groups.length > 0;

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto rounded-[1.25rem] border border-gray-200/60 bg-white/70 p-4 shadow-sm backdrop-blur">
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400">Insights</p>
        <h2 className="text-lg font-semibold text-gray-900">Rule cards</h2>
      </div>

      {hasResults ? (
        <ul className="space-y-3">
          {groups.map((group) => {
            const { primary, items, title, body, key } = group;
            const displayBody = body || "No excerpt available.";
            const isExpanded = expandedGroups[key] ?? false;
            const variants = items.length;
            const otherItems = items.filter((item) => item !== primary);

            return (
              <li
                key={key}
                className="group rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-gray-400">Section</p>
                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-2" title={title}>
                      {title}
                    </h3>
                  </div>
                  {typeof primary.score === "number" && (
                    <span className="rounded-full bg-gray-900/90 px-2 py-0.5 text-xs font-medium text-white shadow-sm">
                      {primary.score.toFixed(2)}
                    </span>
                  )}
                </div>

                <p className="mt-3 text-sm leading-6 text-gray-600 line-clamp-4" title={displayBody}>
                  {displayBody}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2 text-[11px] text-gray-500">
                  <span className="max-w-full truncate font-mono text-gray-400" title={primary.id}>
                    {primary.id}
                  </span>
                  {primary.refs?.length ? (
                    <span className="truncate" title={primary.refs.join(", ")}>
                      refs: {primary.refs.join(", ")}
                    </span>
                  ) : null}
                  {primary.sha256 ? <span className="font-mono">sha256: {primary.sha256}</span> : null}
                  {variants > 1 ? (
                    <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 font-medium text-gray-600">
                      {variants} variants
                    </span>
                  ) : null}
                  {!isExpanded && otherItems.length ? (
                    <span
                      className="max-w-full truncate text-gray-400"
                      title={otherItems.map((item) => item.id).join(", ")}
                    >
                      +{otherItems.length} more: {otherItems.slice(0, 2).map((item) => item.id).join(",")}
                      {otherItems.length > 2 ? "…" : ""}
                    </span>
                  ) : null}
                </div>

                {variants > 1 && (
                  <div className="mt-3 space-y-3">
                    <button
                      type="button"
                      onClick={() => toggleGroup(key)}
                      className="inline-flex items-center gap-2 text-xs font-medium text-gray-600 underline-offset-4 transition hover:text-gray-900 hover:underline"
                    >
                      {isExpanded ? "Hide variants" : `Show ${variants - 1} other variant${variants - 1 === 1 ? "" : "s"}`}
                    </button>

                    {isExpanded && (
                      <div className="space-y-2 rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 p-3">
                        {items.map((item, idx) => (
                          <VariantRow key={`${item.id}-${idx}`} item={item} isPrimary={item === primary} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-500">
          <p>Ask a question to see matched rules and supporting evidence.</p>
        </div>
      )}
    </div>
  );
}
