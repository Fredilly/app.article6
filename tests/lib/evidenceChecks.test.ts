import fs from "fs";
import path from "path";
import { describe, expect, it } from "@jest/globals";
import {
  formatEvidenceCheckUiText,
  getAllChecks,
  getContract,
  validateCheck,
} from "@/lib/quickCheck/evidenceChecks";
import { buildReviewQuestionResult, getStructuredQueryContext } from "@/lib/chat/quickCheckReviewQuestion";
import type { EvidenceCheckId } from "@/lib/quickCheck/evidenceChecks";
import { initPymupdfAdapterRuntime } from "@/lib/documentParsing/adapters/pymupdfInit";
import { pymupdfAdapter } from "@/lib/documentParsing/adapters/pymupdfAdapter";
import { checkPymupdfAvailability } from "@/lib/documentParsing/adapters/pymupdfHelper";
import { buildDocumentStructure } from "@/lib/documentModel";
import { compileEvidenceDocumentFromStructure } from "@/lib/quickCheck/evidence/compileEvidenceDocument";
import { buildProjectFactContract } from "@/lib/quickCheck/projectFacts";
import { buildSectionTableIndex } from "@/lib/quickCheck/indexing";

const FIXTURE_DIR = path.join(process.cwd(), "tests/fixtures/quick-check");
const PLUM_A_DOC_TEXT = fs.readFileSync(path.join(FIXTURE_DIR, "a-pdf-extracted.txt"), "utf-8");
const PD_REDD_DOC_TEXT = fs.readFileSync(path.join(FIXTURE_DIR, "pd-redd-v130-extracted.txt"), "utf-8");
const RIMBA_RAYA_DOC_TEXT = fs.readFileSync(path.join(FIXTURE_DIR, "rimba-raya-fallback.txt"), "utf-8");

function runCheck(input: {
  checkId: EvidenceCheckId;
  claimText: string;
  rawText: string;
  methodologyId?: string;
  methodologyVersion?: string;
}) {
  const structuredQueryContext = getStructuredQueryContext(input.rawText);
  const questionResult = buildReviewQuestionResult({
    claimText: input.claimText,
    methodologyId: input.methodologyId ?? "",
    methodologyVersion: input.methodologyVersion ?? "",
    rawPddText: input.rawText,
    structuredQueryContext,
  });

  const validated = validateCheck(getContract(input.checkId), {
    evidenceDocument: structuredQueryContext.evidenceDocument,
    projectFactContract: structuredQueryContext.projectFactContract,
    sectionTableIndex: structuredQueryContext.sectionTableIndex,
    routerResult: questionResult.routerResult,
    queryIntentAnalysis: questionResult.queryIntentAnalysis,
    rawText: input.rawText,
  });

  return formatEvidenceCheckUiText({
    label: getAllChecks().find((check) => check.id === input.checkId)?.label ?? input.checkId,
    status: validated.status,
    answerText: validated.answerText,
    downgradeReason: validated.downgradeReason,
  });
}

describe("getAllChecks", () => {
  it("only exposes the six supported quick check topics", () => {
    expect(getAllChecks().map((check) => check.id)).toEqual([
      "host_country",
      "methodology",
      "baseline_scenario",
      "additionality",
      "leakage",
      "stakeholder_consultation",
    ]);
  });
});

describe("formatEvidenceCheckUiText", () => {
  it("uses a human-readable missing message", () => {
    expect(
      formatEvidenceCheckUiText({
        label: "Crediting period",
        status: "missing",
        answerText: "",
        downgradeReason: "",
      }),
    ).toEqual({
      answerText: "Quick Check did not find a clear crediting period in the uploaded document.",
      downgradeReason: "",
    });
  });

  it("humanizes unclear validation reasons", () => {
    expect(
      formatEvidenceCheckUiText({
        label: "Host country",
        status: "unclear",
        answerText: "VCS Standard Version 4.0",
        downgradeReason: "Contains standard/methodology text, not a country name",
      }),
    ).toEqual({
      answerText: "VCS Standard Version 4.0",
      downgradeReason: "Quick Check found a possible mention, but it did not read like a specific country value.",
    });
  });

  it("keeps found answers unchanged", () => {
    expect(
      formatEvidenceCheckUiText({
        label: "Methodology",
        status: "found",
        answerText: "VM0007 v1.3",
        downgradeReason: "",
      }),
    ).toEqual({
      answerText: "VM0007 v1.3",
      downgradeReason: "",
    });
  });

  it("parses methodology into a clean value", () => {
    expect(
      formatEvidenceCheckUiText({
        label: "Methodology",
        status: "found",
        answerText: "Title and reference of methodology applied: VM0007 REDD+ Methodology Framework version 1.6.",
        downgradeReason: "",
      }),
    ).toEqual({
      answerText: "VM0007 REDD+ Methodology Framework v1.6",
      downgradeReason: "",
    });
  });

  it("parses host country into a clean value", () => {
    expect(
      formatEvidenceCheckUiText({
        label: "Host country",
        status: "found",
        answerText: "Country/Area: Indonesia Project proponent: PT Rimba Makmur Utama",
        downgradeReason: "",
      }),
    ).toEqual({
      answerText: "Indonesia",
      downgradeReason: "",
    });
  });

  it("removes baseline heading echoes and keeps the first substantive sentence", () => {
    expect(
      formatEvidenceCheckUiText({
        label: "Baseline scenario",
        status: "found",
        answerText: "2.4 Baseline Scenario The baseline scenario is continued cattle grazing on degraded grassland. Additional baseline details follow.",
        downgradeReason: "",
      }),
    ).toEqual({
      answerText: "The baseline scenario is continued cattle grazing on degraded grassland.",
      downgradeReason: "",
    });
  });

  it("removes additionality heading echoes and keeps the first substantive sentence", () => {
    expect(
      formatEvidenceCheckUiText({
        label: "Additionality",
        status: "found",
        answerText: "2.5 Additionality Additionality is demonstrated through barrier analysis and limited access to finance. More text follows.",
        downgradeReason: "",
      }),
    ).toEqual({
      answerText: "Additionality is demonstrated through barrier analysis and limited access to finance.",
      downgradeReason: "",
    });
  });

  it("removes leakage heading echoes and keeps the first substantive sentence", () => {
    expect(
      formatEvidenceCheckUiText({
        label: "Leakage",
        status: "found",
        answerText: "1.10 Leakage Leakage from activity shifting is assessed and mitigated in this section. More text follows.",
        downgradeReason: "",
      }),
    ).toEqual({
      answerText: "Leakage from activity shifting is assessed and mitigated in this section.",
      downgradeReason: "",
    });
  });

  it("removes stakeholder heading echoes and keeps the first substantive sentence", () => {
    expect(
      formatEvidenceCheckUiText({
        label: "Stakeholder consultation",
        status: "found",
        answerText: "6 Stakeholder consultation and participation Stakeholder consultation and participation were conducted through community meetings and workshops. Additional details follow.",
        downgradeReason: "",
      }),
    ).toEqual({
      answerText: "Stakeholder consultation and participation were conducted through community meetings and workshops.",
      downgradeReason: "",
    });
  });
});

describe("authoritative evidence check selectors", () => {
  it("prefers primary methodology evidence from the document", () => {
    const result = runCheck({
      checkId: "methodology",
      claimText: "What methodology was applied?",
      rawText: RIMBA_RAYA_DOC_TEXT,
    });

    expect(result.answerText).toContain("VM0004");
    expect(result.answerText).not.toMatch(/^Project Description/i);
  });

  it("prefers the baseline section body instead of a heading-only match", () => {
    const result = runCheck({
      checkId: "baseline_scenario",
      claimText: "What is the baseline scenario?",
      rawText: PD_REDD_DOC_TEXT,
    });

    expect(result.answerText).not.toMatch(/^2\.4 Baseline Scenario/i);
    expect(result.answerText.toLowerCase()).toContain("traditional agricultural practices");
  });

  it("prefers the additionality section body instead of TOC or methodology references", () => {
    const result = runCheck({
      checkId: "additionality",
      claimText: "What does the document say about additionality?",
      rawText: PD_REDD_DOC_TEXT,
    });

    expect(result.answerText).not.toMatch(/^2\.5 Additionality/i);
    expect(result.answerText.toLowerCase()).toContain("as per vt0001");
  });

  it("prefers the main leakage section body over appendix and monitoring references", () => {
    const result = runCheck({
      checkId: "leakage",
      claimText: "What does the document say about leakage?",
      rawText: PD_REDD_DOC_TEXT,
    });

    expect(result.answerText).toContain("Leakage emissions accounted for are entirely from displacement of unplanned deforestation");
    expect(result.answerText).not.toContain("Appendix I");
  });

  it("prefers substantive stakeholder consultation text over the section heading", () => {
    const result = runCheck({
      checkId: "stakeholder_consultation",
      claimText: "What does the document say about stakeholder consultation?",
      rawText: PD_REDD_DOC_TEXT,
    });

    expect(result.answerText.toLowerCase()).toContain("participatory process");
    expect(result.answerText).not.toMatch(/^6 Stakeholder Comments/i);
  });

  it("uses early structured location-country evidence for PLUM instead of drifting into body noise", () => {
    const result = runCheck({
      checkId: "host_country",
      claimText: "What is the host country?",
      rawText: PLUM_A_DOC_TEXT,
    });

    expect(result.answerText).toBe("Indonesia");
  });

  it("finds methodology from alternate methodology headings in PLUM", () => {
    const result = runCheck({
      checkId: "methodology",
      claimText: "What methodology was applied?",
      rawText: PLUM_A_DOC_TEXT,
    });

    expect(result.answerText).toContain("VM0007");
    expect(result.answerText).toContain("Methodology Framework");
  });

  it("finds baseline scenario from combined baseline/additionality content in PLUM", () => {
    const result = runCheck({
      checkId: "baseline_scenario",
      claimText: "What is the baseline scenario?",
      rawText: PLUM_A_DOC_TEXT,
    });

    expect(result.answerText.toLowerCase()).toContain("oil palm plantation");
    expect(result.answerText).not.toMatch(/^Quick Check did not find/i);
  });

  it("finds additionality evidence from PLUM even when it is embedded in methodology content", () => {
    const result = runCheck({
      checkId: "additionality",
      claimText: "What does the document say about additionality?",
      rawText: PLUM_A_DOC_TEXT,
    });

    expect(result.answerText).toContain("VT0001");
    expect(result.answerText).not.toMatch(/^Quick Check did not find/i);
  });

  it("finds stakeholder consultation evidence from stakeholder engagement or dissemination text in PLUM", () => {
    const result = runCheck({
      checkId: "stakeholder_consultation",
      claimText: "What does the document say about stakeholder consultation?",
      rawText: PLUM_A_DOC_TEXT,
    });

    expect(result.answerText.toLowerCase()).toMatch(/stakeholders|village meetings/);
    expect(result.answerText).not.toMatch(/^Quick Check did not find/i);
  });

  it("baseline_scenario Evidence Checks result is found, concise, and not a giant blob", () => {
    const structuredQueryContext = getStructuredQueryContext(PD_REDD_DOC_TEXT);
    const questionResult = buildReviewQuestionResult({
      claimText: "What is the baseline scenario?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
      rawPddText: PD_REDD_DOC_TEXT,
      structuredQueryContext,
    });

    const validated = validateCheck(getContract("baseline_scenario"), {
      evidenceDocument: structuredQueryContext.evidenceDocument,
      projectFactContract: structuredQueryContext.projectFactContract,
      sectionTableIndex: structuredQueryContext.sectionTableIndex,
      routerResult: questionResult.routerResult,
      queryIntentAnalysis: questionResult.queryIntentAnalysis,
      rawText: PD_REDD_DOC_TEXT,
    });

    expect(validated.status).toBe("found");
    expect(validated.answerText.length).toBeLessThanOrEqual(500);
    expect(validated.downgradeReason).toBe("");
    expect(validated.answerText).not.toMatch(/^Quick Check did not find/i);
  });

  it("methodology check finds VM0007 when it appears after page 3 in a real PyMuPDF-extracted PDD", () => {
    // This test requires PyMuPDF (fitz) to be available. In CI it's not
    // installed, so we skip when unavailable — same as production fallback.
    const pymupdfAvail = checkPymupdfAvailability();
    if (!pymupdfAvail.available) {
      console.warn("Skipping PyMuPDF test:", pymupdfAvail.reason);
      return;
    }

    // This PDF has:
    //   Page 1-3: Project description + misleading parameter text
    //            ("Value applied: 376.3 t CO2-e ha-1" near "methodology" keyword)
    //   Page 4:   VM0007 in "Section 3.1 Application of Methodology"
    //
    // Before the page-3 filter fix, buildMethodologyCandidates would scan
    // pages 1-3 only, find nothing, fall back to raw-text search, and
    // return the parameter text instead of VM0007.
    initPymupdfAdapterRuntime();
    const pdfPath = path.join(FIXTURE_DIR, "deep-methodology-pdd.pdf");
    expect(fs.existsSync(pdfPath)).toBe(true);

    const parsed = pymupdfAdapter.parseText({
      rawText: "",
      pdfFilePath: pdfPath,
    });

    // Verify PyMuPDF found 4 pages
    expect(parsed.pages.length).toBe(4);
    expect(parsed.rawText.length).toBeGreaterThan(1000);

    // Build the QueryContext the same way runCheck does
    const documentStructure = buildDocumentStructure({ parsedDocument: parsed });
    const evidenceDocument = compileEvidenceDocumentFromStructure({
      docId: "deep-methodology-test",
      documentStructure,
    });
    const projectFactContract = buildProjectFactContract(evidenceDocument);
    const sectionTableIndex = buildSectionTableIndex({
      documentStructure,
      evidenceDocument,
    });

    // Build router result for methodology check
    const routerResult = buildReviewQuestionResult({
      claimText: "What methodology was applied?",
      methodologyId: "VM0007",
      methodologyVersion: "1.3",
      rawPddText: parsed.rawText,
      structuredQueryContext: {
        parsedDocument: parsed,
        documentStructure,
        evidenceDocument,
        projectFactContract,
        sectionTableIndex,
        parserAdapterId: "pymupdf",
      },
    });

    const validated = validateCheck(getContract("methodology"), {
      evidenceDocument,
      projectFactContract,
      sectionTableIndex,
      routerResult: routerResult.routerResult,
      queryIntentAnalysis: routerResult.queryIntentAnalysis,
      rawText: parsed.rawText,
    });

    expect(validated.status).toBe("found");
    expect(validated.answerText).toMatch(/VM0007/);
    // Must NOT return the parameter text from pages 1-3
    expect(validated.answerText).not.toMatch(/376\.3/);
    expect(validated.downgradeReason).toBe("");
  });
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Host country rejection tests (strict contract)
// ---------------------------------------------------------------------------

it("rejects profile?countryCode=GW as host country and returns unclear", () => {
  const result = runCheck({
    checkId: "host_country",
    claimText: "What is the host country?",
    rawText: "The host country is profile?countryCode=GW. The project is located in Guinea-Bissau.",
  });

  // The validator rejects the URL-containing text. The full line is returned
  // as unclear, but the downgrade reason shows it was rejected.
  expect(result.downgradeReason).not.toBe("");
});

it("rejects URLs as host country", () => {
  const result = runCheck({
    checkId: "host_country",
    claimText: "What is the host country?",
    rawText: "Project participant: https://registry.verra.org/profile?pid=12345. Host Country: Indonesia",
  });

  expect(result.answerText).not.toContain("https");
  expect(result.answerText).not.toContain("registry");
});

it("rejects VVB/developer references as host country", () => {
  const result = runCheck({
    checkId: "host_country",
    claimText: "What is the host country?",
    rawText: "VVB: TÜV Rheinland. Project developer: EcoProjects Ltd. Host country: Peru.",
  });

  expect(result.answerText).not.toContain("VVB");
  expect(result.answerText).not.toContain("TÜV");
  expect(result.answerText).toContain("Peru");
});

it("returns unclear for junk-only host country text", () => {
  const result = runCheck({
    checkId: "host_country",
    claimText: "What is the host country?",
    rawText: "This validation report covers project PDD v1.5. profile?countryCode=GW is the reference.",
  });

  // Should contain a downgrade reason about not being a specific country value
  expect(result.downgradeReason).not.toBe("");
});

// ---------------------------------------------------------------------------
// Methodology rejection tests (strict contract)
// ---------------------------------------------------------------------------

it("rejects generic methodology prose without an explicit methodology code", () => {
  const result = runCheck({
    checkId: "methodology",
    claimText: "What methodology was applied?",
    rawText: "The methodology provides modules and tools for quantifying emission reductions from reduced deforestation. This section describes the methodology framework applied to the project.",
  });

  // No VM/ACM/AM code means the result should have a downgrade reason
  expect(result.downgradeReason).not.toBe("");
});

it("accepts explicit VM0007 when tied to applied methodology", () => {
  const result = runCheck({
    checkId: "methodology",
    claimText: "What methodology was applied?",
    rawText: "Title and reference of methodology applied: VM0007 Methodology Framework for REDD+ Projects v1.0. The project applies VM0007 as the baseline and monitoring methodology.",
  });

  expect(result.answerText).toContain("VM0007");
});

it("rejects methodology code in module/tool boilerplate without being proven as applied", () => {
  const result = runCheck({
    checkId: "methodology",
    claimText: "What methodology was applied?",
    rawText: "The modules and tools section describes the VM0007 components. Module VMD0001 describes the carbon accounting approach.",
  });

  // VM0007 appears in "modules" context — should have a downgrade reason
  expect(result.downgradeReason).not.toBe("");
});

// ---------------------------------------------------------------------------
// Final user-facing status assertion tests (validateCheck directly)
// ---------------------------------------------------------------------------

function runValidateCheck(input: {
  checkId: EvidenceCheckId;
  claimText: string;
  rawText: string;
}) {
  const sqc = getStructuredQueryContext(input.rawText);
  const qr = buildReviewQuestionResult({
    claimText: input.claimText,
    methodologyId: "",
    methodologyVersion: "",
    rawPddText: input.rawText,
    structuredQueryContext: sqc,
  });
  return validateCheck(getContract(input.checkId), {
    evidenceDocument: sqc.evidenceDocument,
    projectFactContract: sqc.projectFactContract,
    sectionTableIndex: sqc.sectionTableIndex,
    routerResult: qr.routerResult,
    queryIntentAnalysis: qr.queryIntentAnalysis,
    rawText: input.rawText,
  });
}

describe("host country final status", () => {
  it("profile?countryCode=GW cannot return FOUND", () => {
    const result = runValidateCheck({
      checkId: "host_country",
      claimText: "What is the host country?",
      rawText: "This validation report covers project PDD v1.5. profile?countryCode=GW is the reference.",
    });
    expect(result.status).not.toBe("found");
    expect(["unclear", "missing"]).toContain(result.status);
  });

  it("junk-only text with no real country returns unclear or missing", () => {
    const result = runValidateCheck({
      checkId: "host_country",
      claimText: "What is the host country?",
      rawText: "profile?countryCode=GW is just the registry profile. VVB: TÜV Rheinland. pid=12345.",
    });
    expect(result.status).not.toBe("found");
    expect(["unclear", "missing"]).toContain(result.status);
  });

  it("real host country found despite nearby registry junk", () => {
    // When both junk and a real country are present, the real country wins
    const result = runValidateCheck({
      checkId: "host_country",
      claimText: "What is the host country?",
      rawText: "Project participant: https://registry.verra.org/profile?pid=12345. Host Country: Indonesia",
    });
    expect(result.status).toBe("found");
    expect(result.answerText).toMatch(/Indonesia/i);
  });

  it("real host country found despite nearby VVB text", () => {
    const result = runValidateCheck({
      checkId: "host_country",
      claimText: "What is the host country?",
      rawText: "VVB: TÜV Rheinland. Project developer: EcoProjects Ltd. Host country: Peru.",
    });
    expect(result.status).toBe("found");
    expect(result.answerText).toMatch(/Peru/i);
  });
});

describe("methodology final status", () => {
  it("generic methodology prose cannot return FOUND", () => {
    const result = runValidateCheck({
      checkId: "methodology",
      claimText: "What methodology was applied?",
      rawText: "The methodology provides modules and tools for quantifying emission reductions from reduced deforestation.",
    });
    expect(result.status).not.toBe("found");
    expect(["unclear", "missing"]).toContain(result.status);
  });

  it("module/tool boilerplate without applied context cannot return FOUND", () => {
    const result = runValidateCheck({
      checkId: "methodology",
      claimText: "What methodology was applied?",
      rawText: "The modules and tools section describes the VM0007 components. Module VMD0001 describes the carbon accounting approach.",
    });
    expect(result.status).not.toBe("found");
    expect(["unclear", "missing"]).toContain(result.status);
  });

  it("explicit applied VM0007 can still return FOUND", () => {
    const result = runValidateCheck({
      checkId: "methodology",
      claimText: "What methodology was applied?",
      rawText: "Title and reference of methodology applied: VM0007 Methodology Framework for REDD+ Projects v1.0. The project applies VM0007 as the baseline and monitoring methodology.",
    });
    expect(result.status).toBe("found");
    expect(result.answerText).toContain("VM0007");
  });

  it("AR-AMS0007 accepted as applied methodology", () => {
    const result = runValidateCheck({
      checkId: "methodology",
      claimText: "What methodology was applied?",
      rawText: "Name and reference of approved methodology applied: AR-AMS0007 Simplified Baseline and Monitoring Methodology for Small-scale CDM A/R Project Activities.",
    });
    expect(result.status).toBe("found");
    expect(result.answerText).toContain("AR-AMS0007");
  });

  it("AR-AMS0003 accepted as applied methodology", () => {
    const result = runValidateCheck({
      checkId: "methodology",
      claimText: "What methodology was applied?",
      rawText: "Name and reference of approved methodology applied: AR-AMS0003 Afforestation and Reforestation of Degraded Land.",
    });
    expect(result.status).toBe("found");
    expect(result.answerText).toContain("AR-AMS0003");
  });

  it("VM0007 accepted when paragraph mentions modules/tools with applied context", () => {
    const result = runValidateCheck({
      checkId: "methodology",
      claimText: "What methodology was applied?",
      rawText: "The project applies VCS Methodology VM0007 together with applicable modules and tools described in Appendix 1.",
    });
    expect(result.status).toBe("found");
    expect(result.answerText).toContain("VM0007");
  });

  it("generic modules/tools boilerplate without applied context still rejected", () => {
    const result = runValidateCheck({
      checkId: "methodology",
      claimText: "What methodology was applied?",
      rawText: "The modules and tools section lists the applicable components. This methodology provides modules and tools for quantifying emission reductions.",
    });
    expect(result.status).not.toBe("found");
    expect(["unclear", "missing"]).toContain(result.status);
  });
});
// ---------------------------------------------------------------------------
// Kariba PDD regression tests
// ---------------------------------------------------------------------------


describe("Kariba PDD regression", () => {
  it("host_country rejects URL path fragment information/zimbabwe/en/", () => {
    const result = runValidateCheck({
      checkId: "host_country",
      claimText: "What is the host country?",
      rawText: "FAO country information Zimbabwe: http://www.fao.org/isfp/country-information/zimbabwe/en/",
    });
    expect(result.status).not.toBe("found");
  });

  it("methodology returns VM0009 from title and reference text", () => {
    const result = runValidateCheck({
      checkId: "methodology",
      claimText: "What methodology was applied?",
      rawText: "APPLICATION OF METHODOLOGY\n2.1 Title and Reference of Methodology\nVM0009 - Methodology for Avoided Mosaic Deforestation of Tropical Forests, v1.1",
    });
    expect(result.status).toBe("found");
    expect(result.answerText).toContain("VM0009");
  });

  it("methodology rejects PROJECT DESCRIPTION: VCS Version header as missing", () => {
    const result = runValidateCheck({
      checkId: "methodology",
      claimText: "What methodology was applied?",
      rawText: "PROJECT DESCRIPTION: VCS Version 3\nv3.1\nProject Title  Kariba REDD+ Project",
    });
    expect(result.status).toBe("missing");
  });
});
