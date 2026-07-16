import fs from "node:fs";
import path from "node:path";
import { loadMethodRules, type RuleSummary } from "@/app/m/_lib/methodRules";

export type ValidationFixture = Readonly<{
  fixtureId: string;
  caseType: "validation";
  pdf: Readonly<{
    fileName: string | null;
    sourcePath: string | null;
    sha256: string | null;
  }>;
  methodology: Readonly<{ id: string; version: string }>;
  project: Readonly<{
    id?: string;
    name?: string;
    region?: string;
    registry?: string;
    documentType?: string;
  }>;
  generatedRuleCount?: number;
}>;

const registryPath = path.join(process.cwd(), "tests/fixtures/preverif/validation-fixtures.json");

export function loadValidationFixtures(): readonly ValidationFixture[] {
  return JSON.parse(fs.readFileSync(registryPath, "utf8")) as ValidationFixture[];
}

export function getValidationFixture(fixtureId: string): ValidationFixture {
  const fixture = loadValidationFixtures().find((candidate) => candidate.fixtureId === fixtureId);
  if (!fixture) throw new Error(`Unknown validation fixture: ${fixtureId}`);
  return fixture;
}

export async function generateValidationRules(fixture: ValidationFixture): Promise<{
  rules: readonly RuleSummary[];
  source: string;
}> {
  if (fixture.methodology.id !== "VM0007" || fixture.methodology.version !== "v1.8") {
    throw new Error("RC5 validation fixtures require VM0007 v1.8.");
  }
  const result = await loadMethodRules(fixture.methodology.id, "v1-8");
  return { rules: result.rules, source: result.source };
}
