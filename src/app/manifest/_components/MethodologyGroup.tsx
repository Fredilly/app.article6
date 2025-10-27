import RuleCard, { type RuleCardProps } from "./RuleCard";
import { ManifestRule } from "../_types";

export type MethodologyGroupProps = {
  methodology: string;
  rules: ManifestRule[];
  visibleCount: number;
  onTagToggle: (tag: string) => void;
  isTagActive: (tag: string) => boolean;
  versionLookup: (rule: ManifestRule) => RuleCardProps["versions"];
};

export function MethodologyGroup({
  methodology,
  rules,
  visibleCount,
  onTagToggle,
  isTagActive,
  versionLookup,
}: MethodologyGroupProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-slate-900">{methodology}</h2>
        <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {visibleCount}
        </span>
      </div>
      <ul className="space-y-4">
        {rules.map(rule => (
          <li key={`${rule.id}-${rule.version}`}>
            <RuleCard
              rule={rule}
              onTagToggle={onTagToggle}
              isTagActive={isTagActive}
              versions={versionLookup(rule)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default MethodologyGroup;
