export type AuditRule = {
  id: string;
  title: string;
  summary: string;
  anchor: string;
  sectionId: string;
  sha256: string;
};

export type ExtractedVariable = {
  id: string;
  label: string;
  value: string;
  sectionId: string;
  sha256: string;
};

export const SAMPLE_RULES: AuditRule[] = [
  {
    id: "rule-clarification-baseline",
    title: "Baseline carbon fraction must reference 44/12 conversion",
    summary: "Demonstrate that the baseline carbon fraction applies the molecular weight conversion factor of 44/12 for CO₂ to C.",
    anchor: "#baseline-carbon-4412",
    sectionId: "SEC-3.1",
    sha256: "8b4c0b1fa541a0c93ad8d95567acbbbe42a9f6fb9e31f4f0c1a88d730c7f61fa",
  },
  {
    id: "rule-sampling-confidence",
    title: "Sampling stratification requires 90/10 confidence",
    summary: "Confirm sampling strata achieve at least 90% confidence with a 10% relative margin of error.",
    anchor: "#sampling-confidence-9010",
    sectionId: "SEC-4.2",
    sha256: "d1e57ef0bb0c2226f08e9e812309161cbb2e27c6fd5953dd75d99b97f1eed8f9",
  },
  {
    id: "rule-buffer-pool",
    title: "Buffer pool contributions align with risk assessment",
    summary: "Verify buffer pool contribution percentages match the qualitative risk assessment for the project class.",
    anchor: "#buffer-pool-risk-table",
    sectionId: "SEC-5.4",
    sha256: "f3a6f980c8d3e48361f306e02e9a7df3de229a3d4e753d2c73e957a920d06d42",
  },
];

export const EXTRACTED_VARIABLES: ExtractedVariable[] = [
  {
    id: "var-44-12",
    label: "Baseline carbon fraction conversion",
    value: "44/12",
    sectionId: "SEC-3.1",
    sha256: "8b4c0b1fa541a0c93ad8d95567acbbbe42a9f6fb9e31f4f0c1a88d730c7f61fa",
  },
  {
    id: "var-confidence",
    label: "Sampling confidence",
    value: "90/10",
    sectionId: "SEC-4.2",
    sha256: "d1e57ef0bb0c2226f08e9e812309161cbb2e27c6fd5953dd75d99b97f1eed8f9",
  },
  {
    id: "var-buffer",
    label: "Buffer risk class",
    value: "Medium",
    sectionId: "SEC-5.4",
    sha256: "f3a6f980c8d3e48361f306e02e9a7df3de229a3d4e753d2c73e957a920d06d42",
  },
];
