"use client";

import type { StacSupportFactRecord, StacSupportFactsState } from "@/lib/verify/stacSupportFacts";

type StacSupportSectionProps = {
  eligible: boolean;
  eligibilityReason: string | null;
  supportState: StacSupportFactsState | null;
};

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function formatFactMeta(fact: StacSupportFactRecord): string {
  const bits = [
    formatDate(fact.datetime),
    typeof fact.cloudCover === "number" ? `${fact.cloudCover}% cloud` : null,
    fact.collection ?? null,
    fact.sourceProvider ?? fact.sourceCatalogRef ?? null,
  ].filter(Boolean);
  return bits.join(" • ") || "Provenance recorded";
}

function formatFactProvenance(fact: StacSupportFactRecord): string {
  const bits = [
    fact.aoiRelationSummary ?? null,
    fact.geometryType ? `Geometry ${fact.geometryType}` : null,
    fact.linkedAt ? `Linked ${fact.linkedAt.slice(0, 10)}` : null,
    fact.assetHref ? "Asset available" : null,
    fact.linkHref ? "Link available" : null,
  ].filter(Boolean);
  return bits.join(" • ") || "No extra provenance details recorded";
}

export default function StacSupportSection({
  eligible,
  eligibilityReason,
  supportState,
}: StacSupportSectionProps) {
  if (!eligible) return null;

  const status = supportState?.lookupStatus ?? "awaiting_search";
  const linkedFacts = supportState?.linkedFacts ?? [];
  const unlinkedFacts = supportState?.unlinkedFacts ?? [];
  const panelTone =
    status === "lookup_failed"
      ? "border-rose-200 bg-rose-50/40"
      : linkedFacts.length > 0
        ? "border-sky-200 bg-sky-50/30"
        : "border-dashed border-slate-300 bg-slate-50/50";

  return (
    <div className={`rounded-2xl border p-4 ${panelTone}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
          AOI / STAC support facts
        </div>
        <span className="rounded-full border border-sky-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-sky-700">
          {linkedFacts.length} linked / {supportState?.searchResultCount ?? 0} found
        </span>
      </div>

      <div className="mt-2 text-sm text-slate-600">{eligibilityReason}</div>

      <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
        {supportState?.lookupMessage ?? "Run STAC search to populate AOI support facts."}
        {status === "lookup_failed" && supportState?.lookupError ? (
          <div className="mt-1 text-rose-700">{supportState.lookupError}</div>
        ) : null}
      </div>

      {linkedFacts.length > 0 ? (
        <div className="mt-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Linked support facts
          </div>
          <ul className="mt-1.5 grid gap-2">
            {linkedFacts.slice(0, 5).map((fact) => (
              <li
                key={fact.id}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[11px] text-slate-800">{fact.id}</span>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Linked
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-600">{formatFactMeta(fact)}</div>
                <div className="mt-1 text-[11px] text-slate-500">{formatFactProvenance(fact)}</div>
              </li>
            ))}
          </ul>
          {linkedFacts.length > 5 ? (
            <div className="mt-1 text-[10px] text-slate-400">
              + {linkedFacts.length - 5} more linked support fact{linkedFacts.length - 5 === 1 ? "" : "s"}
            </div>
          ) : null}
        </div>
      ) : null}

      {unlinkedFacts.length > 0 ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Available but unlinked
          </div>
          <div className="mt-1 text-xs text-slate-600">
            {unlinkedFacts.length} AOI/STAC support fact{unlinkedFacts.length === 1 ? "" : "s"} found but not linked to this rule review.
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {unlinkedFacts.slice(0, 3).map((fact) => fact.id).join(", ")}
            {unlinkedFacts.length > 3 ? ` +${unlinkedFacts.length - 3} more` : ""}
          </div>
        </div>
      ) : null}

      <div className="mt-3 rounded-lg border border-sky-200 bg-white px-3 py-2 text-[11px] text-sky-700">
        Supporting data only — reviewer must assess sufficiency. Not auto-verified.
      </div>
    </div>
  );
}
