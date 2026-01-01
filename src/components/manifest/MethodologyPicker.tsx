"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Filter, Search, X } from "lucide-react";

export type MethodologyOption = {
  key: string;
  value: string;
  code: string;
  program?: string;
  sector?: string;
  versionsCount: number;
  latestVersion?: string;
};

type MethodologyPickerProps = {
  value: string;
  onChange: (value: string) => void;
  options: MethodologyOption[];
  sourceUrl?: string | null;
  lastLoadedAt?: string | null;
};

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

function normalizeVersionLabel(version: string | undefined) {
  const raw = (version ?? "").trim();
  if (!raw) return "";
  if (/^v/i.test(raw)) return raw;
  return `v${raw.replace(/\./g, "-")}`;
}

function optionSecondary(option: MethodologyOption) {
  const parts = [option.program, option.sector].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function optionRightMeta(option: MethodologyOption) {
  const latest = normalizeVersionLabel(option.latestVersion);
  const versions = option.versionsCount;
  if (!latest && !versions) return null;
  if (!latest) return `${versions} version${versions === 1 ? "" : "s"}`;
  if (!versions) return latest;
  return `${latest} · ${versions} version${versions === 1 ? "" : "s"}`;
}

type GroupedOptions = Array<{
  program: string;
  sectors: Array<{
    sector: string | null;
    options: MethodologyOption[];
  }>;
}>;

function groupOptions(options: MethodologyOption[]): GroupedOptions {
  const programMap = new Map<string, Map<string | null, MethodologyOption[]>>();
  for (const option of options) {
    const program = option.program ?? "Other";
    const sector = option.sector ?? null;
    const sectorMap = programMap.get(program) ?? new Map<string | null, MethodologyOption[]>();
    const list = sectorMap.get(sector) ?? [];
    list.push(option);
    sectorMap.set(sector, list);
    programMap.set(program, sectorMap);
  }

  const programs = Array.from(programMap.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  return programs.map(([program, sectorMap]) => {
    const sectors = Array.from(sectorMap.entries())
      .sort((a, b) => {
        if (a[0] === b[0]) return 0;
        if (a[0] === null) return 1;
        if (b[0] === null) return -1;
        return a[0].localeCompare(b[0]);
      })
      .map(([sector, list]) => ({
        sector,
        options: list.sort((a, b) => a.code.localeCompare(b.code)),
      }));
    return { program, sectors };
  });
}

export default function MethodologyPicker({
  value,
  onChange,
  options,
  sourceUrl,
  lastLoadedAt,
}: MethodologyPickerProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => (value === "all" ? null : options.find(option => option.value === value) ?? null),
    [value, options],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter(option => {
      const parts = [
        option.code,
        option.program ?? "",
        option.sector ?? "",
        option.key,
      ];
      return parts.join(" ").toLowerCase().includes(normalized);
    });
  }, [options, query]);

  const grouped = useMemo(() => groupOptions(filtered), [filtered]);

  const flatOptions = useMemo(() => {
    const flattened: Array<{ kind: "all" } | { kind: "option"; option: MethodologyOption }> = [
      { kind: "all" },
    ];
    grouped.forEach(program => {
      program.sectors.forEach(sector => {
        sector.options.forEach(option => {
          flattened.push({ kind: "option", option });
        });
      });
    });
    return flattened;
  }, [grouped]);

  const [activeIndex, setActiveIndex] = useState(0);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      close();
    }
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const currentIndex =
      value === "all"
        ? 0
        : Math.max(
            0,
            flatOptions.findIndex(
              item => item.kind === "option" && item.option.value === value,
            ),
          );
    setActiveIndex(currentIndex === -1 ? 0 : currentIndex);
  }, [open, value, flatOptions]);

  useEffect(() => {
    if (!open) return;
    const id = `method-option-${activeIndex}`;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        triggerRef.current?.focus();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex(current => (current + 1) % flatOptions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex(current => (current - 1 + flatOptions.length) % flatOptions.length);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const current = flatOptions[activeIndex];
        if (!current) return;
        if (current.kind === "all") onChange("all");
        if (current.kind === "option") onChange(current.option.value);
        close();
      }
    },
    [activeIndex, close, flatOptions, onChange],
  );

  const triggerLabel = selected ? selected.code : "All methodologies";
  const triggerMeta = selected ? optionSecondary(selected) : null;

  const content = (
    <div
      className={`w-full ${isMobile ? "h-full" : ""}`}
      onKeyDown={handleKeyDown}
      ref={listRef}
    >
      <div className={`${isMobile ? "sticky top-0 bg-white" : ""}`}>
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Filter methodologies…"
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-white hover:text-slate-700"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex items-center justify-between px-1 text-xs text-slate-500">
          <span>{options.length} methods</span>
          <span className="truncate">
            {sourceUrl ? `Source: ${sourceUrl}` : "Source: —"}
          </span>
        </div>
        {lastLoadedAt ? (
          <div className="mt-1 px-1 text-xs text-slate-400">
            Cached: s-maxage=60 · SWR=600 · Loaded: {lastLoadedAt}
          </div>
        ) : null}
      </div>

      <div className={`${isMobile ? "mt-3" : "mt-2"} max-h-[20rem] overflow-auto`}>
        <button
          id="method-option-0"
          type="button"
          onMouseEnter={() => setActiveIndex(0)}
          onClick={() => {
            onChange("all");
            close();
          }}
          className={`flex w-full items-center justify-between gap-4 rounded-xl px-3 py-3 text-left transition ${
            activeIndex === 0 ? "bg-slate-100" : "hover:bg-slate-50"
          }`}
        >
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">All methodologies</div>
            <div className="text-xs text-slate-500">Show the full catalog</div>
          </div>
          {value === "all" ? (
            <Check className="h-4 w-4 text-slate-900" aria-hidden="true" />
          ) : null}
        </button>

        <div className="mt-2 space-y-3">
          {grouped.map(program => (
            <div key={program.program}>
              <div className="px-2 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {program.program}
              </div>
              {program.sectors.map(sector => (
                <div key={sector.sector ?? "none"} className="mt-2">
                  {sector.sector ? (
                    <div className="px-2 text-xs font-semibold text-slate-500">
                      {sector.sector}
                    </div>
                  ) : null}
                  <div className="mt-1 space-y-1">
                    {sector.options.map(option => {
                      const index = flatOptions.findIndex(
                        item => item.kind === "option" && item.option.key === option.key,
                      );
                      const secondary = optionSecondary(option);
                      const rightMeta = optionRightMeta(option);
                      const isSelected = value === option.value;
                      return (
                        <button
                          key={option.key}
                          id={`method-option-${index}`}
                          type="button"
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => {
                            onChange(option.value);
                            close();
                          }}
                          className={`flex w-full items-center justify-between gap-4 rounded-xl px-3 py-3 text-left transition ${
                            activeIndex === index ? "bg-slate-100" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900">
                                {option.code}
                              </span>
                              {isSelected ? (
                                <Check className="h-4 w-4 text-slate-900" aria-hidden="true" />
                              ) : null}
                            </div>
                            {secondary ? (
                              <div className="mt-0.5 text-xs text-slate-500">{secondary}</div>
                            ) : null}
                          </div>
                          {rightMeta ? (
                            <div className="shrink-0 text-right text-xs font-medium tabular-nums text-slate-500">
                              {rightMeta}
                            </div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-[2.75rem] w-full items-center justify-between gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 transition hover:border-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500 focus-visible:outline-offset-2"
        >
          <div className="flex min-w-0 items-center gap-2 text-left">
            <Filter className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <div className="truncate font-medium">{triggerLabel}</div>
            {triggerMeta ? (
              <div className="truncate text-xs text-slate-500">{triggerMeta}</div>
            ) : null}
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
        </button>

        {open ? (
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              aria-label="Close"
              onClick={close}
              className="absolute inset-0 bg-slate-950/30"
            />
            <div className="absolute inset-x-0 bottom-0 top-[10%] overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Methodologies</div>
                  <div className="text-xs text-slate-500">Tap to filter results</div>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="h-full overflow-y-auto px-5 pb-20 pt-4">{content}</div>
              <div className="absolute inset-x-0 bottom-0 border-t border-slate-200 bg-white px-5 py-4">
                <button
                  type="button"
                  onClick={() => {
                    onChange("all");
                    close();
                  }}
                  className="w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  Clear filter
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex min-h-[2.75rem] w-full items-center justify-between gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 transition hover:border-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500 focus-visible:outline-offset-2"
      >
        <div className="flex min-w-0 items-center gap-2 text-left">
          <Filter className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <div className="truncate font-medium">{triggerLabel}</div>
          {triggerMeta ? (
            <div className="truncate text-xs text-slate-500">{triggerMeta}</div>
          ) : null}
        </div>
        <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-full max-w-[26rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="p-3">{content}</div>
        </div>
      ) : null}
    </div>
  );
}
