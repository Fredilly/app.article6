import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  buildVm0007Rc2Baseline,
  renderVm0007Rc2Summary,
  serializeVm0007Rc2Baseline,
} from "../../src/lib/preverif/vm0007Rc2Baseline";
import type {
  Vm0007EvidenceBenchmarkMachineRow,
  Vm0007EvidenceBenchmarkReviewedRow,
} from "../../src/lib/preverif/vm0007EvidenceBenchmark";

const root = process.cwd();
const fixtureDir = path.join(root, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const artifactDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/baselines/rc2");
const machinePath = path.join(fixtureDir, "machine-proposal.json");
const reviewedPath = path.join(fixtureDir, "gold.rc2-rc3.json");
const registryPath = path.join(root, "public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.json");
const reconciliationPath = path.join(fixtureDir, "mismatch-reconciliation.json");

function readJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

const machine = readJson(machinePath);
const reviewed = readJson(reviewedPath);
const registry = readJson(registryPath);
const reconciliation = readJson(reconciliationPath);
const baseline = buildVm0007Rc2Baseline({
  machineRows: machine.rows as Vm0007EvidenceBenchmarkMachineRow[],
  reviewedRows: reviewed.rows as Vm0007EvidenceBenchmarkReviewedRow[],
  expectedStableRuleIds: registry.rules.map((rule: { stable_id: string }) => rule.stable_id),
  reconciliationRows: reconciliation.rows,
  fixtureIdentity: {
    machineProposal: { path: path.relative(root, machinePath), sha256: sha256(machinePath) },
    reviewedTruth: { path: path.relative(root, path.join(fixtureDir, "gold.json")), sha256: sha256(reviewedPath) },
    stableRuleRegistry: { path: path.relative(root, registryPath), sha256: sha256(registryPath) },
    reconciliation: { path: path.relative(root, reconciliationPath), sha256: sha256(reconciliationPath) },
  },
});

fs.writeFileSync(path.join(artifactDir, "RC2_BASELINE.json"), serializeVm0007Rc2Baseline(baseline), "utf8");
fs.writeFileSync(path.join(artifactDir, "RC2_BASELINE.md"), renderVm0007Rc2Summary(baseline), "utf8");
console.log(`Wrote RC2 baseline for ${baseline.totalRowCount} rows.`);
