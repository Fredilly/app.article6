"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type RuleOption = { id: string; title: string };

function shortRuleLabel(ruleId: string): string {
  const trimmed = ruleId.trim();
  if (!trimmed) return "";
  const dotSegments = trimmed.split(".");
  const lastSegment = dotSegments[dotSegments.length - 1]?.trim() ?? "";
  if (/^R-\d/i.test(lastSegment)) return lastSegment;
  const match = trimmed.match(/(^|[.-])(R-[\d][\w-]*)$/i);
  return match?.[2] ?? trimmed;
}

function formatLabel(rule: RuleOption): string {
  const shortId = shortRuleLabel(rule.id);
  const title = rule.title.trim();
  if (!title || title === rule.id || title === shortId) return shortId || rule.id;
  return `${shortId || rule.id} ${title.slice(0, 60)}`;
}

type RuleComboboxProps = {
  options: RuleOption[];
  value: string | null;
  onChange: (ruleId: string | null) => void;
};

export default function RuleCombobox({ options, value, onChange }: RuleComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((r) => r.id === value);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(
      (r) => r.id.toLowerCase().includes(q) || r.title.toLowerCase().includes(q),
    );
  }, [options, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function select(id: string) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex max-w-[220px] items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:border-slate-300"
      >
        <span className="truncate">{selected ? formatLabel(selected) : "Select rule\u2026"}</span>
        <svg className="h-3 w-3 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search rules\u2026"
              className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400"
            />
          </div>
          <div ref={listRef} className="max-h-48 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-xs text-slate-500">No rules match.</p>
            ) : (
              filtered.map((rule) => {
                const active = rule.id === value;
                return (
                  <button
                    key={rule.id}
                    type="button"
                    onClick={() => select(rule.id)}
                    className={`w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                      active
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <span className="font-medium">{shortRuleLabel(rule.id)}</span>
                    {rule.title ? (
                      <span className="ml-1 text-slate-400">{rule.title.slice(0, 60)}</span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
