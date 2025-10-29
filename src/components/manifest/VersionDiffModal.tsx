"use client";

import { useEffect } from "react";
import { type ManifestEntry } from "@/lib/manifest/cards";

type VersionDiffModalProps = {
  open: boolean;
  current: ManifestEntry | null;
  comparison: ManifestEntry | null;
  onClose: () => void;
};

type DiffSegment = {
  type: "same" | "added" | "removed";
  text: string;
};

function buildAnchorUrl(entry: ManifestEntry | null) {
  if (!entry) return "#";
  const anchorPath = entry.anchor ?? "";
  const pdfId = entry.pdfId ?? "";
  if (pdfId) return `/pdf/${pdfId}${anchorPath}`;
  return anchorPath || "#";
}

function diffWords(previousText: string, nextText: string): DiffSegment[] {
  const aWords = previousText.trim().length ? previousText.split(/\s+/) : [];
  const bWords = nextText.trim().length ? nextText.split(/\s+/) : [];
  const m = aWords.length;
  const n = bWords.length;
  const lcs: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      if (aWords[i] === bWords[j]) {
        lcs[i][j] = lcs[i + 1][j + 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
  }

  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  const pushSegment = (type: DiffSegment["type"], text: string) => {
    if (!text) return;
    const last = segments[segments.length - 1];
    if (last && last.type === type) {
      last.text += ` ${text}`;
    } else {
      segments.push({ type, text });
    }
  };

  while (i < m && j < n) {
    if (aWords[i] === bWords[j]) {
      pushSegment("same", aWords[i]);
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      pushSegment("removed", aWords[i]);
      i += 1;
    } else {
      pushSegment("added", bWords[j]);
      j += 1;
    }
  }

  while (i < m) {
    pushSegment("removed", aWords[i]);
    i += 1;
  }
  while (j < n) {
    pushSegment("added", bWords[j]);
    j += 1;
  }

  return segments;
}

function renderDiff(segments: DiffSegment[]) {
  return segments.map((segment, index) => {
    if (segment.type === "same") {
      return (
        <span key={index} className="text-slate-800">
          {segment.text}{" "}
        </span>
      );
    }
    if (segment.type === "added") {
      return (
        <span key={index} className="rounded bg-emerald-100 px-1 text-emerald-800">
          {segment.text}{" "}
        </span>
      );
    }
    return (
      <span key={index} className="rounded bg-rose-100 px-1 text-rose-800 line-through">
        {segment.text}{" "}
      </span>
    );
  });
}

export default function VersionDiffModal({
  open,
  current,
  comparison,
  onClose,
}: VersionDiffModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open || !current || !comparison) return null;

  const diffSegments = diffWords(current.rule ?? "", comparison.rule ?? "");
  const hasDiff = diffSegments.some(segment => segment.type !== "same");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Compare methodology versions"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {current.methodology} · {current.id}
            </h2>
            <p className="text-sm text-slate-600">
              Comparing {current.version} to {comparison.version}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 min-w-[2.75rem] items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500 focus-visible:outline-offset-2"
          >
            Close
          </button>
        </header>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {[current, comparison].map(entry => (
            <div
              key={`${entry.methodology}-${entry.version}`}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {entry.version}
              </h3>
              <p className="mt-3 text-sm text-slate-700">{entry.rule}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                {entry.tags?.map(tag => (
                  <span
                    key={`${entry.version}-${tag}`}
                    className="rounded-full bg-white px-2 py-1 font-medium text-slate-700"
                  >
                    {tag}
                  </span>
                ))}
                <a
                  href={buildAnchorUrl(entry)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[2.75rem] items-center rounded-full border border-slate-200 bg-white px-3 font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500 focus-visible:outline-offset-2"
                >
                  Open PDF
                </a>
              </div>
            </div>
          ))}
        </div>

        <section className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Diff
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-slate-800">
            {hasDiff
              ? renderDiff(diffSegments)
              : "Rule text is identical across the selected versions."}
          </p>
        </section>
      </div>
    </div>
  );
}
