"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import VersionSelector from "@/app/m/_components/VersionSelector";

type DetailTab = "overview" | "versions";

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
  generatedAt,
  repoSha,
  datasetHash,
  methodHash,
  versionHash,
}: MethodDetailPaneProps) {
  const [tab, setTab] = useState<DetailTab>("overview");

  const sortedVersionsNewestFirst = useMemo(() => {
    return [...method.versions].reverse();
  }, [method.versions]);

  const activeRuleCount =
    (activeVersion ? method.ruleCountByVersion[activeVersion] : undefined) ?? undefined;

  const tabBase =
    "inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold transition";
  const tabActive = "bg-slate-900 text-white";
  const tabIdle = "bg-slate-100 text-slate-700 hover:bg-slate-200";

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
      )}
    </div>
  );
}

