"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";

import { ManifestRule, RuleVersionOption } from "../_types";
import VersionDiffModal from "./VersionDiffModal";

type VersionSwitcherProps = {
  rule: ManifestRule;
  versions: RuleVersionOption[];
};

export default function VersionSwitcher({ rule, versions }: VersionSwitcherProps) {
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [showModal, setShowModal] = useState(false);
  const [comparisonRule, setComparisonRule] = useState<ManifestRule | null>(null);

  const comparable = useMemo(() => {
    return versions
      .filter(option => option.rule)
      .map(option => option as Required<RuleVersionOption>)
      .sort((a, b) => a.version.localeCompare(b.version));
  }, [versions]);

  const hasAlternatives = comparable.some(option => option.version !== rule.version);

  const handleSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextVersion = event.target.value;
    setSelectedVersion(nextVersion);
    const match = comparable.find(option => option.version === nextVersion);
    if (!match || match.rule.version === rule.version) return;
    setComparisonRule(match.rule);
    setShowModal(true);
  };

  return (
    <>
      <label className="inline-flex flex-col text-xs font-medium text-slate-500">
        Version
        <select
          value={selectedVersion}
          onChange={handleSelect}
          disabled={!hasAlternatives}
          className={clsx(
            "mt-1 h-11 min-w-[12rem] rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2",
            hasAlternatives ? "hover:border-slate-300 hover:text-slate-900" : "cursor-not-allowed opacity-50",
          )}
          aria-label="Compare methodology versions"
        >
          <option value="">
            {hasAlternatives ? "Select version" : "Single version"}
          </option>
          {comparable.map(option => (
            <option key={option.version} value={option.version} disabled={option.version === rule.version}>
              {option.version === rule.version ? `${option.version} (current)` : option.version}
            </option>
          ))}
        </select>
      </label>
      {comparisonRule ? (
        <VersionDiffModal
          open={showModal}
          onClose={() => {
            setShowModal(false);
            setSelectedVersion("");
            setComparisonRule(null);
          }}
          current={rule}
          target={comparisonRule}
        />
      ) : null}
    </>
  );
}
