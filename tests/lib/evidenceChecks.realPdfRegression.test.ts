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
  getProjectIdentityChecks,
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
  it("exposes only the deterministic project identity checks", () => {
    expect(getProjectIdentityChecks().map((check) => check.id)).toEqual([
      "project_title",
      "host_country",
      "project_location",
      "methodology",
      "crediting_period",
      "project_activity",
    ]);
  });

  it("resolves the PLUM identity checks from a.pdf", async () => {
    const loaded = await loadPdfContext("a.pdf");

    const projectTitle = validateFromQuestion({
      checkId: "project_title",
      question: "What is the project title?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
      ...loaded,
    });
    const projectActivity = validateFromQuestion({
      checkId: "project_activity",
      question: "What is the project activity?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
      ...loaded,
    });
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
    const methodology = validateFromQuestion({
      checkId: "methodology",
      question: "What is the methodology?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
      ...loaded,
    });
    const creditingPeriod = validateFromQuestion({
      checkId: "crediting_period",
      question: "What is the crediting period?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
      ...loaded,
    });

    expect(projectTitle.status).toBe("found");
    expect(projectTitle.answerText).toContain("PLUM");

    expect(projectActivity.status).toBe("found");
    expect(projectActivity.answerText).toMatch(/peat|mangrove|restoration/i);

    expect(hostCountry.status).toBe("found");
    expect(hostCountry.answerText).toBe("Indonesia");
    expect(hostCountry.quotes[0]).toContain("Project Location Indonesia, Central Kalimantan");

    expect(projectLocation.status).toBe("found");
    expect(projectLocation.answerText).toContain("Indonesia, Central Kalimantan");
    expect(projectLocation.answerText).not.toContain("GL2:");
    expect(projectLocation.quotes[0]).toContain("Project Location Indonesia, Central Kalimantan");

    expect(methodology.status).toBe("found");
    expect(methodology.answerText).toContain("VM0007");

    expect(creditingPeriod.status).toBe("found");
    expect(creditingPeriod.answerText).toContain("01 August 2022");
    expect(creditingPeriod.answerText).toContain("31 July 2082");
  }, 30000);

  it("resolves the Guinea-Bissau identity checks from the real PD_REDD_v1_130 PDF", async () => {
    const loaded = await loadPdfContext("PD_REDD_v1_130.pdf");

    const projectTitle = validateFromQuestion({
      checkId: "project_title",
      question: "What is the project title?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
      ...loaded,
    });
    const projectActivity = validateFromQuestion({
      checkId: "project_activity",
      question: "What is the project activity?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
      ...loaded,
    });
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
    const methodology = validateFromQuestion({
      checkId: "methodology",
      question: "What is the methodology?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
      ...loaded,
    });
    const creditingPeriod = validateFromQuestion({
      checkId: "crediting_period",
      question: "What is the crediting period?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
      ...loaded,
    });

    expect(projectTitle.status).toBe("found");
    expect(projectTitle.answerText).toContain("Guinea-Bissau");

    expect(hostCountry.status).toBe("found");
    expect(hostCountry.answerText).toBe("Guinea-Bissau");
    expect(hostCountry.answerText).not.toContain("Portugal");
    expect(hostCountry.quotes[0]).toContain("Republic of Guinea-Bissau");

    expect(projectLocation.status).toBe("found");
    expect(projectLocation.answerText).toMatch(/Cacheu|Cantanhez|Guinea-Bissau/i);

    expect(methodology.status).toBe("found");
    expect(methodology.answerText).toContain("VM0007");

    expect(creditingPeriod.status).toBe("found");
    expect(creditingPeriod.answerText).toContain("31/March/2011");
    expect(creditingPeriod.answerText).toContain("30/March/2031");

    expect(projectActivity.status).toBe("found");
    expect(projectActivity.answerText).toMatch(/REDD|avoided deforestation|AUDD/i);
    expect(projectActivity.answerText).not.toMatch(/Rhizophora|Chave|DBH|AGB/i);
  }, 30000);
});
