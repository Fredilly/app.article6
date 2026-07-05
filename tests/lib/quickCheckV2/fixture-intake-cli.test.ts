import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { addQuickCheckV2Fixture, parseFixtureAddArgs } from "../../../scripts/lib/quickcheck-fixture-intake";

const tempRoots: string[] = [];

async function makeTempRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "qcv2-fixture-intake-"));
  tempRoots.push(root);
  return root;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
}

async function writeFakePdf(root: string, name = "source.pdf", body = "%PDF-1.4\nfixture\n"): Promise<string> {
  const pdfPath = path.join(root, name);
  await fs.writeFile(pdfPath, body);
  return pdfPath;
}

function fakeExtractor() {
  return jest.fn(async (_bytes: ArrayBuffer) => ({
    pages: [
      {
        pageNumber: 1,
        text: [
          "1 Project Details",
          "Project location Brazil",
        ].join("\n"),
      },
      {
        pageNumber: 43,
        text: [
          "2.2.3 Community and Biodiversity Additionality (CCB, G2.2)",
          "The project activities would not occur without carbon finance due to substantial financial barriers.",
        ].join("\n"),
      },
      {
        pageNumber: 61,
        text: [
          "3.1 Title and Reference of Methodology",
          "Applied Methodology VM0007 REDD+ Methodology Framework (REDD+MF) 1.8",
        ].join("\n"),
      },
    ],
  }));
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("quickcheck fixture intake command", () => {
  it("creates the expected Quick Check v2 fixture files and manifest entry", async () => {
    const root = await makeTempRoot();
    const fixtureRoot = path.join(root, "tests/fixtures/quick-check/v2");
    const pdfPath = await writeFakePdf(root);
    await writeJson(path.join(fixtureRoot, "manifest.json"), { version: 1, fixtures: [] });
    const extractPdfPages = fakeExtractor();

    const result = await addQuickCheckV2Fixture({
      pdfPath,
      id: "example-pdd",
      title: "Example PDD",
      fixtureRoot,
      extractPdfPages,
    });

    expect(result.files).toEqual([
      "source.pdf",
      "extracted.txt",
      "gold.draft.json",
      "gold.json",
      "meta.json",
      "corrections.json",
      "REVIEW.md",
    ]);
    expect(extractPdfPages).toHaveBeenCalledTimes(1);

    const fixtureDir = path.join(fixtureRoot, "example-pdd");
    await expect(fs.stat(path.join(fixtureDir, "source.pdf"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(fixtureDir, "extracted.txt"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(fixtureDir, "gold.draft.json"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(fixtureDir, "gold.json"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(fixtureDir, "meta.json"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(fixtureDir, "corrections.json"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(fixtureDir, "REVIEW.md"))).resolves.toBeTruthy();

    await expect(fs.readFile(path.join(fixtureDir, "source.pdf"), "utf-8")).resolves.toBe("%PDF-1.4\nfixture\n");
    const extractedText = await fs.readFile(path.join(fixtureDir, "extracted.txt"), "utf-8");
    expect(extractedText).toContain("Page 1\n1 Project Details");
    expect(extractedText).toContain("Page 61\n3.1 Title and Reference of Methodology");

    await expect(readJson(path.join(fixtureDir, "meta.json"))).resolves.toMatchObject({
      id: "example-pdd",
      title: "Example PDD",
      documentId: "example-pdd-extracted",
      runtimeMode: "static",
      comparisonMode: "full",
      phase: "fixture_intake",
      registry: "UNKNOWN",
      documentType: "PDD / Project Description",
    });

    const gold = await readJson<Array<Record<string, unknown>>>(path.join(fixtureDir, "gold.json"));
    const draftGold = await readJson<Array<Record<string, unknown>>>(path.join(fixtureDir, "gold.draft.json"));
    expect(draftGold).toStrictEqual(gold);
    expect(gold).toHaveLength(6);
    for (const record of gold) {
      expect(record).toEqual(expect.objectContaining({
        checkName: expect.any(String),
        expectedStatus: expect.stringMatching(/^(FOUND|UNCLEAR|MISSING)$/),
        sectionPath: expect.any(Array),
      }));
    }

    expect(gold.find((record) => record.checkName === "methodology")).toEqual(expect.objectContaining({
      expectedStatus: "FOUND",
      expectedAnswer: "VM0007 REDD+ Methodology Framework v1.8",
      expectedMethodology: expect.objectContaining({
        methodologyId: "VM0007",
        methodologyName: "REDD+ Methodology Framework",
        methodologyAlias: "",
        pddDeclaredMethodologyVersion: "v1.8",
        versionStatus: "DECLARED",
      }),
    }));

    const corrections = await readJson<Array<Record<string, unknown>>>(path.join(fixtureDir, "corrections.json"));
    expect(corrections).toHaveLength(6);
    expect(corrections[0]).toEqual(expect.objectContaining({
      checkName: expect.any(String),
      currentStatus: expect.stringMatching(/^(FOUND|UNCLEAR|MISSING)$/),
      reason: expect.any(String),
    }));

    const review = await fs.readFile(path.join(fixtureDir, "REVIEW.md"), "utf-8");
    expect(review).toContain("Do not merge until `gold.json` has been reviewed against the source PDF");
    expect(review).toContain("weak evidence to reject");
    expect(review).toContain("notes for method ID/version: VM0007 v1.8 (DECLARED)");

    await expect(readJson(path.join(fixtureRoot, "manifest.json"))).resolves.toStrictEqual({
      version: 1,
      fixtures: [{ id: "example-pdd", directory: "example-pdd" }],
    });
  });

  it("refuses to overwrite an existing fixture unless force is passed", async () => {
    const root = await makeTempRoot();
    const fixtureRoot = path.join(root, "tests/fixtures/quick-check/v2");
    const pdfPath = await writeFakePdf(root);
    await writeJson(path.join(fixtureRoot, "manifest.json"), { version: 1, fixtures: [] });

    await addQuickCheckV2Fixture({
      pdfPath,
      id: "example-pdd",
      title: "First Title",
      fixtureRoot,
      extractPdfPages: fakeExtractor(),
    });

    await expect(addQuickCheckV2Fixture({
      pdfPath,
      id: "example-pdd",
      title: "Second Title",
      fixtureRoot,
      extractPdfPages: fakeExtractor(),
    })).rejects.toThrow(/Fixture already exists/);

    const replacementPdfPath = await writeFakePdf(root, "replacement.pdf", "%PDF-1.4\nreplacement\n");
    await addQuickCheckV2Fixture({
      pdfPath: replacementPdfPath,
      id: "example-pdd",
      title: "Second Title",
      fixtureRoot,
      extractPdfPages: fakeExtractor(),
      force: true,
    });

    const fixtureDir = path.join(fixtureRoot, "example-pdd");
    await expect(fs.readFile(path.join(fixtureDir, "source.pdf"), "utf-8")).resolves.toBe("%PDF-1.4\nreplacement\n");
    await expect(readJson(path.join(fixtureDir, "meta.json"))).resolves.toMatchObject({ title: "Second Title" });
    await expect(readJson(path.join(fixtureRoot, "manifest.json"))).resolves.toStrictEqual({
      version: 1,
      fixtures: [{ id: "example-pdd", directory: "example-pdd" }],
    });
  });

  it("validates fixture ids before writing files", async () => {
    const root = await makeTempRoot();
    const fixtureRoot = path.join(root, "tests/fixtures/quick-check/v2");
    const pdfPath = await writeFakePdf(root);
    await writeJson(path.join(fixtureRoot, "manifest.json"), { version: 1, fixtures: [] });

    await expect(addQuickCheckV2Fixture({
      pdfPath,
      id: "Bad_ID",
      title: "Bad Fixture",
      fixtureRoot,
      extractPdfPages: fakeExtractor(),
    })).rejects.toThrow(/kebab-case/);

    await expect(fs.readdir(fixtureRoot)).resolves.toEqual(["manifest.json"]);
  });

  it("parses CLI arguments", () => {
    expect(parseFixtureAddArgs([
      "--pdf",
      "~/Desktop/example.pdf",
      "--id",
      "example-pdd",
      "--title",
      "Example PDD",
      "--force",
    ])).toEqual({
      pdfPath: "~/Desktop/example.pdf",
      id: "example-pdd",
      title: "Example PDD",
      force: true,
    });

    expect(() => parseFixtureAddArgs(["--pdf", "example.pdf"])).toThrow(/Usage:/);
  });
});
