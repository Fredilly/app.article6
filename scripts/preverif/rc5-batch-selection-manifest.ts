import fs from "node:fs";
import path from "node:path";

export type Rc5BatchSelectionManifest = {
  schemaVersion: "rc5-batch-selection-manifest-v1";
  batches: Record<string, { batchId: string; expectedRuleIds: string[] }>;
};

export const rc5BatchSelectionManifestPath = path.join(process.cwd(), "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-batch-selection-manifest.json");

export function readRc5BatchSelection(batchNumber: number): string[] {
  const manifest = JSON.parse(fs.readFileSync(rc5BatchSelectionManifestPath, "utf8")) as Rc5BatchSelectionManifest;
  const selection = manifest.batches[String(batchNumber)];
  if (!selection) throw new Error(`RC5 Batch ${batchNumber} is missing from the frozen selection manifest`);
  return [...selection.expectedRuleIds];
}
