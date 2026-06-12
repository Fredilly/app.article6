import { buildReviewQuestionResult, getStructuredQueryContext } from "../src/lib/chat/quickCheckReviewQuestion";
import { buildEvidenceSpanIndex } from "../src/lib/quickCheck/evidence/buildEvidenceSpanIndex";
import { analyzeQueryIntent } from "../src/lib/quickCheck/queryIntent";
import type { ProjectFactContract, ProjectFactField, ProjectFactValue } from "../src/lib/quickCheck/projectFacts/types";
import fs from "fs";

function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error("Usage: npx tsx scripts/diagnose-quick-check-facts.ts <path-to-txt-or-pdf>");
    process.exit(1);
  }

  const rawText = fs.readFileSync(pdfPath, "utf-8");
  const ctx = getStructuredQueryContext(rawText);
  const idx = buildEvidenceSpanIndex({
    evidenceDocument: ctx.evidenceDocument,
    projectFactContract: ctx.projectFactContract,
    sectionTableIndex: ctx.sectionTableIndex,
  });

  console.log("=== DOCUMENT INFO ===");
  console.log("path:", pdfPath);
  console.log("characters:", rawText.length);
  console.log("evidence spans:", ctx.evidenceDocument.spans.length);
  console.log("non-excluded spans:", ctx.evidenceDocument.spans.filter(s => s.reliability !== "excluded").length);
  console.log("document family:", ctx.evidenceDocument.documentFamily || "UNKNOWN");

  console.log("\n=== PROJECT FACT CONTRACT ===");
  const factFields: Array<keyof Omit<ProjectFactContract, "documentFamily" | "documentType" | "warnings">> = [
    "projectTitle", "projectId", "hostCountry", "projectCountry", "projectLocation",
    "projectStandard", "projectType", "projectProponent",
    "methodologyPrimary", "creditingPeriod", "reportingPeriod", "monitoringPeriod",
    "projectStartDate", "baselineSections", "monitoringSections",
    "leakageSections", "additionalitySections",
  ];
  for (const f of factFields) {
    const field = (ctx.projectFactContract as Record<string, ProjectFactField<ProjectFactValue>>)[f];
    const value = field?.value ? (Array.isArray(field.value) ? field.value.join(" | ") : String(field.value)) : null;
    const hasSpans = (field?.evidenceSpanIds?.length ?? 0) > 0;
    const resolved = field?.evidenceSpanIds?.map((sid: string) => {
      const s = ctx.evidenceDocument.spans.find(sp => sp.spanId === sid);
      return s ? "✓" : "MISSING";
    }).join("") ?? "";
    console.log(
      f.padEnd(24),
      "value:", (value || "(null)").slice(0, 45).padEnd(45),
      "spanIds:", field?.evidenceSpanIds?.length ?? 0,
      "resolved:", resolved || "n/a",
    );
  }

  console.log("\n=== QUERY INTENT + ROUTER + VISIBLE ===");
  const questions = [
    "What is the project title?",
    "What is the host country?",
    "What is the project activity?",
    "Who is the project participant?",
    "What is the crediting period?",
    "What is the reporting period?",
    "What is the monitoring period?",
    "What is the project ID?",
  ];
  for (const q of questions) {
    const intent = analyzeQueryIntent({ query: q, sectionTableIndex: ctx.sectionTableIndex });
    const r = buildReviewQuestionResult({
      claimText: q,
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
      rawPddText: rawText,
    });
    const candidates = idx.query({
      claimText: q, reviewArea: r.reviewArea,
      methodologyId: "VM0007", methodologyVersion: "4.2",
      intent: intent.intent,
      targetFacts: intent.targetFacts,
      maxCandidates: 3,
    });
    const ok = r.routerResult.status === "answered" && r.documentAnswer.status === "likely_yes";
    console.log(
      ok ? "✓" : "✗",
      q.padEnd(42),
      "intent:", intent.intent.padEnd(15),
      "facts:", (intent.targetFacts.join(",") || "none").padEnd(25),
      "router:", r.routerResult.status.padEnd(10),
      "visible:", r.documentAnswer.status.padEnd(12),
      "quotes:", r.routerResult.quotes.length,
      "idxCands:", candidates.length,
      "reject:", r.routerResult.warnings.join(",") || "none",
    );
  }
}

main();
