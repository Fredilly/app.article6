import type { RuleSummary } from "@/app/m/_lib/methodRules";
import { getStructuredQueryContext } from "@/lib/chat/quickCheckReviewQuestion";
import { extractAnswersForAllChecks } from "@/lib/quickCheckV2/answers";
import { parseExtractedText } from "@/lib/quickCheckV2/evidence";
import { validateAnswerResults } from "@/lib/quickCheckV2/status";
import { buildQuickCheckMethodologyIdentity, type QuickCheckMethodologyIdentity } from "@/lib/quickCheckV2/methodologyIdentity";
import { auditEvidence, type MethodologyEvidenceAuditRule, type MethodologyEvidenceAuditSummary } from "@/lib/preverif/evidenceAudit";
import { getVm0007EvidenceContract, normalizeVm0007RuleId } from "@/lib/preverif/vm0007EvidenceContracts";
import { buildVm0007EvidenceMapDraft, type DraftBuildResult } from "@/lib/preverif/vm0007EvidenceMapDraft";
import type { EvidenceMapSourceDocumentIdentity } from "@/lib/evidence/evidenceMapDependencyContract";

export type Vm0007MachineProposalBuild = {
  methodology: QuickCheckMethodologyIdentity | null;
  audit: MethodologyEvidenceAuditSummary;
  sourceDocument: EvidenceMapSourceDocumentIdentity;
  draft: DraftBuildResult;
};

function mapRule(rule: RuleSummary): MethodologyEvidenceAuditRule {
  return { id: rule.id, title: rule.title, summary: rule.summary ?? rule.snippet, type: rule.type, logic: rule.logic, text: rule.text };
}

/** Canonical pure VM0007 proposal builder shared by Quick Check and reproducible generation. */
export function buildVm0007MachineProposal(input: {
  auditId: string;
  generatedAt: string;
  methodologyId: string;
  methodologyVersion: string;
  methodology?: QuickCheckMethodologyIdentity | null;
  evidenceFileName?: string;
  sourcePdfSha256?: string | null;
  rawPddText: string;
  rules: readonly RuleSummary[];
  userAcceptedVersionWarning?: boolean;
}): Vm0007MachineProposalBuild {
  if (input.methodologyId.trim().toUpperCase() !== "VM0007") throw new Error("methodology_id_mismatch");
  if (!input.rawPddText.trim() || input.rules.length === 0) throw new Error("malformed_audit_output");

  const context = getStructuredQueryContext(input.rawPddText);
  const parsedDocument = parseExtractedText(input.rawPddText, context.evidenceDocument.docId, context.parsedDocument.adapterId ?? "quick-check-panel");
  const methodologyResult = validateAnswerResults(extractAnswersForAllChecks(parsedDocument)).find((result) => result.checkName === "methodology");
  const methodology = input.methodology ?? methodologyResult?.methodology ?? buildQuickCheckMethodologyIdentity(methodologyResult?.evidence ?? null) ?? null;
  const audit = auditEvidence({
    rules: input.rules.map(mapRule), evidenceDocument: context.evidenceDocument, getContract: getVm0007EvidenceContract,
    normalizeRuleId: normalizeVm0007RuleId, sections: context.documentStructure.sections, rawText: input.rawPddText,
    versionContext: {
      methodologyId: input.methodologyId,
      rulebookVersion: input.methodologyVersion,
      pddDeclaredMethodologyId: methodology?.methodologyId,
      pddDeclaredMethodologyVersion: methodology?.pddDeclaredMethodologyVersion ?? "",
    },
    userAcceptedVersionWarning: input.userAcceptedVersionWarning,
  });
  const sourceDocument: EvidenceMapSourceDocumentIdentity = {
    documentId: context.evidenceDocument.docId,
    documentName: input.evidenceFileName?.trim() || null,
    contentSha256: input.sourcePdfSha256?.trim() || null,
  };
  const draft = buildVm0007EvidenceMapDraft({ auditId: input.auditId, generatedAt: input.generatedAt, rules: input.rules, audit, sourceDocument });
  return { methodology, audit, sourceDocument, draft };
}
