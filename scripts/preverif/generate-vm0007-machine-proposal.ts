import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { extractMethodologyMentions } from "../../src/lib/chat/quickCheckEvidence";
import { resolveQuickCheckMethodology } from "../../src/lib/chat/quickCheckMethodology";
import { resolveMethodologySignals } from "../../src/lib/chat/quickCheckMethodSignals";
import { extractPdfPagesWithPdfParse } from "../../src/lib/chat/quickCheckPdfExtractor";
import { formatQuickCheckPdfPages } from "../../src/lib/chat/quickCheckPdfPages";
import { loadMethodRules } from "../../src/app/m/_lib/methodRules";
import { buildVm0007MachineProposal } from "../../src/lib/preverif/vm0007MachineProposal";

const root = process.cwd();
const expectedPdfSha256 = "407caaa782e9d9e07b250999539fc809c2c41888b0f20a628a9e49dbeb977a5b";
const manifestPath = path.join(root, "public/manifest/index.json");

function arg(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`Missing required argument ${name}`);
  return value;
}

function sha256(bytes: Uint8Array): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
  const pdfPath = path.resolve(arg("--pdf"));
  const outputDir = path.resolve(arg("--output"));
  const generatedAt = process.argv.includes("--generated-at") ? arg("--generated-at") : new Date().toISOString();
  const pdfBytes = fs.readFileSync(pdfPath);
  const sourcePdfSha256 = sha256(pdfBytes);
  if (sourcePdfSha256 !== expectedPdfSha256) {
    throw new Error(`Maya PDF SHA mismatch: expected ${expectedPdfSha256}, got ${sourcePdfSha256}`);
  }

  const extraction = await extractPdfPagesWithPdfParse({ bytes: pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) });
if (!extraction.text.trim() || extraction.pages.length === 0) throw new Error("PDF extraction produced no page text");

const rawText = formatQuickCheckPdfPages(extraction.pages).trim();
const mentions = extractMethodologyMentions(rawText);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Array<Record<string, unknown>>;
const methods = Array.from(new Map(
  manifest
    .filter((entry) => typeof entry.methodology === "string" && typeof entry.version === "string")
    .map((entry) => [String(entry.methodology), String(entry.version)]),
).entries()).map(([code, version]) => ({ code, versions: [version], latestVersion: version }));
const methodologyResolution = resolveQuickCheckMethodology({ mentions, methods, rawText });
const methodologySignals = resolveMethodologySignals(mentions, new Set(methods.map((method) => method.code)));
if (!methodologySignals.exactlyOne || methodologySignals.detectedMethods[0]?.methodCode !== "VM0007") {
  throw new Error(`Methodology detection did not resolve VM0007: ${JSON.stringify({ methodologyResolution, methodologySignals })}`);
}

const declaredMethodologyVersion = rawText.match(/\bVM0007\b[\s\S]{0,160}?\b(?:version\s*)?1[.-]8\b/i)?.[0]?.replace(/\s+/g, " ").trim();
if (!declaredMethodologyVersion) throw new Error("Could not extract a VM0007 v1.8 declaration from the PDF");
const rulesResult = await loadMethodRules("VM0007", "v1-8");
if (rulesResult.rules.length !== 58) throw new Error(`VM0007 v1.8 rulebook contains ${rulesResult.rules.length} rules, expected 58`);
const built = buildVm0007MachineProposal({
  auditId: "maya-forest-corridor-redd-belize-vm0007-v18-machine-proposal",
  generatedAt,
  methodologyId: "VM0007",
  methodologyVersion: "v1-8",
  evidenceFileName: path.basename(pdfPath),
  sourcePdfSha256,
  rawPddText: rawText,
  rules: rulesResult.rules,
});
const draft = built.draft;
if (!draft.ok) throw new Error(`Machine proposal generation blocked: ${draft.blockedBy.join(", ")}`);
if (draft.package.rows.length !== 58 || draft.package.proposalState !== "MACHINE_PROPOSED") throw new Error("Generated proposal failed canonical shape checks");

const evidenceStateCounts = { FOUND: 0, UNCLEAR: 0, MISSING: 0 };
const applicabilityCounts = { APPLICABLE: 0, NOT_APPLICABLE: 0, UNKNOWN: 0 };
let acceptedEvidenceItems = 0;
let rejectedEvidenceItems = 0;
let incompleteProvenanceRules = 0;
for (const row of draft.package.rows) {
  evidenceStateCounts[row.proposedEvidenceStatus] += 1;
  applicabilityCounts[row.proposedApplicability] += 1;
  acceptedEvidenceItems += row.acceptedEvidence?.length ?? 0;
  rejectedEvidenceItems += row.rejectedEvidence?.length ?? 0;
  if ((row.acceptedEvidence ?? []).some((item) => !item.provenance.sectionHeading || !item.provenance.spanId) ||
      (row.rejectedEvidence ?? []).some((item) => !item.provenance.sectionHeading || !item.provenance.spanId)) incompleteProvenanceRules += 1;
}

writeJson(path.join(outputDir, "raw-document-extraction.json"), {
  sourceDocument: { ...built.sourceDocument, sourcePdfSha256 },
  extraction: { engine: extraction.engine, metadata: extraction.metadata, pageCount: extraction.pages.length },
  text: rawText,
  pages: extraction.pages,
  methodologyDetection: { mentions, resolution: methodologyResolution, signals: methodologySignals },
});
writeJson(path.join(outputDir, "machine-proposal.json"), draft.package);

const relative = (filePath: string) => path.relative(root, filePath);
const baselinePath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc5/maya-machine-proposal-baseline.md");
const proposalPath = path.join(outputDir, "machine-proposal.json");
const evidenceCounts = Object.entries(evidenceStateCounts).map(([key, value]) => `${key} ${value}`).join(", ");
const applicability = Object.entries(applicabilityCounts).map(([key, value]) => `${key} ${value}`).join(", ");
const baseline = `# Maya machine proposal baseline\n\n- PDF identity: Maya Forest Corridor REDD Belize (${path.basename(pdfPath)})\n- SHA: ${sourcePdfSha256}\n- RC5-1 fixture identity match: yes (${sourcePdfSha256})\n- Methodology: VM0007\n- Version: v1.8\n- Generation command: npx tsx scripts/preverif/generate-vm0007-machine-proposal.ts --pdf "${pdfPath}" --output "${outputDir}" --generated-at "${generatedAt}"\n- Generation timestamp: ${generatedAt}\n- Number of rules: ${draft.package.rows.length}\n- Evidence-state counts: ${evidenceCounts}\n- Applicability counts: ${applicability}\n- Accepted evidence items: ${acceptedEvidenceItems}\n- Rejected evidence items: ${rejectedEvidenceItems}\n- Rules with incomplete provenance: ${incompleteProvenanceRules}\n- Reviewed truth exists: no\n- Manual corrections made: no\n- Generation blockers or warnings: none\n- Canonical artifact: [${relative(proposalPath)}](../../../../${relative(proposalPath)})\n`;
fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
fs.writeFileSync(baselinePath, baseline, "utf8");
  console.log(JSON.stringify({ proposalPath: relative(proposalPath), baselinePath: relative(baselinePath), pdfSha256: sourcePdfSha256, methodology: "VM0007", version: "v1.8", rules: 58, evidenceStateCounts, applicabilityCounts, acceptedEvidenceItems, rejectedEvidenceItems, incompleteProvenanceRules, generatedAt }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
