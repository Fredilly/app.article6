import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PDFParse } from "pdf-parse";

export const root = process.cwd();
export const packetDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-vt0001-interpretation-packet");
export const baselineSha = "f0d6f0edbca2562026836801f3230a45274047f3";
export const selectedRuleIds = [
  "Verra.AFOLU.VM0007.v1-8.R-3-0001",
  "Verra.AFOLU.VM0007.v1-8.R-3-0003",
  "Verra.AFOLU.VM0007.v1-8.R-4-0001",
] as const;
export const vt0001Path = "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-vt0001-interpretation-packet/official-source/VT0001-Tool-for-the-Demonstration-and-Assessment-of-Additionality-v3.0.pdf";
export const vt0001PagesPath = "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-vt0001-interpretation-packet/official-source/VT0001-Tool-for-the-Demonstration-and-Assessment-of-Additionality-v3.0.pages.json";
export const vm0007Path = "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-expert-batch-2-blocker-resolution/official-source/VM0007-REDD-Methodology-Framework-v1.8.pdf";
export const vm0007PagesPath = "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-expert-batch-2-blocker-resolution/official-source/VM0007-REDD-Methodology-Framework-v1.8.pages.json";
export const pddPath = "tests/fixtures/quick-check/v2/maya-forest-corridor-redd-belize/source.pdf";
export const extractionPath = "tests/fixtures/preverif/maya-forest-corridor-redd-belize/raw-document-extraction.json";
export const machinePath = "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json";
export const truthPaths = [
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json",
  ...[2, 3, 4, 5, 6].map((n) => `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-${n}-adjudication/reviewed-truth.json`),
];
export const expected = {
  vt0001Sha256: "ee0d8b00b772208b112d4b20b43613a80b8d10404813c3273086d90b3963ddc8",
  vm0007Sha256: "68bb94746c4c4adb40acbe314a3f927e2a3a57af9bf4916afdbcf532ea0b50e6",
  vm0007PagesSha256: "80164150eeb7fa8eb916c73bbcdab0cc0b79d49d544dc9c28cef7c61a8166561",
  pddSha256: "407caaa782e9d9e07b250999539fc809c2c41888b0f20a628a9e49dbeb977a5b",
  extractionSha256: "b9da3f4f836a8a4a0ff64cae96bbd69f186eb087a639f60d95f8f9a0ff1a8ae8",
  machineSha256: "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b",
};
const sha256 = (v: string | Buffer) => crypto.createHash("sha256").update(v).digest("hex");
const read = <T>(p: string): T => JSON.parse(fs.readFileSync(path.join(root, p), "utf8")) as T;
const frozenBytes = (p: string) => execFileSync("git", ["show", `${baselineSha}:${p}`], { cwd: root });
const frozenJson = <T>(p: string): T => JSON.parse(frozenBytes(p).toString("utf8")) as T;
const localBytes = (p: string) => fs.readFileSync(path.join(root, p));
const short = (id: string) => id.split(".").at(-1)!;

const pddPages = [14, 86, 91, 92, 93];
const vtPages = [1, 2, 4, 5, 7, 10, 11, 12, 13];
const vmPagesByRule: Record<string, number[]> = { "R-3-0001": [15, 16, 17], "R-3-0003": [19, 20, 21], "R-4-0001": [23, 24, 25] };
const vtCoverage: Record<number, string> = {
  1: "identity, version, date, sectoral scope, and document history context",
  2: "Section 2 procedure and Step 1/Step 2/Step 3/Step 4 sequence",
  4: "Sub-step 1c: proceed to Step 2 or Step 3; at least one is necessary",
  5: "Section 2.2, Option I eligibility, and direct Step 4 outcome",
  7: "Step 2 outcome, optional Step 3 after failed investment analysis, and Step 3 applicability",
  10: "Step 3 evidence requirements and Step 3b outcome",
  11: "Step 4 common-practice requirements and outcome",
  12: "official Figure 1 indicative flowchart",
  13: "document history confirming Version 3.0 and 1 February 2012",
};

function assertFrozenInputs(): void {
  const actual = Object.fromEntries(Object.entries({ vt0001: vt0001Path, vm0007: vm0007Path, vm0007Pages: vm0007PagesPath, pdd: pddPath, extraction: extractionPath, machine: machinePath }).map(([k, p]) => [k, sha256(localBytes(p))]));
  if (actual.vt0001 !== expected.vt0001Sha256 || actual.vm0007 !== expected.vm0007Sha256 || actual.vm0007Pages !== expected.vm0007PagesSha256 || actual.pdd !== expected.pddSha256 || actual.extraction !== expected.extractionSha256 || actual.machine !== expected.machineSha256) throw new Error(`Frozen source SHA changed: ${JSON.stringify(actual)}`);
}

function inventory(): { total: number; unique: number; reviewed: number; provisional: number; provisionalIds: string[] } {
  const rows = truthPaths.flatMap((p) => frozenJson<{ decisions: Array<{ stableRuleId: string; reviewStatus: string }> }>(p).decisions);
  const byId = new Map(rows.map((r) => [r.stableRuleId, r]));
  const provisionalIds = [...byId.values()].filter((r) => r.reviewStatus === "PROVISIONAL").map((r) => r.stableRuleId).sort();
  if (rows.length !== 58 || byId.size !== 58 || rows.filter((r) => r.reviewStatus === "REVIEWED").length !== 50 || provisionalIds.length !== 8) throw new Error("Expected frozen inventory 50 REVIEWED / 8 PROVISIONAL / 58 unique");
  if (selectedRuleIds.some((id) => !provisionalIds.includes(id)) || provisionalIds.filter((id) => !selectedRuleIds.includes(id)).length !== 5) throw new Error("Selected IDs are not exactly the requested provisional subset");
  return { total: 58, unique: 58, reviewed: 50, provisional: 8, provisionalIds };
}

async function authoritativePages(): Promise<Array<{ page: number; quote: string; coverage: string }>> {
  let pages: Array<{ num: number; text: string }>;
  if (fs.existsSync(path.join(root, vt0001PagesPath))) pages = read<{ pages: Array<{ pageNumber: number; text: string }> }>(vt0001PagesPath).pages.map((p) => ({ num: p.pageNumber, text: p.text }));
  else {
    const parser = new PDFParse({ data: localBytes(vt0001Path) });
    const result = await parser.getText();
    await parser.destroy();
    if (result.total !== 13 || result.pages.length !== 13) throw new Error(`VT0001 page count changed: ${result.total}/${result.pages.length}`);
    pages = result.pages.map((p) => ({ num: p.num, text: p.text }));
    fs.writeFileSync(path.join(root, vt0001PagesPath), `${JSON.stringify({ schemaVersion: "rc5-vt0001-pdf-page-extraction-v1", sourcePdfSha256: expected.vt0001Sha256, pageCount: pages.length, pages: pages.map((p) => ({ pageNumber: p.num, text: p.text })) }, null, 2)}\n`);
  }
  if (pages.length !== 13) throw new Error(`VT0001 page count changed: ${pages.length}`);
  const first = pages[0]?.text ?? "";
  if (!first.includes("VT0001: Version 3.0") || !first.includes("1 February 2012") || !first.includes("Sectoral Scope 14")) throw new Error("VT0001 identity metadata not present in PDF text");
  return pages.filter((p) => vtPages.includes(p.num)).map((p) => ({ page: p.num, quote: p.text, coverage: vtCoverage[p.num] ?? "complete authoritative page retained" }));
}

function sourcePages(p: string, pages: number[]): Array<{ page: number; quote: string; sourcePath: string; sourceSha256: string }> {
  const artifact = read<{ pages: Array<{ pageNumber: number; text: string }> }>(p);
  const sourceSha256 = sha256(localBytes(p === extractionPath ? p : p));
  return pages.map((page) => {
    const found = artifact.pages.find((x) => x.pageNumber === page);
    if (!found) throw new Error(`Missing page ${page} in ${p}`);
    return { page, quote: found.text, sourcePath: p, sourceSha256 };
  });
}

export async function buildArtifacts() {
  assertFrozenInputs();
  const frozenInventory = inventory();
  const rules = read<any[]>("public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.rich.json");
  const vmPages = read<{ pages: Array<{ pageNumber: number; text: string }> }>(vm0007PagesPath);
  const machine = read<{ rows: any[] }>(machinePath);
  const pdd = read<{ pages: Array<{ pageNumber: number; text: string }> }>(extractionPath);
  const vtEvidence = await authoritativePages();
  const rulePackets = selectedRuleIds.map((id) => {
    const rule = rules.find((r) => r.id === id);
    const row = machine.rows.find((r) => r.stableRuleId === id);
    if (!rule || !row) throw new Error(`Missing rule or machine row ${id}`);
    return {
      stableRuleId: id,
      methodologyRequirement: { exactText: rule.source_span_text, sourcePath: "public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.rich.json", sourceSha256: sha256(localBytes("public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.rich.json")), section: rule.section_context },
      frozenMachineRowSha256: sha256(JSON.stringify(row)),
      question: id.endsWith("R-3-0001") ? "Does VM0007's requirement to use VT0001 and follow its stepwise approach require this Maya PDD to document Step 3 after Step 2, or can a valid VT0001 Step 2 Option I pathway stand alone?" : id.endsWith("R-3-0003") ? "Under VT0001 and VM0007, is the PDD's Step 2 Option I analysis sufficient as the selected pathway, or was Step 3 Barrier Analysis also mandatory?" : "Does the Maya PDD finally demonstrate the VT0001 additionality pathway required by VM0007, including a valid Option I selection and the applicable Step 4 conclusion?",
      projectEvidence: pddPages.map((page) => ({ page, quote: pdd.pages.find((x) => x.pageNumber === page)?.text ?? "", sourcePath: pddPath, sourceSha256: expected.extractionSha256, documentId: "quick-check-review-question", documentSha256: expected.pddSha256 })),
      vm0007Evidence: (vmPagesByRule[short(id)] ?? []).map((page) => ({ page, quote: vmPages.pages.find((x) => x.pageNumber === page)?.text ?? "", sourcePath: vm0007PagesPath, sourceSha256: expected.vm0007PagesSha256, sourcePdfPath: vm0007Path, sourcePdfSha256: expected.vm0007Sha256 })),
    };
  });
  const packet = {
    schemaVersion: "rc5-2-maya-vt0001-interpretation-packet-v1",
    reviewPurpose: "Independent, deterministic interpretation and application review. No adjudication or integration is included.",
    independence: { reviewedTruthIncluded: false, machineProposalIncludedAsAnswerKey: false, priorResponsesIncluded: false },
    frozenInventory,
    selectedRuleIds: [...selectedRuleIds],
    interpretationQuestions: ["Is Step 3 mandatory after Step 2?", "Can Step 2 operate as a standalone additionality analysis?", "Does valid Option I completion proceed directly to Step 4?", "What evidence is required to establish that Option I is valid?"],
    authoritativeVT0001: { documentId: "Verra.VT0001.v3-0", title: "Tool for the Demonstration and Assessment of Additionality in VCS Agriculture, Forestry and Other Land Use (AFOLU) Project Activities", version: "3.0", date: "1 February 2012", sectoralScope: "14", pageCount: 13, sourceUrl: "https://verra.org/wp-content/uploads/imported/methodologies/VT0001v3.0.pdf", sourcePath: vt0001Path, sha256: expected.vt0001Sha256, exactPages: vtEvidence },
    vm0007Source: { sourcePath: vm0007Path, pagesPath: vm0007PagesPath, version: "1.8", pdfSha256: expected.vm0007Sha256, pagesSha256: expected.vm0007PagesSha256 },
    mayaPddSource: { sourcePath: pddPath, extractionPath, pddSha256: expected.pddSha256, extractionSha256: expected.extractionSha256, pages: pddPages },
    rules: rulePackets,
    reviewBoundary: { methodologyInterpretation: "The reviewer must reach an evidence-backed interpretation from the complete VT0001 text, including the flowchart.", mayaApplication: "Apply that interpretation independently to each rule. Final outcomes may be FOUND/CONFORMS, UNCLEAR/ACTION_REQUIRED, MISSING/ACTION_REQUIRED, or NOT_APPLICABLE. PROVISIONAL is permitted only for a genuine source ambiguity or unavailable necessary document.", exactlyThreeDecisions: true },
  };
  const decisionProperties = {
    stableRuleId: { enum: [...selectedRuleIds] }, reviewStatus: { enum: ["REVIEWED", "PROVISIONAL"] }, evidenceStatus: { enum: ["FOUND", "UNCLEAR", "MISSING"] }, applicability: { enum: ["APPLICABLE", "NOT_APPLICABLE", "UNKNOWN"] }, action: { enum: ["CONFORMS", "ACTION_REQUIRED", "NONE"] }, methodologyInterpretation: { type: "string", minLength: 100 }, mayaApplication: { type: "string", minLength: 100 }, evidenceCitations: { type: "array", minItems: 1 }, missingEvidence: { type: "array" }, reasoning: { type: "string", minLength: 100 } };
  const responseSchema = { $schema: "https://json-schema.org/draft/2020-12/schema", $id: "rc5-2-maya-vt0001-interpretation-response", type: "object", additionalProperties: false, required: ["schemaVersion", "decisions"], properties: { schemaVersion: { const: "rc5-2-maya-vt0001-interpretation-response-v1" }, decisions: { type: "array", minItems: 3, maxItems: 3, items: { type: "object", additionalProperties: false, required: Object.keys(decisionProperties), properties: decisionProperties } } } };
  const template = { schemaVersion: "rc5-2-maya-vt0001-interpretation-response-v1", decisions: selectedRuleIds.map((stableRuleId) => ({ stableRuleId, reviewStatus: null, evidenceStatus: null, applicability: null, action: null, methodologyInterpretation: null, mayaApplication: null, evidenceCitations: [], missingEvidence: [], reasoning: null })) };
  const instructions = `# VT0001 independent review\n\nReturn exactly three decisions, one for each selected rule ID. First answer the methodology interpretation questions from the frozen complete VT0001 v3.0 pages, then apply that interpretation to the frozen Maya evidence. Do not use prior truth, prior responses, or machine proposals as answer keys.\n\nA valid Option I conclusion requires documented project costs and a demonstration that the project produces no financial benefits other than VCS-related income. VT0001 says a concluded Option I pathway proceeds to Step 4; assess whether the frozen Maya PDD and referenced Appendix 17 evidence actually establish those facts.\n\nFinal adverse judgments are permitted: REVIEWED + UNCLEAR/MISSING + ACTION_REQUIRED. Leave PROVISIONAL only for a genuine unresolved authoritative interpretation or a necessary unavailable source. Cite exact source path, SHA, page, and quote for every material conclusion.\n`;
  const manifest = { schemaVersion: "rc5-2-maya-vt0001-interpretation-manifest-v1", baselineSha, selectedRuleIds: [...selectedRuleIds], frozenInventory, sourceDocuments: { vt0001: { path: vt0001Path, sha256: expected.vt0001Sha256 }, vt0001Pages: { path: vt0001PagesPath, sha256: sha256(localBytes(vt0001PagesPath)) }, vm0007: { path: vm0007Path, sha256: expected.vm0007Sha256 }, vm0007Pages: { path: vm0007PagesPath, sha256: expected.vm0007PagesSha256 }, pdd: { path: pddPath, sha256: expected.pddSha256 }, extraction: { path: extractionPath, sha256: expected.extractionSha256 }, machine: { path: machinePath, sha256: expected.machineSha256 } }, selectionInputs: truthPaths.map((p) => ({ path: p, sha256: sha256(frozenBytes(p)), commitSha: baselineSha })), packetFiles: ["review-packet.json", "reviewer-instructions.md", "review-response-schema.json", "review-template.json", "manifest.json"], reviewedTruthCreated: false, priorResponsesIncluded: false };
  return { packet, instructions, responseSchema, template, manifest };
}

export async function writeArtifacts(outputDir = packetDir): Promise<string> {
  const a = await buildArtifacts(); fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "review-packet.json"), `${JSON.stringify(a.packet, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, "reviewer-instructions.md"), a.instructions);
  fs.writeFileSync(path.join(outputDir, "review-response-schema.json"), `${JSON.stringify(a.responseSchema, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, "review-template.json"), `${JSON.stringify(a.template, null, 2)}\n`);
  const packetSha256 = sha256(fs.readFileSync(path.join(outputDir, "review-packet.json")));
  fs.writeFileSync(path.join(outputDir, "manifest.json"), `${JSON.stringify({ ...a.manifest, packetSha256 }, null, 2)}\n`);
  return packetSha256;
}

if (import.meta.url === `file://${process.argv[1]}`) writeArtifacts().catch((error) => { console.error(error); process.exitCode = 1; });
