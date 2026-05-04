type OverrideKey = `${string}@${string}`;

const AR_ACM0003_V02_0: Record<string, string[]> = {
  "R-1-0001": ["eligibility-proof", "pdd", "gis"],
  "R-1-0002": ["gis", "spreadsheet-workbook", "calculation-support"],
  "R-1-0003": ["monitoring-report", "spreadsheet-workbook", "calculation-support"],
  "R-1-0004": ["monitoring-report", "calculation-support", "pdd"],
  "R-1-0005": ["monitoring-report", "calculation-support"],
  "R-1-0006": ["monitoring-report", "gis", "qa-qc-record"],
  "R-1-0007": ["monitoring-report", "spreadsheet-workbook", "calculation-support"],
  "R-1-0008": ["monitoring-report", "gis", "calculation-support"],
};

const EXPECTED_EVIDENCE_OVERRIDES: Record<OverrideKey, Record<string, string[]>> = {
  "AR-ACM0003@v02-0": AR_ACM0003_V02_0,
};

function shortRuleId(ruleId: string): string {
  const match = ruleId.match(/R-\d+-\d+$/);
  return match ? match[0] : ruleId;
}

export function expectedEvidenceOverrideForRule(
  methodology: string,
  version: string,
  ruleId: string,
): string[] | null {
  const key = `${methodology.trim()}@${version.trim()}` as OverrideKey;
  const overrideSet = EXPECTED_EVIDENCE_OVERRIDES[key];
  if (!overrideSet) return null;
  return overrideSet[ruleId] ?? overrideSet[shortRuleId(ruleId)] ?? null;
}
