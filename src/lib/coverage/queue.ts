export type CoverageQueueRule = {
  id: string;
  title: string;
  tags: string[];
  status?: "covered" | "uncovered" | "weak";
};

export type CoverageQueueSummary = {
  total: number;
  covered: number;
  uncovered: number;
  topUncovered: CoverageQueueRule[];
  allUncovered: CoverageQueueRule[];
};

export function buildCoverageQueue(input: {
  rules: CoverageQueueRule[];
  coveredRuleIds: Set<string>;
  limit: number;
}): CoverageQueueSummary {
  const total = input.rules.length;
  const uncoveredRules = input.rules.filter((rule) => !input.coveredRuleIds.has(rule.id));
  const covered = total - uncoveredRules.length;
  const uncovered = uncoveredRules.length;
  const topUncovered = uncoveredRules.slice(0, input.limit);
  return {
    total,
    covered,
    uncovered,
    topUncovered,
    allUncovered: uncoveredRules,
  };
}
