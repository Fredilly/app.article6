"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type ManifestFiltersState = {
  search: string;
  tags: string[];
};

export function parseTags(raw: string | null | undefined) {
  if (!raw) return [] as string[];
  return raw
    .split(",")
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0)
    .map(tag => decodeURIComponent(tag.toLowerCase()))
    .filter((tag, index, arr) => arr.indexOf(tag) === index);
}

export function serializeFilters(state: ManifestFiltersState) {
  const params = new URLSearchParams();
  const trimmed = state.search.trim();
  if (trimmed) params.set("q", trimmed);
  if (state.tags.length > 0) params.set("tags", state.tags.join(","));
  return params.toString();
}

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false;
  }
  return true;
}

export function useManifestFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  const currentParams = useMemo(() => searchParams?.toString() ?? "", [searchParams]);

  useEffect(() => {
    const qParam = searchParams?.get("q") ?? "";
    const tagParam = parseTags(searchParams?.get("tags"));
    setSearch(prev => (prev === qParam ? prev : qParam));
    setTags(prev => (arraysEqual(prev, tagParam) ? prev : tagParam));
  }, [searchParams]);

  useEffect(() => {
    if (!initialized) {
      setInitialized(true);
      return;
    }
    const nextParams = serializeFilters({ search, tags });
    if (nextParams === currentParams) return;
    const nextUrl = nextParams ? `${pathname}?${nextParams}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [search, tags, router, pathname, currentParams, initialized]);

  const toggleTag = useCallback((tag: string) => {
    setTags(prev => {
      const normalized = tag.toLowerCase();
      return prev.includes(normalized)
        ? prev.filter(existing => existing !== normalized)
        : [...prev, normalized].sort();
    });
  }, []);

  const clearTags = useCallback(() => {
    setTags([]);
  }, []);

  const isTagSelected = useCallback((tag: string) => {
    const normalized = tag.toLowerCase();
    return tags.includes(normalized);
  }, [tags]);

  return {
    search,
    setSearch,
    selectedTags: tags,
    toggleTag,
    clearTags,
    isTagSelected,
  } as const;
}
