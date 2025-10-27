"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ExternalLink } from "lucide-react";

import { ManifestRule } from "../_types";
import { getRulePdfPage, getRulePdfUrl } from "./pdfUtils";

export type VersionDiffModalProps = {
  open: boolean;
  onClose: () => void;
  current: ManifestRule;
  target: ManifestRule;
};

type DiffSegment = {
  text: string;
  type: "same" | "added" | "removed";
};

function tokenize(text: string) {
  return text.match(/\S+|\s+/g) ?? [];
}

function appendSegment(segments: DiffSegment[], type: DiffSegment["type"], text: string) {
  if (!text) return;
  const sanitizedType = text.trim().length === 0 ? "same" : type;
  const last = segments[segments.length - 1];
  if (last && last.type === sanitizedType) {
    last.text += text;
  } else {
    segments.push({ type: sanitizedType, text });
  }
}

function diffTokens(leftText: string, rightText: string) {
  const leftTokens = tokenize(leftText);
  const rightTokens = tokenize(rightText);
  const m = leftTokens.length;
  const n = rightTokens.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      if (leftTokens[i] === rightTokens[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const leftSegments: DiffSegment[] = [];
  const rightSegments: DiffSegment[] = [];
  let i = 0;
  let j = 0;

  while (i < m && j < n) {
    if (leftTokens[i] === rightTokens[j]) {
      appendSegment(leftSegments, "same", leftTokens[i]);
      appendSegment(rightSegments, "same", rightTokens[j]);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      appendSegment(leftSegments, "removed", leftTokens[i]);
      i += 1;
    } else {
      appendSegment(rightSegments, "added", rightTokens[j]);
      j += 1;
    }
  }

  while (i < m) {
    appendSegment(leftSegments, "removed", leftTokens[i]);
    i += 1;
  }

  while (j < n) {
    appendSegment(rightSegments, "added", rightTokens[j]);
    j += 1;
  }

  return { leftSegments, rightSegments };
}

function renderSegments(segments: DiffSegment[]) {
  return segments.map((segment, index) => {
    if (segment.type === "same") {
      return <span key={index}>{segment.text}</span>;
    }
    const highlightClass = segment.type === "added" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800";
    return (
      <mark key={index} className={`rounded px-0.5 ${highlightClass}`}>
        {segment.text}
      </mark>
    );
  });
}

function PdfLink({ rule }: { rule: ManifestRule }) {
  const href = getRulePdfUrl(rule);
  if (!href) return null;
  const page = getRulePdfPage(rule);
  const label = page ? `PDF page ${page}` : "Open PDF";
  const external = href.startsWith("/");
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 transition hover:text-indigo-700"
    >
      <ExternalLink className="h-4 w-4" aria-hidden="true" />
      {label}
    </a>
  );
}

export default function VersionDiffModal({ open, onClose, current, target }: VersionDiffModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const { leftSegments, rightSegments } = diffTokens(current.rule ?? "", target.rule ?? "");

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label="Compare rule versions"
      onClick={onClose}
    >
      <div
        className="relative grid w-full max-w-4xl gap-6 rounded-2xl bg-white p-6 shadow-2xl lg:grid-cols-2"
        onClick={event => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close version comparison"
          className="absolute right-4 top-4 inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <section className="space-y-3">
          <header className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-900">{current.methodology} · {current.version}</h3>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rule {current.ruleId}</p>
            <PdfLink rule={current} />
          </header>
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
            <div className="leading-relaxed text-slate-700">{renderSegments(leftSegments)}</div>
          </div>
        </section>
        <section className="space-y-3">
          <header className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-900">{target.methodology} · {target.version}</h3>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rule {target.ruleId}</p>
            <PdfLink rule={target} />
          </header>
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
            <div className="leading-relaxed text-slate-700">{renderSegments(rightSegments)}</div>
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}
