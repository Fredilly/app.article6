"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import VersionSelector from "@/app/m/_components/VersionSelector";

type DetailTab = "overview" | "versions" | "rules";

type MethodDetail = {
  code: string;
  program: string;
  sector: string;
  versions: string[];
  latestVersion?: string;
  versionCount: number;
  hasRich: boolean;
  hasPrevious: boolean;
  ruleCountByVersion: Record<string, number | undefined>;
};

type MethodDetailPaneProps = {
  method: MethodDetail;
  activeVersion?: string;
  initialRuleId?: string;
  generatedAt?: string;
  repoSha?: string;
  datasetHash?: string;
  methodHash?: string;
  versionHash?: string;
};

function shortHash(value?: string): string {
  if (!value) return "—";
  return value.length > 14 ? `${value.slice(0, 10)}…${value.slice(-4)}` : value;
}

function buildDeepLink(basePath: string, methodCode: string, version?: string) {
  const params = new URLSearchParams({ method: methodCode });
  if (version) params.set("version", version);
  return `${basePath}?${params.toString()}`;
}

export default function MethodDetailPane({
  method,
  activeVersion,
  initialRuleId,
  generatedAt,
  repoSha,
  datasetHash,
  methodHash,
  versionHash,
}: MethodDetailPaneProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<DetailTab>(initialRuleId ? "rules" : "overview");
  const [ruleQuery, setRuleQuery] = useState("");
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [rulesDeeplinkWarning, setRulesDeeplinkWarning] = useState<string | null>(null);
  type RuleListItem = { id: string; title: string; snippet: string; tags: string[]; type?: string };
  const [rules, setRules] = useState<RuleListItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(Boolean(initialRuleId));
  const [activeRuleId, setActiveRuleId] = useState<string | null>(initialRuleId ?? null);
  const [ruleDetail, setRuleDetail] = useState<{
    id: string;
    title: string;
    text: string;
    tags: string[];
    type?: string;
    sha256?: string;
    sectionId?: string;
    sourcePath?: string;
  } | null>(null);
  const [ruleDetailLoading, setRuleDetailLoading] = useState(false);
  const [ruleDetailError, setRuleDetailError] = useState<string | null>(null);
  const didOpenFromQuery = useRef(false);

  const sortedVersionsNewestFirst = useMemo(() => {
    return [...method.versions].reverse();
  }, [method.versions]);

  const activeRuleCount =
    (activeVersion ? method.ruleCountByVersion[activeVersion] : undefined) ?? undefined;

  const tabBase =
    "inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold transition";
  const tabActive = "bg-slate-900 text-white";
  const tabIdle = "bg-slate-100 text-slate-700 hover:bg-slate-200";

  const filteredRules = useMemo(() => {
    const q = ruleQuery.trim().toLowerCase();
    if (!q) return rules;
    return rules.filter((rule) => {
      const haystack = `${rule.id} ${rule.title} ${rule.snippet} ${(rule.tags ?? []).join(" ")}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [ruleQuery, rules]);

  useEffect(() => {
    setRules([]);
    setRulesError(null);
    setRulesLoading(false);
    setRulesDeeplinkWarning(null);
    setRuleQuery("");
    setDrawerOpen(false);
    setActiveRuleId(null);
    setRuleDetail(null);
    setRuleDetailError(null);
    setRuleDetailLoading(false);
    didOpenFromQuery.current = false;
  }, [activeVersion, method.code]);

  const ensureRulesLoaded = useCallback(async (): Promise<RuleListItem[]> => {
    if (!activeVersion) return [];
    if (rules.length) return rules;
    if (rulesLoading) return rules;
    setRulesLoading(true);
    setRulesError(null);
    try {
      const response = await fetch(
        `/api/methods/${encodeURIComponent(method.code)}/v/${encodeURIComponent(activeVersion)}/rules`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(`Rules request failed with ${response.status}`);
      const payload = (await response.json()) as { rules?: unknown };
      const list = Array.isArray(payload.rules) ? payload.rules : [];
      const nextRules: RuleListItem[] = [];

      for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;
        const id = typeof record.id === "string" ? record.id : "";
        if (!id) continue;
        const title = typeof record.title === "string" ? record.title : id;
        const snippet = typeof record.snippet === "string" ? record.snippet : "";
        const tags = Array.isArray(record.tags)
          ? record.tags.map((t: unknown) => String(t)).filter(Boolean)
          : [];
        const type = typeof record.type === "string" ? record.type : undefined;
        nextRules.push({ id, title, snippet, tags, type });
      }

      setRules(nextRules);
      return nextRules;
    } catch (error) {
      setRules([]);
      setRulesError(error instanceof Error ? error.message : String(error));
      return [];
    } finally {
      setRulesLoading(false);
    }
  }, [activeVersion, method.code, rules, rulesLoading]);

  const buildRuleLink = useCallback(
    (ruleId: string) => {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const path = `/m/${encodeURIComponent(method.code)}/v/${encodeURIComponent(
        activeVersion ?? "",
      )}?rule=${encodeURIComponent(ruleId)}`;
      return `${origin}${path}`;
    },
    [activeVersion, method.code],
  );

  const loadRuleDetail = useCallback(async (ruleId: string) => {
    if (!activeVersion) return;
    setRuleDetailLoading(true);
    setRuleDetailError(null);
    try {
      const response = await fetch(
        `/api/methods/${encodeURIComponent(method.code)}/v/${encodeURIComponent(activeVersion)}/rules?id=${encodeURIComponent(
          ruleId,
        )}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(`Rule request failed with ${response.status}`);
      const payload = (await response.json()) as { rule?: unknown };
      const rule = payload.rule;
      if (!rule || typeof rule !== "object") throw new Error("Rule payload missing");
      const record = rule as Record<string, unknown>;
      setRuleDetail({
        id: typeof record.id === "string" ? record.id : ruleId,
        title:
          typeof record.title === "string"
            ? record.title
            : typeof record.id === "string"
              ? record.id
              : ruleId,
        text: typeof record.text === "string" ? record.text : "",
        tags: Array.isArray(record.tags)
          ? record.tags.map((t: unknown) => String(t)).filter(Boolean)
          : [],
        type: typeof record.type === "string" ? record.type : undefined,
        sha256: typeof record.sha256 === "string" ? record.sha256 : undefined,
        sectionId: typeof record.sectionId === "string" ? record.sectionId : undefined,
        sourcePath: typeof record.sourcePath === "string" ? record.sourcePath : undefined,
      });
    } catch (error) {
      setRuleDetail(null);
      setRuleDetailError(error instanceof Error ? error.message : String(error));
    } finally {
      setRuleDetailLoading(false);
    }
  }, [activeVersion, method.code]);

  const setRuleParam = useCallback((ruleId?: string) => {
    if (!pathname) return;
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    if (ruleId) params.set("rule", ruleId);
    else params.delete("rule");
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }, [pathname, router]);

  const openRule = useCallback(async (ruleId: string) => {
    setTab("rules");
    setRulesDeeplinkWarning(null);
    const list = await ensureRulesLoaded();
    if (list.length === 0) return;
    if (!list.some((rule) => rule.id === ruleId)) {
      setRulesDeeplinkWarning(`Unknown rule id "${ruleId}".`);
      return;
    }
    setActiveRuleId(ruleId);
    setDrawerOpen(true);
    setRuleParam(ruleId);
    await loadRuleDetail(ruleId);
  }, [ensureRulesLoaded, loadRuleDetail, setRuleParam]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setActiveRuleId(null);
    setRuleDetail(null);
    setRuleDetailError(null);
    setRuleParam(undefined);
  }, [setRuleParam]);

  useEffect(() => {
    if (didOpenFromQuery.current) return;
    if (!initialRuleId) return;
    if (!activeVersion) return;
    didOpenFromQuery.current = true;
    (async () => {
      setTab("rules");
      const list = await ensureRulesLoaded();
      if (list.length === 0) {
        return;
      }
      const exists = list.some((rule) => rule.id === initialRuleId);
      if (!exists) {
        setRulesDeeplinkWarning(`Unknown rule id "${initialRuleId}".`);
        return;
      }
      await openRule(initialRuleId);
    })();
  }, [activeVersion, ensureRulesLoaded, initialRuleId, openRule]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-slate-900">{method.code}</h2>
          <p className="text-sm text-slate-600">
            {method.program} • {method.sector}
          </p>
          <p className="text-xs text-slate-500">
            Latest: {method.latestVersion ?? "—"} • Versions: {method.versionCount}
          </p>
        </div>
        <div className="w-full sm:max-w-xs">
          <VersionSelector
            methodCode={method.code}
            versions={sortedVersionsNewestFirst}
            selectedVersion={activeVersion}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTab("overview")}
          className={`${tabBase} ${tab === "overview" ? tabActive : tabIdle}`}
          aria-pressed={tab === "overview"}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setTab("versions")}
          className={`${tabBase} ${tab === "versions" ? tabActive : tabIdle}`}
          aria-pressed={tab === "versions"}
        >
          Versions
        </button>
        <button
          type="button"
          onClick={async () => {
            setTab("rules");
            await ensureRulesLoaded();
          }}
          className={`${tabBase} ${tab === "rules" ? tabActive : tabIdle}`}
          aria-pressed={tab === "rules"}
        >
          Rules
        </button>
      </div>

      {tab === "overview" ? (
        <div className="mt-4 grid gap-4">
          <div className="grid gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-slate-900">Selected version</span>
              <span className="font-mono text-xs text-slate-700">{activeVersion ?? "—"}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span>Rules: {typeof activeRuleCount === "number" ? activeRuleCount : "—"}</span>
              <span>Rich: {method.hasRich ? "Yes" : "No"} • Previous: {method.hasPrevious ? "Yes" : "No"}</span>
            </div>
          </div>

          <div className="grid gap-2 text-xs text-slate-600">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-slate-700">generated_at</span>
              <span className="font-mono text-slate-700">{generatedAt ?? "—"}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-slate-700">repo sha</span>
              <span className="font-mono text-slate-700">{repoSha ? repoSha.slice(0, 7) : "—"}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-slate-700">dataset hash</span>
              <span className="font-mono text-slate-700">{shortHash(datasetHash)}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-slate-700">method hash</span>
              <span className="font-mono text-slate-700">{shortHash(methodHash)}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-slate-700">version hash</span>
              <span className="font-mono text-slate-700">{shortHash(versionHash)}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={buildDeepLink("/", method.code, activeVersion)}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
            >
              Open in Chat
            </Link>
            <Link
              href={buildDeepLink("/manifest", method.code, activeVersion)}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
            >
              Open in Manifest
            </Link>
            <Link
              href={buildDeepLink("/audit", method.code, activeVersion)}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
            >
              Open in Audit
            </Link>
          </div>
        </div>
      ) : (
        tab === "versions" ? (
        <div className="mt-4 grid gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Available versions
          </div>
          <ul className="grid gap-2">
            {sortedVersionsNewestFirst.map((version) => {
              const selected = Boolean(activeVersion) && version === activeVersion;
              const count = method.ruleCountByVersion[version];
              return (
                <li key={version}>
                  <Link
                    href={`/m/${encodeURIComponent(method.code)}/v/${encodeURIComponent(version)}`}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                      selected
                        ? "border-slate-300 bg-slate-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                    aria-current={selected ? "page" : undefined}
                  >
                    <span className="font-mono text-sm text-slate-900">{version}</span>
                    <span className="text-xs text-slate-500">
                      rules: {typeof count === "number" ? count : "—"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        ) : (
          <div className="mt-4 grid gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Rules for {activeVersion ?? "—"}
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                {filteredRules.length ? (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
                    onClick={async () => {
                      const first = filteredRules[0];
                      if (!first || !activeVersion) return;
                      try {
                        await navigator.clipboard.writeText(buildRuleLink(first.id));
                      } catch {
                        // ignore
                      }
                    }}
                  >
                    Copy first rule link
                  </button>
                ) : null}
                <input
                  type="search"
                  value={ruleQuery}
                  onChange={(event) => setRuleQuery(event.target.value)}
                  placeholder="Search rules…"
                  className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none sm:max-w-xs"
                />
              </div>
            </div>

            {rulesDeeplinkWarning ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {rulesDeeplinkWarning}
              </div>
            ) : null}

            {rulesError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {rulesError}
              </div>
            ) : null}

            {rulesLoading ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Loading rules…
              </div>
            ) : null}

            {!rulesLoading && !rulesError && filteredRules.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                No rules found for this version.
              </div>
            ) : null}

            <ul className="grid gap-2">
              {filteredRules.map((rule) => (
                <li key={rule.id}>
                  <button
                    type="button"
                    onClick={() => openRule(rule.id)}
                    className="flex w-full flex-col gap-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-slate-500">
                        {rule.type ? rule.type : rule.tags.length ? rule.tags.slice(0, 2).join(", ") : "—"}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-slate-900">{rule.title}</div>
                    <div className="font-mono text-xs text-slate-500">{rule.id}</div>
                    <div className="text-sm text-slate-600">{rule.snippet || "—"}</div>
                  </button>
                </li>
              ))}
            </ul>

            {drawerOpen ? (
              <div
                className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
                role="dialog"
                aria-modal="true"
              >
                <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Rule{" "}
                        <span className="break-words font-mono text-xs text-slate-600">
                          {activeRuleId ?? "—"}
                        </span>
                      </div>
                      <div className="mt-2 text-base font-semibold text-slate-900">
                        {ruleDetail?.title ?? "Loading…"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!activeRuleId || !activeVersion) return;
                          try {
                            await navigator.clipboard.writeText(buildRuleLink(activeRuleId));
                          } catch {}
                        }}
                        className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
                      >
                        Copy link
                      </button>
                      <button
                        type="button"
                        onClick={closeDrawer}
                        className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
                    {ruleDetailError ? (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        <div className="font-semibold text-rose-900">Failed to load rule.</div>
                        <div className="mt-1 text-xs text-rose-700">{ruleDetailError}</div>
                        <button
                          type="button"
                          className="mt-3 inline-flex items-center rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-800 shadow-sm hover:border-rose-300 hover:text-rose-900"
                          onClick={() => {
                            if (activeRuleId) {
                              void loadRuleDetail(activeRuleId);
                            }
                          }}
                        >
                          Retry
                        </button>
                      </div>
                    ) : null}
                    {ruleDetailLoading ? (
                      <div className="text-sm text-slate-600">Loading rule…</div>
                    ) : null}

                    {ruleDetail ? (
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                          {ruleDetail.tags.length ? (
                            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium">
                              tags: {ruleDetail.tags.slice(0, 4).join(", ")}
                            </span>
                          ) : null}
                          {ruleDetail.type ? (
                            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium">
                              type: {ruleDetail.type}
                            </span>
                          ) : null}
                          {ruleDetail.sectionId ? (
                            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium">
                              section: {ruleDetail.sectionId}
                            </span>
                          ) : null}
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
                          {ruleDetail.text || "—"}
                        </div>

                        <div className="grid gap-2 text-xs text-slate-600">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-slate-700">sha256</span>
                            <span className="break-all font-mono text-slate-700">
                              {ruleDetail.sha256 ?? "—"}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-slate-700">source</span>
                            <span className="break-all font-mono text-slate-700">
                              {ruleDetail.sourcePath ?? "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )
      )}
    </div>
  );
}
