import {
  sortEvidenceStack,
  validateEvidenceStack,
  type EvidenceStackItem,
  type EvidenceStackRole,
} from "@/lib/evidence/evidenceStack";
import { buildQuickCheckEvidenceStack } from "@/lib/quickCheckV2/evidenceStackAdapter";
import type {
  QuickCheckV2Block,
  QuickCheckV2ExtractedDocument,
  RetrievedCheckEvidence,
  StructuredCheckId,
} from "@/lib/quickCheckV2/evidence";

const TARGET_CHECKS = new Set<StructuredCheckId>([
  "baseline_scenario",
  "additionality",
  "leakage",
  "stakeholder_consultation",
]);
const METHODOLOGY_VERSION_RE = /\b(?:VM\d{4}|VMD\d{4}|ACM\d{4}|AM\d{4}|AMS-[A-Z0-9.]+|AR-ACM\d{4}|AR-AM[A-Z0-9.-]+|AR-AMS[A-Z0-9.-]*|GS-VER\d+|VT\d{4})\b[^\n.]{0,100}?\b(?:version|ver\.?|v\.?)\s*([0-9]+(?:[.-][0-9]+){0,2})\b/i;
const METHODOLOGY_DECLARATION_CONTEXT_RE = /\b(?:title and reference|application of methodology|applicability|eligibility|methodology identification|methodology applied|summary description|project design)\b/i;
const METHODOLOGY_NON_DECLARATION_RE = /\b(?:previously|formerly|historical|supersed(?:ed|es?)|replaced|transition|migration|migrat(?:ed|ing)|compared with|comparison|older|newer|prior version|reference only|example|as required by)\b/i;

const UNDER_DEVELOPMENT_RE = /\bthis section is under development\b/i;
const NOT_REQUIRED_RE = /\b(?:this )?section is not required (?:for|at) the Under Development stage\b|\bsection not required (?:for|at) the Under Development stage\b/i;

type CheckProfile = {
  contextPatterns: RegExp[];
  incompleteLabel: string;
  incompleteReason: string;
  incompleteRole(block: QuickCheckV2Block): EvidenceStackRole;
  supportingPatterns?: RegExp[];
};

const CHECK_PROFILES: Record<
  Extract<StructuredCheckId, "baseline_scenario" | "additionality" | "leakage" | "stakeholder_consultation">,
  CheckProfile
> = {
  baseline_scenario: {
    contextPatterns: [
      /\bbaseline scenario\b/i,
      /\bbaseline emissions\b/i,
      /\bdetails of the baseline\b/i,
      /\bmost-likely scenario justification\b/i,
    ],
    incompleteLabel: "Formal baseline section incomplete",
    incompleteReason: "Formal baseline scenario section is under development or not required at the Under Development stage.",
    incompleteRole: () => "blocker",
  },
  additionality: {
    contextPatterns: [/\badditionality\b/i, /\bregulatory surplus\b/i],
    incompleteLabel: "Formal additionality section incomplete",
    incompleteReason: "Formal additionality section is incomplete at the Under Development stage.",
    incompleteRole: (block) => (NOT_REQUIRED_RE.test(block.text) ? "blocker" : "caveat"),
  },
  leakage: {
    contextPatterns: [/\bleakage\b/i, /\bleakage emissions\b/i, /\bleakage accounting\b/i, /\bleakage management\b/i],
    incompleteLabel: "Formal leakage section incomplete",
    incompleteReason: "Formal leakage section is incomplete at the Under Development stage.",
    incompleteRole: (block) => (NOT_REQUIRED_RE.test(block.text) ? "blocker" : "caveat"),
  },
  stakeholder_consultation: {
    contextPatterns: [/\bstakeholder\b/i, /\bconsultation\b/i, /\bFPIC\b/i, /\bconsent\b/i, /\bpublic hearing\b/i],
    incompleteLabel: "Formal stakeholder section incomplete",
    incompleteReason: "Formal stakeholder consultation section is incomplete at the Under Development stage.",
    incompleteRole: (block) => (NOT_REQUIRED_RE.test(block.text) ? "blocker" : "caveat"),
    supportingPatterns: [
      /\bconsent\b/i,
      /\bapproval\b/i,
      /\bassembly\b/i,
      /\bmeeting\b/i,
      /\bpublic hearing\b/i,
      /\bactions taken\b/i,
      /\bcomments received\b/i,
      /\bfollow-up\b/i,
    ],
  },
};

function normalizeText(value: string | null | undefined): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function getRelevantText(block: QuickCheckV2Block): string {
  return [
    block.sectionHeading,
    block.sectionPath.join(" "),
    block.text,
  ].filter(Boolean).join(" ");
}

function isValidCompanionBlock(block: QuickCheckV2Block): boolean {
  return (
    normalizeText(block.text).length > 0 &&
    block.blockType !== "header" &&
    block.blockType !== "footer"
  );
}

function isIncompleteText(text: string): boolean {
  return UNDER_DEVELOPMENT_RE.test(text) || NOT_REQUIRED_RE.test(text);
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function toCompanionItem(
  block: QuickCheckV2Block,
  role: EvidenceStackRole,
  label: string,
  reason: string,
): EvidenceStackItem {
  return {
    role,
    page: block.page,
    quote: normalizeText(block.text),
    sectionHeading: block.sectionHeading,
    sectionPath: block.sectionPath,
    spanId: block.spanId,
    sourceType: block.sectionHeading || block.sectionPath.length > 0 ? "exact_section" : "raw_text_fallback",
    label,
    reason,
  };
}

function dedupeEvidenceStack(stack: EvidenceStackItem[]): EvidenceStackItem[] {
  const seen = new Set<string>();
  const deduped: EvidenceStackItem[] = [];

  for (const item of stack) {
    const quote = normalizeText(item.quote);
    const key = item.spanId?.trim()
      ? `span:${item.spanId.trim()}`
      : `page:${item.page}|quote:${quote.toLowerCase()}`;
    if (!quote || seen.has(key)) continue;
    seen.add(key);
    deduped.push({ ...item, quote });
  }

  return deduped;
}

function collectIncompleteCompanions(
  document: QuickCheckV2ExtractedDocument,
  checkName: keyof typeof CHECK_PROFILES,
): EvidenceStackItem[] {
  const profile = CHECK_PROFILES[checkName];

  return document.blocks
    .filter(isValidCompanionBlock)
    .filter((block) => {
      const relevantText = getRelevantText(block);
      return isIncompleteText(block.text) && matchesAny(relevantText, profile.contextPatterns);
    })
    .flatMap((block) => {
      const item = toCompanionItem(
        block,
        profile.incompleteRole(block),
        profile.incompleteLabel,
        profile.incompleteReason,
      );
      return validateEvidenceStack([item]).valid ? [item] : [];
    });
}

function collectStakeholderSupportingCompanions(
  document: QuickCheckV2ExtractedDocument,
): EvidenceStackItem[] {
  const profile = CHECK_PROFILES.stakeholder_consultation;

  return document.blocks
    .filter(isValidCompanionBlock)
    .filter((block) => {
      const relevantText = getRelevantText(block);
      return (
        !isIncompleteText(block.text) &&
        matchesAny(relevantText, profile.contextPatterns) &&
        matchesAny(relevantText, profile.supportingPatterns ?? [])
      );
    })
    .flatMap((block) => {
      const item = toCompanionItem(
        block,
        "supporting",
        "Supporting stakeholder evidence",
        "Related consultation, consent, approval, assembly, meeting, or follow-up evidence.",
      );
      return validateEvidenceStack([item]).valid ? [item] : [];
    });
}

function collectMethodologyVersionConflictCompanions(
  document: QuickCheckV2ExtractedDocument,
): EvidenceStackItem[] {
  const mentions = document.blocks.filter((block) =>
    (block.blockType === "body" || block.blockType === "table") &&
    METHODOLOGY_VERSION_RE.test(block.text) &&
    METHODOLOGY_DECLARATION_CONTEXT_RE.test(getRelevantText(block)) &&
    !METHODOLOGY_NON_DECLARATION_RE.test(getRelevantText(block)),
  );
  const versionsByMethodology = new Map<string, Set<string>>();
  for (const block of mentions) {
    const version = block.text.match(METHODOLOGY_VERSION_RE)?.[1];
    const methodologyId = block.text.match(/\b(?:VM\d{4}|VMD\d{4}|ACM\d{4}|AM\d{4}|AMS-[A-Z0-9.]+|AR-ACM\d{4}|AR-AM[A-Z0-9.-]+|AR-AMS[A-Z0-9.-]*|GS-VER\d+|VT\d{4})\b/i)?.[0].toUpperCase();
    if (!version || !methodologyId) continue;
    const versions = versionsByMethodology.get(methodologyId) ?? new Set<string>();
    versions.add(version.replace(/-/g, "."));
    versionsByMethodology.set(methodologyId, versions);
  }
  const conflictingMethodologies = new Set(
    Array.from(versionsByMethodology.entries())
      .filter(([, versions]) => versions.size > 1)
      .map(([methodologyId]) => methodologyId),
  );
  if (conflictingMethodologies.size === 0) return [];

  return mentions.flatMap((block) => {
    const methodologyId = block.text.match(/\b(?:VM\d{4}|VMD\d{4}|ACM\d{4}|AM\d{4}|AMS-[A-Z0-9.]+|AR-ACM\d{4}|AR-AM[A-Z0-9.-]+|AR-AMS[A-Z0-9.-]*|GS-VER\d+|VT\d{4})\b/i)?.[0].toUpperCase();
    if (!methodologyId || !conflictingMethodologies.has(methodologyId)) return [];
    const item = toCompanionItem(
      block,
      "caveat",
      "Conflicting methodology version declaration",
      "The document declares more than one version of the same methodology; the version cannot be resolved confidently.",
    );
    return validateEvidenceStack([item]).valid ? [item] : [];
  });
}

export function buildQuickCheckEvidenceStackWithCompanions(
  document: QuickCheckV2ExtractedDocument,
  selectedEvidence: RetrievedCheckEvidence,
): EvidenceStackItem[] {
  const primaryStack = buildQuickCheckEvidenceStack(selectedEvidence.evidence);

  if (selectedEvidence.checkName === "methodology") {
    return sortEvidenceStack(dedupeEvidenceStack([
      ...primaryStack,
      ...collectMethodologyVersionConflictCompanions(document),
    ]));
  }

  if (!TARGET_CHECKS.has(selectedEvidence.checkName) || primaryStack.length === 0) {
    return primaryStack;
  }

  let companions: EvidenceStackItem[];
  switch (selectedEvidence.checkName) {
    case "baseline_scenario":
    case "additionality":
    case "leakage":
      companions = collectIncompleteCompanions(document, selectedEvidence.checkName);
      break;
    case "stakeholder_consultation":
      companions = [
        ...collectIncompleteCompanions(document, selectedEvidence.checkName),
        ...dedupeEvidenceStack(collectStakeholderSupportingCompanions(document)).slice(0, 3),
      ];
      break;
    default:
      companions = [];
      break;
  }

  return sortEvidenceStack(dedupeEvidenceStack([...primaryStack, ...companions]));
}
