"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type VersionSelectorProps = {
  methodCode: string;
  versions: string[];
  selectedVersion?: string;
};

export default function VersionSelector({
  methodCode,
  versions,
  selectedVersion,
}: VersionSelectorProps) {
  const router = useRouter();
  const [value, setValue] = useState(selectedVersion ?? "");

  const options = useMemo(() => {
    return versions.map((version) => ({ value: version, label: version }));
  }, [versions]);

  if (options.length === 0) {
    return (
      <span className="text-xs text-slate-500" aria-label="No versions available">
        No versions
      </span>
    );
  }

  return (
    <label className="flex items-center gap-2 text-xs text-slate-600">
      <span className="shrink-0">Version</span>
      <select
        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          setValue(next);
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
  );
}

