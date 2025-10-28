"use client";

import { type ManifestEntry } from "@/lib/manifest/cards";

type VersionSwitcherProps = {
  methodology: string;
  currentVersion: string;
  options: ManifestEntry[];
  onSelect: (entry: ManifestEntry) => void;
};

export default function VersionSwitcher({
  methodology,
  currentVersion,
  options,
  onSelect,
}: VersionSwitcherProps) {
  const hasAlternatives = options.length > 1;

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const selectedVersion = event.target.value;
    if (selectedVersion === currentVersion) return;
    const match = options.find(entry => entry.version === selectedVersion);
    if (match) onSelect(match);
  }

  return (
    <label className="inline-flex min-h-[2.75rem] items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-700 transition hover:border-slate-300 focus-within:outline focus-within:outline-2 focus-within:outline-slate-500 focus-within:outline-offset-2">
      <span className="hidden sm:inline">Version</span>
      <select
        className="min-h-[2.5rem] bg-transparent text-sm text-slate-800 focus:outline-none"
        aria-label={`Compare ${methodology} versions`}
        value={currentVersion}
        onChange={handleChange}
        disabled={!hasAlternatives}
      >
        {options.map(entry => (
          <option key={entry.version} value={entry.version}>
            {entry.version}
            {entry.version === currentVersion ? " (current)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
