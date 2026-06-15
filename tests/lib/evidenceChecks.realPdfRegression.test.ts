import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "@jest/globals";

import {
  buildReviewQuestionResult,
  getStructuredQueryContext,
  type StructuredQueryContext,
} from "@/lib/chat/quickCheckReviewQuestion";
import { extractPdfTextWithPdfParse } from "@/lib/chat/quickCheckPdfExtractor";
import {
  getContract,
  validateCheck,
  type EvidenceCheckId,
  type EvidenceCheckResult,
} from "@/lib/quickCheck/evidenceChecks";

const FIXTURE_DIR = path.join(process.cwd(), "tests", "fixtures", "quick-check");

type LoadedPdfContext = {
  rawText: string;
  structuredContext: StructuredQueryContext;
};

const pdfCache = new Map<string, Promise<LoadedPdfContext>>();

async function loadPdfContext(filename: string): Promise<LoadedPdfContext> {
  const cached = pdfCache.get(filename);
  if (cached) return cached;

  const promise = (async () => {
    const bytes = await fs.readFile(path.join(FIXTURE_DIR, filename));
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const extracted = await extractPdfTextWithPdfParse({ bytes: arrayBuffer });
    return {
      rawText: extracted.text,
      structuredContext: getStructuredQueryContext(extracted.text),
    };
  })();

  pdfCache.set(filename, promise);
  return promise;
}

function validateFromQuestion(input: {
  checkId: EvidenceCheckId;
  question: string;
  rawText: string;
  structuredContext: StructuredQueryContext;
  methodologyId: string;
  methodologyVersion: string;
}): EvidenceCheckResult {
  const routerResult = buildReviewQuestionResult({
    claimText: input.question,
    methodologyId: input.methodologyId,
    methodologyVersion: input.methodologyVersion,
    rawPddText: input.rawText,
    structuredQueryContext: input.structuredContext,
  }).routerResult;

  return {
    checkId: input.checkId,
    ...validateCheck(getContract(input.checkId), {
      evidenceDocument: input.structuredContext.evidenceDocument,
      projectFactContract: input.structuredContext.projectFactContract,
      sectionTableIndex: input.structuredContext.sectionTableIndex,
      routerResult,
      methodologyId: input.methodologyId,
    }),
  };
}

describe("Evidence Checks real PDF regressions", () => {
  it("uses grounded cover evidence from a.pdf for host country and project location", async () => {
    const loaded = await loadPdfContext("a.pdf");

    expect(loaded.structuredContext.projectFactContract.projectLocation.value).toBe("Indonesia, Central Kalimantan");
    expect(loaded.structuredContext.projectFactContract.projectCountry.value).toBe("Indonesia");

    const hostCountry = validateFromQuestion({
      checkId: "host_country",
      question: "What is the host country?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
      ...loaded,
    });
    const projectLocation = validateFromQuestion({
      checkId: "project_location",
      question: "What is the project location?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
      ...loaded,
    });

    expect(hostCountry.status).toBe("found");
    expect(hostCountry.answerText).toBe("Indonesia");
    expect(hostCountry.quotes[0]).toContain("Project Location Indonesia, Central Kalimantan");

    expect(projectLocation.status).toBe("found");
    expect(projectLocation.answerText).toContain("Indonesia, Central Kalimantan");
    expect(projectLocation.answerText).not.toContain("GL2:");
    expect(projectLocation.quotes[0]).toContain("Project Location Indonesia, Central Kalimantan");
  }, 30000);

  it("keeps related monitoring dissemination text Unclear for stakeholder consultation in a.pdf", async () => {
    const loaded = await loadPdfContext("a.pdf");

    const stakeholder = validateFromQuestion({
      checkId: "stakeholder_consultation",
      question: "What does the document say about stakeholder consultation?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
      ...loaded,
    });

    expect(stakeholder.status).toBe("unclear");
    expect(stakeholder.downgradeReason).toMatch(/monitoring_section/i);
  }, 30000);

  it("still finds methodology evidence from another real PDF fixture", async () => {
    const loaded = await loadPdfContext("plum-verra-demo-excerpt.pdf");

    const methodology = validateFromQuestion({
      checkId: "methodology",
      question: "What is the methodology?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
      ...loaded,
    });

    expect(methodology.status).toBe("found");
    expect(methodology.answerText).toContain("VM0007");
  }, 20000);
});
