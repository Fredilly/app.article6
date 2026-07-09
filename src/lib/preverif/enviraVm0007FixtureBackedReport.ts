import fs from "node:fs";
import path from "node:path";
import type { FullAuditFixtureSet, JudgmentFixtureSet } from "../../../tests/lib/preverifJudgmentFixtureGate";
import { buildFixtureBackedVm0007Report, type Vm0007FixtureBackedReport } from "@/lib/preverif/fixtureBackedVm0007Report";

const FIXTURE_DIR = path.join(process.cwd(), "tests/fixtures/preverif");

function readJsonFixture<T>(fileName: string): T {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, fileName), "utf8")) as T;
}

export function buildEnviraVm0007FixtureBackedReport(): Vm0007FixtureBackedReport {
  const fullAuditFixtureSet = readJsonFixture<FullAuditFixtureSet>("envira-vm0007-full-audit-fixture-shape.json");
  const judgmentFixtureSet = readJsonFixture<JudgmentFixtureSet>("envira-vm0007-judgment-fixtures.json");

  return buildFixtureBackedVm0007Report({
    reportId: "envira-vm0007-v15-legacy-mismatch",
    reportName: "Legacy v1.5 mismatch regression fixture preview",
    generatedAt: "2026-07-03T00:00:00Z",
    project: {
      name: "The Envira Amazonia Project",
      description:
        "Legacy v1.5 mismatch regression fixture preserved for version-lock and evidence-map quarantine coverage.",
    },
    methodology: {
      code: "VM0007",
      version: "v1.8",
      name: "VM0007: REDD Methodology Modules (REDD-MF)",
    },
    fullAuditFixtureSet,
    judgmentFixtureSet,
  });
}
