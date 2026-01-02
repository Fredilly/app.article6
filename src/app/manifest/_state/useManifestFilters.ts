"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type FiltersState = {
  query: string;
  methodology: string;
  tags: string[];
  version: string;
};

const DEFAULT_STATE: FiltersState = {
  query: "",
  methodology: "all",
  tags: [],
  version: "",
};

function parseTags(value: string | null): string[] {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(",")
        .map(tag => tag.trim())
        .filter(Boolean),
    ),
  );
}

function parseFilters(params: URLSearchParams | Readonly<URLSearchParams>): FiltersState {
  const query = params.get("q") ?? "";
  const methodology =
    params.get("method") ?? params.get("methodology") ?? DEFAULT_STATE.methodology;
  const tags = parseTags(params.get("tags"));
  const version = params.get("version") ?? DEFAULT_STATE.version;
  return {
    query,
    methodology: methodology || DEFAULT_STATE.methodology,
    tags,
    version: version || DEFAULT_STATE.version,
  };
}

function buildSearchString(state: FiltersState) {
  const params = new URLSearchParams();
  if (state.query.trim()) params.set("q", state.query.trim());
  if (state.methodology && state.methodology !== DEFAULT_STATE.methodology) {
    params.set("methodology", state.methodology);
    params.set("method", state.methodology);
  }
  if (state.tags.length) params.set("tags", state.tags.join(","));
  if (state.version.trim()) params.set("version", state.version.trim());
  return params.toString();
}

export type ManifestFilters = {
  query: string;
  setQuery: (value: string) => void;
  methodology: string;
  setMethodology: (value: string) => void;
  version: string;
  setVersion: (value: string) => void;
  activeTags: string[];
  toggleTag: (tag: string) => void;
  clearTags: () => void;
  searchString: string;
};

export default function useManifestFilters(): ManifestFilters {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFiltersState] = useState<FiltersState>(() =>
    parseFilters(new URLSearchParams(searchParams)),
  );

  const lastAppliedRef = useRef<string | null>(null);

  const applyUrl = useCallback(
    (next: FiltersState) => {
      const search = buildSearchString(next);
      lastAppliedRef.current = search;
      const href = search ? `${pathname}?${search}` : pathname;
      router.replace(href, { scroll: false });
    },
    [pathname, router],
  );

  const setFilters = useCallback(
    (updater: FiltersState | ((prev: FiltersState) => FiltersState)) => {
      setFiltersState(prev => {
        const next =
          typeof updater === "function"
            ? (updater as (prev: FiltersState) => FiltersState)(prev)
            : updater;
        applyUrl(next);
        return next;
      });
    },
    [applyUrl],
  );

  useEffect(() => {
    const incoming = new URLSearchParams(searchParams);
    const incomingString = incoming.toString();
    if (incomingString === (lastAppliedRef.current ?? "")) {
      lastAppliedRef.current = null;
      return;
    }
    const parsed = parseFilters(incoming);
    setFiltersState(parsed);
  }, [searchParams]);

  const setQuery = useCallback(
    (value: string) => {
      setFilters(prev => ({
        ...prev,
        query: value,
      }));
    },
    [setFilters],
  );

  const setMethodology = useCallback(
    (value: string) => {
      setFilters(prev => ({
        ...prev,
        methodology: value || DEFAULT_STATE.methodology,
      }));
    },
    [setFilters],
  );

  const setVersion = useCallback(
    (value: string) => {
      setFilters(prev => ({
        ...prev,
        version: value.trim(),
      }));
    },
    [setFilters],
  );

  const toggleTag = useCallback(
    (tag: string) => {
      const normalized = tag.trim();
      if (!normalized) return;
      setFilters(prev => {
        const hasTag = prev.tags.includes(normalized);
        const nextTags = hasTag
          ? prev.tags.filter(existing => existing !== normalized)
          : [...prev.tags, normalized];
        return { ...prev, tags: nextTags };
      });
    },
    [setFilters],
  );

  const clearTags = useCallback(() => {
    setFilters(prev => {
      if (!prev.tags.length) return prev;
      return { ...prev, tags: [] };
    });
  }, [setFilters]);

  const searchString = useMemo(() => buildSearchString(filters), [filters]);

  return {
    query: filters.query,
    setQuery,
    methodology: filters.methodology,
    setMethodology,
    version: filters.version,
    setVersion,
    activeTags: filters.tags,
    toggleTag,
    clearTags,
    searchString,
  };
}
