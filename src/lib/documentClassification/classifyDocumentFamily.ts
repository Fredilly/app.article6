import type {
  DocumentFamily,
  DocumentFamilyClassification,
  DocumentFamilyClassifier,
  DocumentTemplateSignal,
} from "@/lib/documentClassification/documentFamilyTypes";
import { buildDocumentQualityReport } from "@/lib/documentClassification/buildDocumentQualityReport";
import type { ParsedDocument } from "@/lib/documentParsing/types";

type FamilyRule = {
  family: Exclude<DocumentFamily, "UNKNOWN">;
  label: string;
  kind: DocumentTemplateSignal["kind"];
  pattern: RegExp;
  weight: number;
};

const FAMILY_RULES: FamilyRule[] = [
  {
    family: "CDM_PDD",
    label: "Clean Development Mechanism",
    kind: "program_keyword",
    pattern: /\bclean development mechanism\b/i,
    weight: 1,
  },
  {
    family: "CDM_PDD",
    label: "CDM project design document",
    kind: "template_keyword",
    pattern: /\bcdm\b.{0,40}\bproject design document\b|\bproject design document\b.{0,40}\bcdm\b/i,
    weight: 1,
  },
  {
    family: "VERRA_PD",
    label: "Verra reference",
    kind: "program_keyword",
    pattern: /\bverra\b/i,
    weight: 1,
  },
  {
    family: "VERRA_PD",
    label: "VCS program under Verra",
    kind: "template_keyword",
    pattern: /\bvcs program\b/i,
    weight: 0.65,
  },
  {
    family: "VCS_PD",
    label: "Verified Carbon Standard",
    kind: "program_keyword",
    pattern: /\bverified carbon standard\b/i,
    weight: 0.95,
  },
  {
    family: "VCS_PD",
    label: "VCS project description",
    kind: "template_keyword",
    pattern: /\bvcs\b.{0,40}\bproject description\b|\bproject description\b.{0,40}\bvcs\b/i,
    weight: 0.9,
  },
  {
    family: "GOLD_STANDARD_PDD",
    label: "Gold Standard reference",
    kind: "program_keyword",
    pattern: /\bgold standard\b/i,
    weight: 1,
  },
  {
    family: "GOLD_STANDARD_PDD",
    label: "Gold Standard PDD",
    kind: "template_keyword",
    pattern: /\bgold standard\b.{0,60}\bproject design document\b|\bproject design document\b.{0,60}\bgold standard\b/i,
    weight: 1,
  },
  {
    family: "REDD_AFOLU",
    label: "REDD signal",
    kind: "sector_keyword",
    pattern: /\bredd\+?\b|\breducing emissions from deforestation\b/i,
    weight: 0.85,
  },
  {
    family: "REDD_AFOLU",
    label: "AFOLU signal",
    kind: "sector_keyword",
    pattern: /\bafolu\b|\bafforestation\b|\breforestation\b|\bavoided deforestation\b|\bforest conservation\b/i,
    weight: 0.8,
  },
  {
    family: "ENERGY",
    label: "Energy generation signal",
    kind: "sector_keyword",
    pattern: /\brenewable energy\b|\bgrid electricity\b|\bpower plant\b|\bwind farm\b|\bsolar\b|\bhydropower\b|\bhydro power\b|\bbiogas\b/i,
    weight: 0.85,
  },
  {
    family: "ENERGY",
    label: "Energy unit signal",
    kind: "sector_keyword",
    pattern: /\b(?:mw|mwh|kwh|kw)\b|\bturbine\b|\bboiler\b|\belectricity\b/i,
    weight: 0.65,
  },
];

const PROGRAM_FAMILY_PRIORITY: DocumentFamily[] = [
  "CDM_PDD",
  "GOLD_STANDARD_PDD",
  "VERRA_PD",
  "VCS_PD",
];

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function roundMetric(value: number): number {
  return Number(value.toFixed(3));
}

function firstEvidenceMatch(text: string, pattern: RegExp): string {
  const match = text.match(pattern);
  return match?.[0]?.trim() ?? pattern.source;
}

export function classifyDocumentFamily(parsedDocument: ParsedDocument): DocumentFamilyClassification {
  const qualityReport = buildDocumentQualityReport(parsedDocument);
  const haystack = normalizeText(parsedDocument.rawText);
  const signals: DocumentTemplateSignal[] = [];
  const scores = new Map<Exclude<DocumentFamily, "UNKNOWN">, number>();

  for (const rule of FAMILY_RULES) {
    if (!rule.pattern.test(haystack)) continue;
    const evidence = firstEvidenceMatch(parsedDocument.rawText, rule.pattern);
    signals.push({
      kind: rule.kind,
      family: rule.family,
      label: rule.label,
      evidence,
      weight: rule.weight,
    });
    scores.set(rule.family, (scores.get(rule.family) ?? 0) + rule.weight);
  }

  signals.push({
    kind: "quality_metric",
    label: "Page count",
    evidence: `${qualityReport.pageCount} page(s)`,
    weight: Math.min(0.3, qualityReport.pageCount / 10),
  });
  signals.push({
    kind: "quality_metric",
    label: "Text density",
    evidence: `${qualityReport.textDensity}`,
    weight: qualityReport.textDensity,
  });

  if (qualityReport.ocrConfidence !== undefined) {
    signals.push({
      kind: "quality_metric",
      label: "OCR confidence",
      evidence: `${qualityReport.ocrConfidence}`,
      weight: qualityReport.ocrConfidence,
    });
  }

  if (qualityReport.weakExtractionWarning) {
    signals.push({
      kind: "quality_warning",
      label: "Weak extraction warning",
      evidence: "Parsed text is sparse or weakly structured.",
      weight: 0,
    });
  }

  const warnings = [...qualityReport.warnings];
  const programCandidates = PROGRAM_FAMILY_PRIORITY
    .map((family) => ({ family, score: scores.get(family as Exclude<DocumentFamily, "UNKNOWN">) ?? 0 }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);

  const sectorCandidates = (["REDD_AFOLU", "ENERGY"] as const)
    .map((family) => ({ family, score: scores.get(family) ?? 0 }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);

  let family: DocumentFamily = "UNKNOWN";
  let confidence = 0.2;

  const strongestProgram = programCandidates[0];
  const strongestSector = sectorCandidates[0];
  const verraScore = scores.get("VERRA_PD") ?? 0;
  const vcsScore = scores.get("VCS_PD") ?? 0;

  if (
    strongestProgram
    && strongestProgram.score >= 0.9
    && (!qualityReport.weakExtractionWarning || strongestProgram.score >= 1.6)
  ) {
    family = strongestProgram.family;
    if (family === "VCS_PD" && verraScore >= 1 && verraScore >= vcsScore - 0.5) {
      family = "VERRA_PD";
    }
    confidence = Math.min(0.98, 0.4 + Math.max(strongestProgram.score, verraScore) / 1.8);
  } else if (!qualityReport.weakExtractionWarning && strongestSector && strongestSector.score >= 0.8) {
    family = strongestSector.family;
    confidence = Math.min(0.9, 0.35 + strongestSector.score / 2);
  } else {
    warnings.push("Document family remained UNKNOWN because deterministic intake signals were insufficient.");
  }

  return {
    family,
    confidence: roundMetric(confidence),
    evidence: signals.map((signal) => `${signal.label}: ${signal.evidence}`),
    signals,
    warnings: [...new Set(warnings)],
  };
}

export const documentFamilyClassifier: DocumentFamilyClassifier = {
  classify(parsedDocument: ParsedDocument): DocumentFamilyClassification {
    return classifyDocumentFamily(parsedDocument);
  },
};
