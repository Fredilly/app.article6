import type { ManifestEntry } from "@/lib/manifest/cards";

export type ManifestRule = ManifestEntry & {
  ruleId: string;
  methodology: string;
  version: string;
  rule: string;
  tags: string[];
  sha256?: string;
  pdfId?: string;
  anchor?: string;
  pdfPage?: number;
  source?: string;
};

export type RuleVersionOption = {
  version: string;
  rule?: ManifestRule;
};
