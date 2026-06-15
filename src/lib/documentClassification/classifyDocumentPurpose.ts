/**
 * Deterministic document-purpose classifier for Evidence Checks intake.
 *
 * Classifies raw PDF text into a document purpose (project description,
 * verification report, validation report, etc.) using cover-page signals,
 * repeated headers, section headings, and strong key phrases.
 *
 * This is separate from DocumentFamily (program classification like
 * VERRA_PD, CDM_PDD) — a document can have both a program family AND
 * a purpose.
 */

/** Document purpose — what the document IS, not what program it belongs to. */
export type DocumentPurpose =
  | "project_description_pdd"
  | "monitoring_report"
  | "verification_report"
  | "validation_report"
  | "validation_verification_report"
  | "methodology_document"
  | "risk_report"
  | "supporting_evidence_file"
  | "unknown_carbon_document";

export type DocumentPurposeClassification = {
  purpose: DocumentPurpose;
  confidence: number;
  evidence: string[];
};

const HEADER_LINE_COUNT = 15;

type PurposeRule = {
  purpose: DocumentPurpose;
  phrases: RegExp[];
  weight: number;
};

const RULES: PurposeRule[] = [
  {
    purpose: "verification_report",
    phrases: [
      /\bVERIFICATION\s+REPORT\b/i,
      /\bVERIFIED\s+CARBON\s+STANDARD\b/i,
      /\bVCS\s+VERIFICATION\b/i,
      /\bCCB\s*[&]\s*VCS\s+VERIFICATION\b/i,
      /\bVERIFICATION\s+(?:BODY|AUDIT|STATEMENT)\b/i,
    ],
    weight: 1.0,
  },
  {
    purpose: "validation_report",
    phrases: [
      /\bVALIDATION\s+REPORT\b/i,
      /\bVALIDATED\s+CARBON\s+STANDARD\b/i,
      /\b(?:VCS|CCB)\s+VALIDATION\b/i,
      /\bVALIDATION\s+(?:BODY|AUDIT|STATEMENT)\b/i,
      /\bVALIDATION\s+OPINION\b/i,
    ],
    weight: 1.0,
  },
  {
    purpose: "validation_verification_report",
    phrases: [
      /\bVALIDATION\s+(?:AND|&)\s+VERIFICATION\s+REPORT\b/i,
      /\bVERIFICATION\s+(?:AND|&)\s+VALIDATION\s+REPORT\b/i,
      /\bVVB\s+VALIDATION\s+(?:AND|&)\s+VERIFICATION\b/i,
      /\bVALIDATION\s+\/\s+VERIFICATION\s+(?:BODY|REPORT)\b/i,
    ],
    weight: 1.0,
  },
  {
    purpose: "monitoring_report",
    phrases: [
      /\bMONITORING\s+REPORT\b/i,
      /\bMONITORING\s+AND\s+REPORTING\b/i,
      /\bPROJECT\s+MONITORING\s+REPORT\b/i,
      /\bANNUAL\s+MONITORING\b/i,
      /\bMONITORING\s+PERIOD\s+REPORT\b/i,
    ],
    weight: 1.0,
  },
  {
    purpose: "project_description_pdd",
    phrases: [
      /\bPROJECT\s+DESCRIPTION\b/i,
      /\bPROJECT\s+DESIGN\s+DOCUMENT\b/i,
      /\bPDD\b/i,
      /\bPROJECT\s+DOCUMENT\b/i,
      /\bA\/R\s+CDM\s+PROJECT\b/i,
      /\bAFFORESTATION\s+AND\s+REFORESTATION\s+PROJECT\b/i,
      /\bREDD\+\s+PROJECT\b/i,
    ],
    weight: 1.0,
  },
  {
    purpose: "methodology_document",
    phrases: [
      /\bMETHODOLOGY\s+(?:DOCUMENT|DESCRIPTION|FRAMEWORK)\b/i,
      /\bAPPROVED\s+(?:CONSOLIDATED\s+)?METHODOLOGY\b/i,
      /\bMETHODOLOGICAL\s+TOOL\b/i,
    ],
    weight: 0.8,
  },
  {
    purpose: "risk_report",
    phrases: [
      /\bNON[-\s]?PERMANENCE\s+RISK\s+(?:REPORT|ANALYSIS|ASSESSMENT)\b/i,
      /\bAFOLU\s+NON[-\s]?PERMANENCE\b/i,
      /\bRISK\s+RATING\s+(?:REPORT|ANALYSIS)\b/i,
      /\bBUFFER\s+(?:POOL|ACCOUNT)\s+(?:REPORT|ANALYSIS)\b/i,
    ],
    weight: 0.9,
  },
  {
    purpose: "supporting_evidence_file",
    phrases: [
      /\bSUPPORTING\s+(?:EVIDENCE|DOCUMENTATION|INFORMATION)\b/i,
      /\bAPPENDIX\s+[A-Z]\b/i,
      /\bANNEX\s+\d\b/i,
      /\bATTACHMENT\s+\d\b/i,
    ],
    weight: 0.5,
  },
];

export function classifyDocumentPurpose(rawText: string): DocumentPurposeClassification {
  if (!rawText?.trim()) {
    return { purpose: "unknown_carbon_document", confidence: 0, evidence: [] };
  }

  const normalized = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const headerText = lines.slice(0, HEADER_LINE_COUNT).join("\n");
  const fullLower = normalized.toLowerCase();

  // Score each purpose
  const scores = new Map<DocumentPurpose, { score: number; evidence: string[] }>();

  for (const rule of RULES) {
    const entry = scores.get(rule.purpose) ?? { score: 0, evidence: [] };
    for (const phrase of rule.phrases) {
      // Check header lines first (higher confidence)
      const headerMatch = phrase.exec(headerText);
      if (headerMatch) {
        entry.score += rule.weight;
        entry.evidence.push(`header: "${headerMatch[0]}"`);
        phrase.lastIndex = 0;
        continue;
      }
      // Then check full text
      const fullMatch = phrase.exec(fullLower);
      if (fullMatch) {
        entry.score += rule.weight * 0.7; // lower confidence for body matches
        entry.evidence.push(`body: "${fullMatch[0]}"`);
        phrase.lastIndex = 0;
      }
    }
    if (entry.score > 0) scores.set(rule.purpose, entry);
  }

  // No matches → unknown
  if (scores.size === 0) {
    return { purpose: "unknown_carbon_document", confidence: 0.2, evidence: [] };
  }

  // Pick highest-scoring purpose
  let bestPurpose: DocumentPurpose = "unknown_carbon_document";
  let bestScore = 0;
  let bestEvidence: string[] = [];

  for (const [purpose, entry] of scores) {
    if (entry.score > bestScore) {
      bestScore = entry.score;
      bestPurpose = purpose;
      bestEvidence = entry.evidence;
    }
  }

  // Confidence: cap at 0.98
  const confidence = Math.min(0.98, 0.4 + bestScore / 2);

  return { purpose: bestPurpose, confidence, evidence: bestEvidence };
}

/** Human-readable label for each document purpose. */
export function documentPurposeLabel(purpose: DocumentPurpose): string {
  const labels: Record<DocumentPurpose, string> = {
    project_description_pdd: "Project Description / PDD",
    monitoring_report: "Monitoring Report",
    verification_report: "Verification Report",
    validation_report: "Validation Report",
    validation_verification_report: "Validation & Verification Report",
    methodology_document: "Methodology Document",
    risk_report: "Risk Report",
    supporting_evidence_file: "Supporting Evidence / Appendix",
    unknown_carbon_document: "Carbon Document (unclassified)",
  };
  return labels[purpose];
}
