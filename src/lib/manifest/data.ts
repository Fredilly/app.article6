export type ManifestEntry = {
  id: string;
  methodology: string;
  version: string;
  rule: string;
  tags: string[];
  pdfId: string;
  anchor: string;
  sha256: string;
};

export const MANIFEST_ENTRIES: ManifestEntry[] = [
  {
    id: "baseline-carbon-44-12",
    methodology: "AR-AMS0003",
    version: "v01.0",
    rule: "Baseline carbon fraction uses molecular weight ratio 44/12",
    tags: ["baseline", "carbon", "conversion"],
    pdfId: "baseline-carbon-44-12",
    anchor: "#baseline-carbon-4412",
    sha256: "8b4c0b1fa541a0c93ad8d95567acbbbe42a9f6fb9e31f4f0c1a88d730c7f61fa",
  },
  {
    id: "sampling-confidence",
    methodology: "AR-AMS0007",
    version: "v03.1",
    rule: "Sampling stratification achieves 90/10 confidence",
    tags: ["sampling", "confidence", "statistics"],
    pdfId: "baseline-carbon-44-12",
    anchor: "#sampling-confidence-9010",
    sha256: "d1e57ef0bb0c2226f08e9e812309161cbb2e27c6fd5953dd75d99b97f1eed8f9",
  },
  {
    id: "buffer-pool-risk",
    methodology: "AR-AMS0007",
    version: "v03.1",
    rule: "Buffer pool contribution aligns with project risk class",
    tags: ["buffer", "risk", "safeguard"],
    pdfId: "baseline-carbon-44-12",
    anchor: "#buffer-pool-risk-table",
    sha256: "f3a6f980c8d3e48361f306e02e9a7df3de229a3d4e753d2c73e957a920d06d42",
  },
  {
    id: "leakage-accounting",
    methodology: "AR-AMS0003",
    version: "v01.0",
    rule: "Leakage assessment must document activity shifting",
    tags: ["leakage", "reporting"],
    pdfId: "baseline-carbon-44-12",
    anchor: "#leakage-reporting",
    sha256: "4e6f3355104d8179af0d6dd4276f9889deb6b817dcf77247bbf97a3e5c848c5d",
  },
  {
    id: "monitoring-frequency",
    methodology: "AR-AMS0007",
    version: "v03.1",
    rule: "Permanent plots monitored at least every 5 years",
    tags: ["monitoring", "plots"],
    pdfId: "baseline-carbon-44-12",
    anchor: "#monitoring-frequency",
    sha256: "0f4e2e98f3a0d6cc1ff8765c60f2f6a8598d936d44df91a87e9c76d3fd7ad987",
  },
];
