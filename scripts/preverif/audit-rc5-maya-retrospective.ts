import Ajv2020 from "ajv/dist/2020";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type JsonRecord = Record<string, any>;

const root = process.cwd();
const rc5Root = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5");
const outputDir = path.join(rc5Root, "rc5-retrospective-audit");
const selectionManifestPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/baselines/rc5/rc5-batch-selection-manifest.json");
const frozenProposalPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");
const fixProvenance = process.argv.includes("--fix-provenance");
export const authorizedBlockerResolutionPacketPath = "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-expert-batch-2-blocker-resolution/blocker-resolution-packet.json";
export const authorizedBlockerResolutionPacketSha256 = "3d227e79a18f49df69c0edf99d7a57c7a15f5ee65a8560c07be6a0ce3c83bbef";
export const authorizedBlockerResolutionRuleIds = new Set([
  "Verra.AFOLU.VM0007.v1-8.R-1-0012",
  "Verra.AFOLU.VM0007.v1-8.R-1-0013",
]);
export const authorizedTargetedPacketPath = "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-targeted-full-pdd-batch-2/review-packet.json";
export const authorizedTargetedPacketSha256 = "0d7cab0a1f4fe02026395e146ea8fcec6bb99a5679306b3c146f25435824c1a3";
export const authorizedTargetedRuleIds = new Set([
  "Verra.AFOLU.VM0007.v1-8.R-2-0002",
  "Verra.AFOLU.VM0007.v1-8.R-2-0003",
  "Verra.AFOLU.VM0007.v1-8.R-2-0004",
  "Verra.AFOLU.VM0007.v1-8.R-2-0005",
  "Verra.AFOLU.VM0007.v1-8.R-2-0006",
  "Verra.AFOLU.VM0007.v1-8.R-2-0007",
  "Verra.AFOLU.VM0007.v1-8.R-2-0013",
  "Verra.AFOLU.VM0007.v1-8.R-2-0014",
  "Verra.AFOLU.VM0007.v1-8.R-4-0001",
]);

const batches = [
  { batch: 1, packetDir: "rc5-2-maya-adjudication", truthPath: path.join(rc5Root, "maya-adjudication-response.json") },
  { batch: 2, packetDir: "rc5-2-maya-batch-2-adjudication", truthPath: path.join(rc5Root, "rc5-2-maya-batch-2-adjudication/reviewed-truth.json") },
  { batch: 3, packetDir: "rc5-2-maya-batch-3-adjudication", truthPath: path.join(rc5Root, "rc5-2-maya-batch-3-adjudication/reviewed-truth.json") },
  { batch: 4, packetDir: "rc5-2-maya-batch-4-adjudication", truthPath: path.join(rc5Root, "rc5-2-maya-batch-4-adjudication/reviewed-truth.json") },
  { batch: 5, packetDir: "rc5-2-maya-batch-5-adjudication", truthPath: path.join(rc5Root, "rc5-2-maya-batch-5-adjudication/reviewed-truth.json") },
];

const read = (filePath: string): JsonRecord => JSON.parse(fs.readFileSync(filePath, "utf8")) as JsonRecord;
const sha256 = (value: Buffer): string => crypto.createHash("sha256").update(value).digest("hex");
const writeJson = (filePath: string, value: unknown): void => {
  const serialized = JSON.stringify(value, null, 2).replace(/[\u0080-\uFFFF]/g, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`);
  fs.writeFileSync(filePath, `${serialized}\n`);
};
const evidenceFromContext = (context: JsonRecord) => ({
  quote: context.exactQuote,
  page: context.pageNumber,
  sectionHeading: context.sectionHeading,
  spanId: context.sourceSpanId,
  documentId: context.documentIdentity.documentId,
  documentSha256: context.documentIdentity.contentSha256,
});
const evidenceKey = (evidence: JsonRecord): string => JSON.stringify({
  quote: evidence.quote,
  page: evidence.page,
  sectionHeading: evidence.sectionHeading,
  spanId: evidence.spanId,
  documentId: evidence.documentId,
  documentSha256: evidence.documentSha256,
});

export function loadAuthorizedBlockerResolutionContexts(packetFilePath = path.join(root, authorizedBlockerResolutionPacketPath)): JsonRecord[] {
  if (sha256(fs.readFileSync(packetFilePath)) !== authorizedBlockerResolutionPacketSha256) throw new Error("Authorized blocker-resolution packet SHA changed");
  const packet = read(packetFilePath);
  return (packet.rules as JsonRecord[])
    .filter((rule) => authorizedBlockerResolutionRuleIds.has(rule.ruleId))
    .flatMap((rule) => (rule.projectEvidence as JsonRecord[]).map((evidence, index) => ({
      contextId: `blocker-resolution-${rule.ruleId}-project-${index}`,
      exactQuote: evidence.quote,
      pageNumber: evidence.page,
      sectionHeading: evidence.section,
      sourceSpanId: evidence.spanId,
      documentIdentity: { documentId: evidence.documentId, contentSha256: evidence.documentSha256 },
    })));
}

export function loadAuthorizedTargetedContexts(packetFilePath = path.join(root, authorizedTargetedPacketPath)): JsonRecord[] {
  if (sha256(fs.readFileSync(packetFilePath)) !== authorizedTargetedPacketSha256) throw new Error("Authorized targeted packet SHA changed");
  const packet = read(packetFilePath);
  return (packet.rules as JsonRecord[])
    .filter((rule) => authorizedTargetedRuleIds.has(rule.stableRuleId))
    .flatMap((rule) => (rule.candidateEvidence as JsonRecord[]).map((evidence, index) => ({
      contextId: `targeted-full-pdd-${rule.stableRuleId}-candidate-${index}`,
      exactQuote: evidence.quote,
      pageNumber: evidence.page,
      sectionHeading: evidence.heading,
      sourceSpanId: evidence.spanId,
      documentIdentity: { documentId: evidence.documentId, contentSha256: evidence.documentSha256 },
    })));
}

export type AuditInvariantFailureCode =
  | "UNMATCHED_FROZEN_EVIDENCE"
  | "DUPLICATE_EVIDENCE"
  | "UNSUPPORTED_NOT_APPLICABLE"
  | "RESOLVED_ROW_CLIENT_ACTION"
  | "STALE_CORRECTION_REASON"
  | "RESOLVED_JUDGMENT_WITHOUT_EVIDENCE";

export type AuditInvariantFailure = {
  code: AuditInvariantFailureCode;
  stableRuleId: string;
  field?: "acceptedEvidence" | "rejectedEvidence";
  index?: number;
  evidence?: JsonRecord;
};

export type AuditInvariantResult = {
  provenanceResult: "PASS" | "FAIL";
  unmatchedEvidence: JsonRecord[];
  acceptedRejectedDuplicateEvidence: string[];
  notApplicableEvidenceResult: "PASS" | "FAIL";
  resolvedClientActionResult: "PASS" | "FAIL";
  correctionReasonResult: "PASS" | "FAIL";
  resolvedJudgmentEvidenceResult: "PASS" | "FAIL";
  semanticIntegrityResult: "PASS" | "FAIL";
  evidenceEntries: JsonRecord[];
  ambiguousContextMatches: JsonRecord[];
  failures: AuditInvariantFailure[];
};

export function validateAuditDecisionInvariants(
  decision: JsonRecord,
  contexts: JsonRecord[],
): AuditInvariantResult {
  const contextPool = new Map<string, JsonRecord[]>();
  for (const context of contexts) {
    const key = evidenceKey(evidenceFromContext(context));
    contextPool.set(key, [...(contextPool.get(key) ?? []), context]);
  }

  const evidenceEntries: JsonRecord[] = [];
  const unmatchedEvidence: JsonRecord[] = [];
  const ambiguousContextMatches: JsonRecord[] = [];
  const failures: AuditInvariantFailure[] = [];
  for (const field of ["acceptedEvidence", "rejectedEvidence"] as const) {
    for (const [index, evidence] of (decision[field] ?? []).entries()) {
      const candidates = contextPool.get(evidenceKey(evidence)) ?? [];
      const identicalFrozenContent = candidates.every((context) => evidenceKey(evidenceFromContext(context)) === evidenceKey(evidence));
      evidenceEntries.push({ field, index, result: candidates.length > 0 ? "MATCH" : "UNMATCHED", candidateContextIds: candidates.map((context) => context.contextId) });
      if (candidates.length === 0) {
        unmatchedEvidence.push({ field, index, evidence });
        failures.push({ code: "UNMATCHED_FROZEN_EVIDENCE", stableRuleId: decision.stableRuleId, field, index, evidence });
      }
      if (candidates.length > 1) {
        ambiguousContextMatches.push({ field, index, candidateContextIds: candidates.map((context) => context.contextId), completeFrozenEvidenceIdentical: identicalFrozenContent, resolved: identicalFrozenContent ? "identical-content" : "UNRESOLVED" });
      }
    }
  }

  const acceptedKeys = new Set((decision.acceptedEvidence ?? []).map((evidence: JsonRecord) => evidenceKey(evidence)));
  const rejectedKeys = new Set((decision.rejectedEvidence ?? []).map((evidence: JsonRecord) => evidenceKey(evidence)));
  const acceptedRejectedDuplicateEvidence = [...acceptedKeys].filter((key) => rejectedKeys.has(key));
  if (acceptedRejectedDuplicateEvidence.length > 0) {
    failures.push({ code: "DUPLICATE_EVIDENCE", stableRuleId: decision.stableRuleId });
  }

  const notApplicableEvidenceResult = decision.finalApplicability === "NOT_APPLICABLE" && (decision.acceptedEvidence?.length ?? 0) === 0 ? "FAIL" : "PASS";
  if (notApplicableEvidenceResult === "FAIL") failures.push({ code: "UNSUPPORTED_NOT_APPLICABLE", stableRuleId: decision.stableRuleId });
  const resolvedNotApplicable = decision.finalApplicability === "NOT_APPLICABLE" && decision.reviewerOutcome === "NOT_APPLICABLE";
  const resolvedConforms = decision.finalEvidenceState === "FOUND" && decision.reviewerOutcome === "CONFORMS";
  const resolvedClientActionResult = (resolvedNotApplicable || resolvedConforms) && (decision.clientAction ?? "") !== "" ? "FAIL" : "PASS";
  if (resolvedClientActionResult === "FAIL") failures.push({ code: "RESOLVED_ROW_CLIENT_ACTION", stableRuleId: decision.stableRuleId });
  const staleAcceptanceClaim = /\b(?:should|ought to|needs? to)\b[^.\n]{0,80}\baccepted\b/i.test(decision.correctionReason ?? "")
    || /\bshould have been accepted\b/i.test(decision.correctionReason ?? "");
  const correctionReasonResult = staleAcceptanceClaim
    && (decision.acceptedEvidence?.length ?? 0) > 0
    && (decision.rejectedEvidence?.length ?? 0) === 0 ? "FAIL" : "PASS";
  if (correctionReasonResult === "FAIL") failures.push({ code: "STALE_CORRECTION_REASON", stableRuleId: decision.stableRuleId });
  const resolvedJudgmentEvidenceResult = ((decision.finalEvidenceState === "FOUND" || decision.reviewerOutcome === "CONFORMS" || resolvedNotApplicable)
    && (decision.acceptedEvidence?.length ?? 0) === 0) ? "FAIL" : "PASS";
  if (resolvedJudgmentEvidenceResult === "FAIL") failures.push({ code: "RESOLVED_JUDGMENT_WITHOUT_EVIDENCE", stableRuleId: decision.stableRuleId });
  return {
    provenanceResult: unmatchedEvidence.length === 0 ? "PASS" : "FAIL",
    unmatchedEvidence,
    acceptedRejectedDuplicateEvidence,
    notApplicableEvidenceResult,
    resolvedClientActionResult,
    correctionReasonResult,
    resolvedJudgmentEvidenceResult,
    semanticIntegrityResult: acceptedRejectedDuplicateEvidence.length === 0 && notApplicableEvidenceResult === "PASS" && resolvedClientActionResult === "PASS" && correctionReasonResult === "PASS" && resolvedJudgmentEvidenceResult === "PASS" ? "PASS" : "FAIL",
    evidenceEntries,
    ambiguousContextMatches,
    failures,
  };
}

function machineRowHash(rule: JsonRecord): string | undefined {
  return rule.frozenMachineRowHash ?? rule.machineProposal?.rowSha256;
}

function requirementFor(rule: JsonRecord): JsonRecord {
  return rule.methodologyRequirement ?? { requirementText: rule.requirementText };
}

function buildAudit() {
  const selectionManifest = read(selectionManifestPath);
  const frozenProposalSha256 = sha256(fs.readFileSync(frozenProposalPath));
  const results: JsonRecord[] = [];
  const allRuleIds: string[] = [];
  const batchSummaries: JsonRecord[] = [];
  const semanticDecisions: JsonRecord[] = [];
  const fixedProvenanceEntries: JsonRecord[] = [];

  for (const config of batches) {
    const packetDir = path.join(rc5Root, config.packetDir);
    const packet = read(path.join(packetDir, "review-packet.json"));
    const truth = read(config.truthPath);
    const schema = read(path.join(packetDir, "review-response-schema.json"));
    const manifest = read(path.join(packetDir, "manifest.json"));
    const validator = new Ajv2020({ strict: false }).compile(schema);
    const schemaValid = Boolean(validator(truth));
    const packetRules = new Map<string, JsonRecord>(packet.rules.map((rule: JsonRecord) => [rule.stableRuleId, rule]));
    const contextPool = new Map<string, JsonRecord[]>();
    const allContexts = Object.values(packet.contexts) as JsonRecord[];
    for (const context of allContexts) {
      const normalized = evidenceFromContext(context);
      const candidates = contextPool.get(evidenceKey(normalized)) ?? [];
      candidates.push(context);
      contextPool.set(evidenceKey(normalized), candidates);
    }

    const batchRuleIds: string[] = [];
    let evidenceCount = 0;
    let unmatchedCount = 0;
    let duplicateContextEntryCount = 0;
    const packetSourceDocument = packet.sourceDocument?.contentSha256;
    const truthSourceDocument = truth.sourceDocument?.contentSha256;
    const expectedFrozenProposalSha256 = manifest.frozenProposalSha256 ?? packet.frozenMachineProposal?.sha256;
    const batchHashResults = {
      sourceDocumentSha256: packetSourceDocument === truthSourceDocument,
      frozenProposalSha256: truth.machineProposalRef?.sha256 === expectedFrozenProposalSha256 && truth.machineProposalRef?.sha256 === frozenProposalSha256,
      frozenPacketSha256: manifest.generatedPacketSha256 === sha256(fs.readFileSync(path.join(packetDir, "review-packet.json"))),
      machineRows: true,
    };

    for (const decision of truth.decisions) {
      const rule = packetRules.get(decision.stableRuleId);
      const packetEvidenceContexts = rule
        ? ([...(rule.acceptedEvidence ?? []), ...(rule.rejectedEvidence ?? [])] as JsonRecord[]).map((evidence, index) => ({
          contextId: `${config.packetDir}-${decision.stableRuleId}-packet-evidence-${index}`,
          exactQuote: evidence.quote,
          pageNumber: evidence.page,
          sectionHeading: evidence.section ?? evidence.provenance.sectionHeading,
          sourceSpanId: evidence.spanId,
          documentIdentity: { documentId: evidence.provenance.documentId ?? evidence.provenance.docId, contentSha256: evidence.provenance.documentSha256 ?? packet.sourceDocument.contentSha256 },
        }))
        : [];
      const decisionContexts = [
        ...allContexts,
        ...packetEvidenceContexts,
        ...(config.batch === 3 && authorizedBlockerResolutionRuleIds.has(decision.stableRuleId)
          ? loadAuthorizedBlockerResolutionContexts().filter((context) => context.contextId.includes(decision.stableRuleId))
          : []),
        ...(authorizedTargetedRuleIds.has(decision.stableRuleId)
          ? loadAuthorizedTargetedContexts().filter((context) => context.contextId.includes(decision.stableRuleId))
          : []),
      ];
      const machineHash = rule ? machineRowHash(rule) : undefined;
      const evidenceEntries: JsonRecord[] = [];
      const unmatchedEvidence: JsonRecord[] = [];
      const ambiguousContextMatches: JsonRecord[] = [];
      const decisionContextPool = new Map<string, JsonRecord[]>();
      for (const context of decisionContexts) {
        const key = evidenceKey(evidenceFromContext(context));
        decisionContextPool.set(key, [...(decisionContextPool.get(key) ?? []), context]);
      }
      for (const field of ["acceptedEvidence", "rejectedEvidence"] as const) {
        for (const [index, evidence] of (decision[field] ?? []).entries()) {
          evidenceCount += 1;
          let currentEvidence = evidence;
          let candidates = decisionContextPool.get(evidenceKey(currentEvidence)) ?? [];
          const identityCandidates = decisionContexts.filter((context) => {
            const sameDocument = context.documentIdentity.documentId === currentEvidence.documentId
              && context.documentIdentity.contentSha256 === currentEvidence.documentSha256;
            const stableIdentityMatch = context.sourceSpanId === currentEvidence.spanId && context.sectionHeading === currentEvidence.sectionHeading;
            const exactQuoteContained = currentEvidence.quote.length > 20 && context.exactQuote.includes(currentEvidence.quote);
            return sameDocument && (stableIdentityMatch || exactQuoteContained);
          });
          const identityContentKeys = new Set(identityCandidates.map((context) => evidenceKey(evidenceFromContext(context))));
          if (candidates.length === 0 && fixProvenance && identityContentKeys.size === 1 && identityCandidates.length > 0) {
            currentEvidence = evidenceFromContext(identityCandidates[0]);
            decision[field][index] = currentEvidence;
            candidates = decisionContextPool.get(evidenceKey(currentEvidence)) ?? [];
            fixedProvenanceEntries.push({ batch: config.batch, stableRuleId: decision.stableRuleId, field, index, contextIds: identityCandidates.map((context) => context.contextId) });
          }
          const candidateIds = candidates.map((context) => context.contextId);
          const identicalFrozenContent = candidates.every((context) => evidenceKey(evidenceFromContext(context)) === evidenceKey(currentEvidence));
          evidenceEntries.push({ field, index, result: candidates.length > 0 ? "MATCH" : "UNMATCHED", candidateContextIds: candidateIds, normalizationCandidateContextIds: identityCandidates.map((context) => context.contextId) });
          if (candidates.length === 0) {
            unmatchedCount += 1;
            unmatchedEvidence.push({ field, index, evidence: currentEvidence, normalizationCandidateContextIds: identityCandidates.map((context) => context.contextId), normalizationCandidateContentCount: identityContentKeys.size });
          }
          if (candidates.length > 1) {
            duplicateContextEntryCount += 1;
            ambiguousContextMatches.push({ field, index, candidateContextIds: candidateIds, completeFrozenEvidenceIdentical: identicalFrozenContent, resolved: identicalFrozenContent ? "identical-content" : "UNRESOLVED" });
          }
        }
      }
      const machineRowHashResult = Boolean(rule && decision.machineRowSha256 === machineHash);
      batchHashResults.machineRows = batchHashResults.machineRows && machineRowHashResult;
      const invariantResult = validateAuditDecisionInvariants(decision, decisionContexts);
      const result = {
        batch: config.batch,
        stableRuleId: decision.stableRuleId,
        acceptedEvidenceCount: decision.acceptedEvidence?.length ?? 0,
        rejectedEvidenceCount: decision.rejectedEvidence?.length ?? 0,
        provenanceResult: invariantResult.provenanceResult,
        evidenceEntries,
        unmatchedEvidence,
        ambiguousContextMatches,
        acceptedRejectedDuplicateEvidence: invariantResult.acceptedRejectedDuplicateEvidence,
        notApplicableEvidenceResult: invariantResult.notApplicableEvidenceResult,
        resolvedClientActionResult: invariantResult.resolvedClientActionResult,
        correctionReasonResult: invariantResult.correctionReasonResult,
        resolvedJudgmentEvidenceResult: invariantResult.resolvedJudgmentEvidenceResult,
        semanticIntegrityResult: invariantResult.semanticIntegrityResult,
        machineRowHashResult: machineRowHashResult ? "PASS" : "FAIL",
        schemaResult: schemaValid ? "PASS" : "FAIL",
      };
      results.push(result);
      batchRuleIds.push(decision.stableRuleId);
      allRuleIds.push(decision.stableRuleId);

      const requirement = requirementFor(rule ?? {});
      semanticDecisions.push({
        batch: config.batch,
        stableRuleId: decision.stableRuleId,
        ruleRequirement: requirement,
        applicabilityRequirement: {
          proposedApplicability: rule?.proposedApplicability ?? rule?.machineProposal?.applicability,
          conditions: rule?.methodologyRequirement?.conditions ?? null,
        },
        acceptedEvidence: decision.acceptedEvidence ?? [],
        rejectedEvidence: decision.rejectedEvidence ?? [],
        assessmentReason: decision.assessmentReason,
        correctionReason: decision.correctionReason,
        finalEvidenceState: decision.finalEvidenceState,
        finalApplicability: decision.finalApplicability,
        reviewerOutcome: decision.reviewerOutcome,
        gap: decision.gap,
        clientAction: decision.clientAction,
        reviewStatus: decision.reviewStatus,
        provisionalReason: decision.provisionalReason,
      });
    }

    if (fixProvenance && fixedProvenanceEntries.some((entry) => entry.batch === config.batch)) {
      writeJson(config.truthPath, truth);
    }
    const expectedRuleIds = selectionManifest.batches[String(config.batch)]?.expectedRuleIds ?? [];
    const selectedIdsResult = JSON.stringify(batchRuleIds) === JSON.stringify(expectedRuleIds) ? "PASS" : "FAIL";
    batchSummaries.push({
      batch: config.batch,
      reviewedRuleCount: batchRuleIds.length,
      expectedRuleCount: expectedRuleIds.length,
      selectedIdsResult,
      evidenceEntries: evidenceCount,
      duplicateContextEntryCount,
      unresolvedAmbiguityCount: results.filter((result) => result.batch === config.batch).flatMap((result) => result.ambiguousContextMatches).filter((match: JsonRecord) => match.resolved === "UNRESOLVED").length,
      schemaResult: schemaValid ? "PASS" : "FAIL",
      hashResults: batchHashResults,
    });
  }

  const priorRuleIds = allRuleIds.slice(0, 40);
  const uniqueRuleIds = new Set(allRuleIds);
  const duplicateSelections = allRuleIds.filter((id, index) => allRuleIds.indexOf(id) !== index);
  const report = {
    schemaVersion: "rc5-maya-retrospective-audit-v1",
    generatedAt: "2026-07-18T00:00:00.000Z",
    scope: { batches: [1, 2, 3, 4, 5], ruleCount: allRuleIds.length, evidenceEntryCount: results.reduce((count, result) => count + result.acceptedEvidenceCount + result.rejectedEvidenceCount, 0) },
    mechanicalResult: results.every((result) => result.provenanceResult === "PASS" && result.machineRowHashResult === "PASS" && result.schemaResult === "PASS" && result.semanticIntegrityResult === "PASS") && batchSummaries.every((summary) => summary.selectedIdsResult === "PASS" && summary.schemaResult === "PASS" && summary.unresolvedAmbiguityCount === 0 && Object.values(summary.hashResults).every(Boolean)) && uniqueRuleIds.size === 50 && duplicateSelections.length === 0,
    provenanceNormalizationMode: fixProvenance ? "fixed-unambiguous-contexts" : "audit-only",
    fixedProvenanceEntries,
    reviewedUnion: { uniqueRuleCount: uniqueRuleIds.size, expectedRuleCount: 50, duplicateSelections },
    machineTruthSeparation: { frozenProposalPath: "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json", reviewedTruthPaths: batches.map((config) => path.relative(root, config.truthPath)), separate: true },
    authorizedFrozenEvidenceSources: [
      { path: authorizedBlockerResolutionPacketPath, sha256: authorizedBlockerResolutionPacketSha256, ruleIds: [...authorizedBlockerResolutionRuleIds].sort() },
      { path: authorizedTargetedPacketPath, sha256: authorizedTargetedPacketSha256, ruleIds: [...authorizedTargetedRuleIds].sort() },
    ],
    batchSummaries,
    rules: results,
    unresolvedAmbiguities: results.flatMap((result) => [
      ...result.ambiguousContextMatches.filter((match: JsonRecord) => match.resolved === "UNRESOLVED").map((match: JsonRecord) => ({ batch: result.batch, stableRuleId: result.stableRuleId, ...match })),
      ...result.unmatchedEvidence.map((entry: JsonRecord) => ({ batch: result.batch, stableRuleId: result.stableRuleId, reason: "NO_EXACT_FROZEN_CONTEXT", ...entry })),
    ]),
  };
  const semanticPacket = {
    schemaVersion: "rc5-maya-deepseek-semantic-review-packet-v1",
    purpose: "Independent semantic review of RC5 Maya reviewed truth after mechanical retrospective audit. Do not infer or fill judgments.",
    mechanicalAuditResult: report.mechanicalResult,
    decisions: semanticDecisions,
  };
  fs.mkdirSync(outputDir, { recursive: true });
  writeJson(path.join(outputDir, "retrospective-audit-report.json"), report);
  writeJson(path.join(outputDir, "deepseek-semantic-review-packet.json"), semanticPacket);
  if (!report.mechanicalResult) process.exitCode = 1;
}

if (require.main === module) buildAudit();
