"use client";

import { useMemo, useState } from "react";
import type { PreferenceChoice, PreferenceEvent } from "@/lib/verify/preferences";

export type PreferenceCandidate = {
  evidenceKey: string;
  title: string;
  summary?: string | null;
};

type PairwisePreferenceWidgetProps = {
  left: PreferenceCandidate;
  right: PreferenceCandidate;
  recent: PreferenceEvent[];
  onChoose: (choice: PreferenceChoice, rationale?: string | null) => Promise<void>;
};

export function shouldShowPairwisePreferenceWidget(candidates: PreferenceCandidate[]): boolean {
  return candidates.length >= 2;
}

function choiceLabel(choice: PreferenceChoice): string {
  if (choice === "left") return "Prefer Left";
  if (choice === "right") return "Prefer Right";
  if (choice === "tie") return "Tie";
  return "Skip";
}

export default function PairwisePreferenceWidget({ left, right, recent, onChoose }: PairwisePreferenceWidgetProps) {
  const [rationaleOpen, setRationaleOpen] = useState(false);
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);

  const lastFive = useMemo(() => recent.slice(-5).reverse(), [recent]);

  const submit = async (choice: PreferenceChoice) => {
    if (busy) return;
    setBusy(true);
    try {
      const maybeRationale = rationaleOpen ? rationale.trim() : "";
      await onChoose(choice, maybeRationale || null);
      setRationale("");
      setRationaleOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold text-slate-900">Preference</div>
        <button
          type="button"
          className="text-[11px] font-semibold text-slate-600 underline underline-offset-2"
          onClick={() => setRationaleOpen((value) => !value)}
        >
          {rationaleOpen ? "Hide rationale" : "Add rationale"}
        </button>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {[left, right].map((item, idx) => (
          <div key={item.evidenceKey} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{idx === 0 ? "Left" : "Right"}</div>
            <div className="mt-1 text-xs font-semibold text-slate-900">{item.title}</div>
            {item.summary ? <div className="mt-1 line-clamp-2 text-[11px] text-slate-600">{item.summary}</div> : null}
            <div className="mt-1 break-words font-mono text-[11px] text-slate-500">{item.evidenceKey}</div>
          </div>
        ))}
      </div>

      {rationaleOpen ? (
        <textarea
          className="mt-2 min-h-[64px] w-full rounded-md border border-slate-200 px-2 py-2 text-xs text-slate-800 focus:border-sky-400 focus:outline-none"
          placeholder="Optional rationale"
          value={rationale}
          onChange={(event) => setRationale(event.target.value)}
        />
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy}
          onClick={() => void submit("left")}
        >
          Prefer Left
        </button>
        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy}
          onClick={() => void submit("right")}
        >
          Prefer Right
        </button>
        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy}
          onClick={() => void submit("tie")}
        >
          Tie
        </button>
        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy}
          onClick={() => void submit("skip")}
        >
          Skip
        </button>
      </div>

      <div className="mt-3 grid gap-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Recent preferences</div>
        {lastFive.length ? (
          lastFive.map((event) => (
            <div key={event.eventId} className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
              #{event.seq} {choiceLabel(event.choice)} • {event.leftEvidenceKey} vs {event.rightEvidenceKey}
            </div>
          ))
        ) : (
          <div className="text-[11px] text-slate-500">No preferences captured yet.</div>
        )}
      </div>
    </div>
  );
}
