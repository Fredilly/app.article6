import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  buildVm0007Rc3SelectedMatchSubtaxonomy,
  serializeVm0007Rc3SelectedMatchSubtaxonomy,
} from "../../src/lib/preverif/vm0007Rc3SelectedMatchSubtaxonomy";
import type { Vm0007EvidenceBenchmarkMachineRow, Vm0007EvidenceBenchmarkReviewedRow } from "../../src/lib/preverif/vm0007EvidenceBenchmark";
import type { Vm0007Rc3Diagnostic } from "../../src/lib/preverif/vm0007Rc3Diagnostic";

const root = process.cwd();
const artifactDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc3");
const fixtureDir = path.join(root, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const baselinePath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/baselines/rc2/RC2_BASELINE.json");
const diagnosticPath = path.join(artifactDir, "RC3_DIAGNOSTIC.json");
const machinePath = path.join(fixtureDir, "machine-proposal.json");
const reviewedPath = path.join(fixtureDir, "gold.rc2-rc3.json");
const outputPath = path.join(artifactDir, "RC3_SELECTED_MATCH_SUBTAXONOMY.json");
const read = (filePath: string) => JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
const digest = (filePath: string) => crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

const value = buildVm0007Rc3SelectedMatchSubtaxonomy({
  diagnostic: read(diagnosticPath) as Vm0007Rc3Diagnostic,
  machineRows: (read(machinePath) as { rows: Vm0007EvidenceBenchmarkMachineRow[] }).rows,
  reviewedRows: (read(reviewedPath) as { rows: Vm0007EvidenceBenchmarkReviewedRow[] }).rows,
  baseline: { artifactPath: path.relative(root, baselinePath), artifactSha256: digest(baselinePath) },
});
fs.writeFileSync(outputPath, serializeVm0007Rc3SelectedMatchSubtaxonomy(value), "utf8");
console.log(`Wrote RC3 selected-match subtype artifact: ${value.parentCategory.count} events; highest=${Object.entries(value.subtypeCounts).sort((left, right) => right[1] - left[1])[0]?.[0]}.`);
