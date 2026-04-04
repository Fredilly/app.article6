"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MethodVersionLineage } from "@/app/m/_lib/methodVersionMetadata";

type VersionSelectorProps = {
  methodCode: string;
  versions: string[];
  selectedVersion?: string;
  lineage?: MethodVersionLineage | null;
};

export default function VersionSelector({
  methodCode,
  versions,
  selectedVersion,
  lineage,
}: VersionSelectorProps) {
  const router = useRouter();
  const value = selectedVersion ?? "";

  const options = useMemo(() => {
    return versions.map((version) => {
      let suffix = "";
      if (version === lineage?.currentVersion) suffix = " (current)";
      else if (version === lineage?.previousVersion) suffix = " (previous)";
      else if (version === lineage?.nextVersion) suffix = " (next)";
      return { value: version, label: `${version}${suffix}` };
    });
  }, [lineage?.currentVersion, lineage?.nextVersion, lineage?.previousVersion, versions]);

  if (options.length === 0) {
    return (
      <span className="text-xs text-slate-500" aria-label="No versions available">
        No versions
      </span>
    );
  }

  return (
    <div className="grid gap-2">
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <span className="shrink-0">Version</span>
        <select
          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
          value={value}
          onChange={(event) => {
            const next = event.target.value;
            if (!next) return;
            router.push(`/m/${encodeURIComponent(methodCode)}/v/${encodeURIComponent(next)}`);
          }}
        >
          <option value="" disabled>
            Select…
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {lineage?.lineage.length && lineage.lineage.length > 1 ? (
        <div className="flex flex-wrap gap-2 text-[11px]">
          {lineage.lineage.map((version) => {
            const active = version === selectedVersion;
            return (
              <Link
                key={version}
                href={`/m/${encodeURIComponent(methodCode)}/v/${encodeURIComponent(version)}`}
                className={`rounded-full border px-2.5 py-1 font-semibold ${
                  active
                    ? "border-sky-300 bg-sky-50 text-sky-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                {version}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
