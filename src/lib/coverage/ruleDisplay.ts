/**
 * Shared display metadata for methodology rules.
 *
 * Both the Coverage Queue drawer and the opened rule card/modal should
 * use this helper so they show the same human-readable metadata for the
 * same rule.
 *
 * The raw methodology pack uses two shapes:
 *   rich format (rules.rich.json) → summary = human title, id = stable ID
 *   plain format (rules.json)     → title   = human title, id = short ID
 *
 * This helper normalises both shapes and exposes a "rule ID" that is the
 * shortest useful machine-readable identifier.
 */

export type RuleDisplayMetadata = {
  /** Full stable ID (e.g. "Verra.AFOLU.VM0007.v1-8.R-3-0002") */
  stableId: string;
  /** Human-readable title (e.g. "Minimum alternative scenario list") */
  humanTitle: string;
  /** Methodology section ID (e.g. "S-6" or "S-1") */
  sectionId: string;
  /** Human-readable section title (e.g. "Section 6 — Baseline Scenario") */
  sectionTitle: string;
  /** Coverage status: covered, uncovered, or weak */
  status?: "covered" | "uncovered" | "weak";
};

/**
 * Normalise a rule-like object into consistent display metadata.
 *
 * Accepts both the richer type used internally (RuleListItem / RuleSummary)
 * and the trimmed CoverageQueueRule shape.
 */
export function getRuleDisplayMetadata(rule: {
  id: string;
  title?: string | null;
  summary?: string | null;
  snippet?: string | null;
  sectionId?: string | null;
  sectionTitle?: string | null;
  refs?: {
    primarySection?: string | null;
    sectionStableId?: string | null;
    sections?: (string | null)[];
  } | null;
  status?: "covered" | "uncovered" | "weak" | null;
}): RuleDisplayMetadata {
  // Human title: prefer summary (rich format), fall back to title (plain format)
  const humanTitle =
    rule.summary?.trim() ||
    rule.title?.trim() ||
    "Unknown rule title";

  // Section ID: prefer direct sectionId, then primarySection, then first section from refs
  const sectionId =
    rule.sectionId?.trim() ||
    rule.refs?.primarySection?.trim() ||
    rule.refs?.sectionStableId?.trim() ||
    (rule.refs?.sections?.length ? rule.refs.sections[0]?.trim() ?? "" : "") ||
    "";

  // Section title
  const sectionTitle = rule.sectionTitle?.trim() || "";

  // Stable ID is always rule.id
  const stableId = rule.id;

  return {
    stableId,
    humanTitle,
    sectionId,
    sectionTitle,
    status: rule.status ?? undefined,
  };
}
