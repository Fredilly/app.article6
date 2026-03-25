import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";

const loadManifestEntriesMock = jest.fn();

jest.mock("@/lib/manifest/cards", () => ({
  loadManifestEntries: (...args: unknown[]) => loadManifestEntriesMock(...args),
}));

import { loadMethodRules } from "@/app/m/_lib/methodRules";
import { loadMethodSections } from "@/app/m/_lib/methodSections";

const fixtureRelDir = "methodologies/__tests__/METHOD-TEST/v01-0";
const fixtureAbsDir = path.join(process.cwd(), "public", fixtureRelDir);
const fixtureManifestPath = `${fixtureRelDir}/rules.json`;

beforeAll(async () => {
  await mkdir(fixtureAbsDir, { recursive: true });
  await writeFile(
    path.join(fixtureAbsDir, "rules.json"),
    JSON.stringify([
      {
        id: "R-1",
        text: "Lean rule text fallback.",
        sectionId: "S-1",
        path: "method-source.pdf",
        sha256: "abc123",
      },
    ]),
    "utf8",
  );
  await writeFile(
    path.join(fixtureAbsDir, "rules.rich.json"),
    JSON.stringify([
      {
        id: "R-1",
        logic: "Projects must satisfy the full quoted rule logic.",
        summary: "Eligibility logic",
        refs: { sections: ["S-1"] },
        path: "method-source.pdf",
        sha256: "abc123",
      },
    ]),
    "utf8",
  );
  await writeFile(
    path.join(fixtureAbsDir, "sections.rich.json"),
    JSON.stringify([
      {
        id: "S-1",
        title: "Eligibility requirements",
        level: 2,
        excerpt: "Projects shall document eligibility requirements.",
        order: 1,
      },
    ]),
    "utf8",
  );
  await writeFile(
    path.join(fixtureAbsDir, "sections.json"),
    JSON.stringify([
      {
        id: "S-1",
        text: "Projects shall document eligibility requirements in the methodology section.",
        path: "method-source.pdf",
        order: 1,
      },
    ]),
    "utf8",
  );
});

afterAll(async () => {
  await rm(path.join(process.cwd(), "public", "methodologies", "__tests__"), {
    recursive: true,
    force: true,
  });
});

beforeEach(() => {
  loadManifestEntriesMock.mockReset();
  loadManifestEntriesMock.mockResolvedValue([
    {
      id: "R-1",
      methodology: "METHOD-TEST",
      version: "v01-0",
      rule: "Lean rule text fallback.",
      tags: ["eligibility"],
      path: fixtureManifestPath,
      sectionId: "S-1",
      sha256: "abc123",
    },
  ]);
});

describe("methodology pack consumption", () => {
  it("keeps rich rule logic and section refs when rules.rich.json is available", async () => {
    const result = await loadMethodRules("METHOD-TEST", "v01-0");

    expect(result.source).toBe("rules.rich.json");
    expect(result.rules.length).toBeGreaterThan(0);

    const full = result.byId.get("R-1");
    expect(full).toBeTruthy();
    expect(full?.text.trim().length).toBeGreaterThan(0);
    expect(full?.logic?.trim()).toBe("Projects must satisfy the full quoted rule logic.");
    expect(full?.sectionId).toBe("S-1");
    expect(full?.sourcePath).toBe("method-source.pdf");
  });

  it("merges rich section titles with plain section text when both files exist", async () => {
    const result = await loadMethodSections("METHOD-TEST", "v01-0");

    expect(result.source).toBe("sections.rich.json");
    expect(result.sections.length).toBeGreaterThan(0);

    const section = result.byId.get("S-1");
    expect(section).toBeTruthy();
    expect(section?.title).toBe("Eligibility requirements");
    expect(section?.textSnippet).toBe("Projects shall document eligibility requirements.");
    expect(section?.text).toBe("Projects shall document eligibility requirements in the methodology section.");
    expect(section?.sourcePath).toBe("method-source.pdf");
  });
});
