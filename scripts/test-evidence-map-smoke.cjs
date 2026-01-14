const fs = require("fs");
const path = require("path");

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: "CommonJS" });
require("ts-node/register");

const normalizeStacItems = require("../src/lib/stac/normalizeStacItems.ts").default;
const { buildEvidenceRuleIndex } = require("../src/lib/trace/evidenceLinks.ts");

const fixturePath = path.join(__dirname, "../public/fixtures/stac-item.json");
const fixtureRaw = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

const normalized = normalizeStacItems(fixtureRaw);
const itemIds = Object.keys(normalized.itemsById);

if (itemIds.length < 1) {
  throw new Error("Smoke test failed: expected at least 1 evidence item from fixture STAC.");
}

const trace = {
  version: 1,
  method: { code: "TEST", version: "v0" },
  rule_to_sections: {},
  rule_to_evidence: {},
};

const evidenceRuleIndex = buildEvidenceRuleIndex(trace);

for (const id of itemIds) {
  const linked = evidenceRuleIndex.get(id) ?? [];
  if (linked.length !== 0) {
    throw new Error(`Smoke test failed: expected no linked rules for ${id}.`);
  }
  const label = linked.length ? "Linked rules" : "Unlinked evidence";
  if (label !== "Unlinked evidence") {
    throw new Error("Smoke test failed: expected unlinked evidence label.");
  }
}

console.log("Evidence map smoke test passed.");
