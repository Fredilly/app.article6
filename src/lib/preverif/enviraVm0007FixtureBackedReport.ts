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
    reportId: "envira-vm0007-fixture-report",
    reportName: "Internal Envira VM0007 Fixture-Backed Report Preview",
    generatedAt: "2026-07-03T00:00:00Z",
    project: {
      name: "The Envira Amazonia Project",
      description: "Reviewed Envira VM0007 fixture truth rendered into an internal-only report and Evidence Map.",
    },
    methodology: {
      code: "VM0007",
      version: "4.2",
      name: "VM0007: REDD Methodology Modules (REDD-MF)",
    },
    fullAuditFixtureSet,
    judgmentFixtureSet,
  });
}
