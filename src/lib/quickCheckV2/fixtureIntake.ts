import { promises as fs } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { formatQuickCheckPdfPages, type QuickCheckPdfPage } from "@/lib/chat/quickCheckPdfPages";
import { extractPdfPagesWithPdfParse } from "@/lib/chat/quickCheckPdfExtractor";
import { extractAnswersForAllChecks, extractMethodologyDetailsFromEvidence } from "@/lib/quickCheckV2/answers";
import {
  parseExtractedText,
  type EvidenceSourceType,
  type StructuredCheckId,
} from "@/lib/quickCheckV2/evidence";
import {
  buildQuickCheckMethodologyIdentity,
  type QuickCheckMethodologyIdentity,
} from "@/lib/quickCheckV2/methodologyIdentity";
import { validateAnswerResults, type StatusResult } from "@/lib/quickCheckV2/status";

type RuntimeMode = "static" | "runtime-smoke" | "nightly";

type FixtureMeta = {
  id: string;
  title: string;
  documentId: string;
  runtimeMode: RuntimeMode;
  comparisonMode: "full" | "evidence-only";
  phase: string;
  registry: string;
  documentType: string;
};

type Manifest = {
  version: number;
  fixtures: Array<{
    id: string;
    directory: string;
  }>;
};

type GoldRecord = {
  checkName: StructuredCheckId;
  expectedStatus: "FOUND" | "UNCLEAR" | "MISSING";
  expectedAnswer: string | null;
  goldQuote: string | null;
  page: number | null;
  sectionHeading: string | null;
  sectionPath: string[];
  spanId: string | null;
  sourceType: EvidenceSourceType | null;
  expectedMethodology?: Partial<QuickCheckMethodologyIdentity>;
};

type CorrectionRecord = {
  checkName: StructuredCheckId;
  currentStatus: "FOUND" | "UNCLEAR" | "MISSING";
  currentAnswer: string | null;
  currentQuote: string | null;
  page: number | null;
  sectionHeading: string | null;
  sectionPath: string[];
  spanId: string | null;
  sourceType: EvidenceSourceType | null;
  reason: StatusResult["reason"];
  methodology?: Partial<QuickCheckMethodologyIdentity>;
};

type PdfPageExtractionResult = {
  pages: QuickCheckPdfPage[];
};

export type FixtureIntakeArgs = {
  pdfPath: string;
  id: string;
  title: string;
  force?: boolean;
  fixtureRoot?: string;
  extractPdfPages?: (bytes: ArrayBuffer) => Promise<PdfPageExtractionResult>;
};

export type FixtureIntakeResult = {
  fixtureDir: string;
  files: string[];
};

const DEFAULT_FIXTURE_ROOT = path.resolve("tests/fixtures/quick-check/v2");
const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

function toJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function expandHome(inputPath: string): string {
  if (inputPath === "~") {
    return process.env.HOME ?? inputPath;
  }
  if (inputPath.startsWith("~/")) {
    return path.join(process.env.HOME ?? "~", inputPath.slice(2));
  }
  return inputPath;
}

function normalizeFixtureId(id: string): string {
  const normalized = id.trim();
  if (!ID_RE.test(normalized)) {
    throw new Error(`Fixture id must be kebab-case lowercase alphanumeric, got: ${id}`);
  }
  return normalized;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function arrayBufferFromBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function buildMethodologyExpectation(result: StatusResult): Partial<QuickCheckMethodologyIdentity> | undefined {
  if (result.checkName !== "methodology" || !result.evidence) {
    return undefined;
  }

  const tableMethodology = extractMethodologyDetailsFromEvidence(result.evidence);
  if (tableMethodology) {
    return tableMethodology;
  }

  const evidenceMethodology = buildQuickCheckMethodologyIdentity(result.evidence);
  const answerMethodology = result.answer
    ? buildQuickCheckMethodologyIdentity({
      ...result.evidence,
      quote: result.answer,
    })
    : null;
  const methodology = answerMethodology ?? evidenceMethodology ?? result.methodology ?? null;
  if (!methodology) {
    return undefined;
  }

  return {
    methodologyId: methodology.methodologyId,
    methodologyName: methodology.methodologyName,
    methodologyAlias: methodology.methodologyAlias,
    pddDeclaredMethodologyVersion: methodology.pddDeclaredMethodologyVersion,
    versionStatus: methodology.versionStatus,
    evidencePage: result.evidence.page,
    evidenceSection: result.evidence.sectionHeading?.trim() ?? "",
    evidenceQuote: result.evidence.quote,
  };
}

function toGoldRecord(result: StatusResult): GoldRecord {
  const record: GoldRecord = {
    checkName: result.checkName,
    expectedStatus: result.status,
    expectedAnswer: result.answer,
    goldQuote: result.evidence?.quote ?? null,
    page: result.evidence?.page ?? null,
    sectionHeading: result.evidence?.sectionHeading ?? null,
    sectionPath: result.evidence?.sectionPath ?? [],
    spanId: result.evidence?.spanId ?? null,
    sourceType: result.evidence?.sourceType ?? null,
  };
  const methodology = buildMethodologyExpectation(result);
  if (methodology) {
    record.expectedMethodology = methodology;
  }
  return record;
}

function toCorrectionRecord(result: StatusResult): CorrectionRecord {
  const record: CorrectionRecord = {
    checkName: result.checkName,
    currentStatus: result.status,
    currentAnswer: result.answer,
    currentQuote: result.evidence?.quote ?? null,
    page: result.evidence?.page ?? null,
    sectionHeading: result.evidence?.sectionHeading ?? null,
    sectionPath: result.evidence?.sectionPath ?? [],
    spanId: result.evidence?.spanId ?? null,
    sourceType: result.evidence?.sourceType ?? null,
    reason: result.reason,
  };
  const methodology = buildMethodologyExpectation(result);
  if (methodology) {
    record.methodology = methodology;
  }
  return record;
}

function strengthLabel(result: StatusResult): string {
  if (result.status === "FOUND" && result.evidence?.sourceType !== "raw_text_fallback") {
    return "possibly strong, but still requires PDF truth review";
  }
  if (result.status === "MISSING") {
    return "missing or not detected; requires PDF truth review";
  }
  return "weak/unclear; requires PDF truth review";
}

function buildReviewMarkdown(input: {
  id: string;
  title: string;
  pdfPath: string;
  results: StatusResult[];
}): string {
  const lines = [
    `# Quick Check v2 fixture review: ${input.title}`,
    "",
    "This fixture was created by the intake command.",
    "",
    "Do not merge until `gold.json` has been reviewed against the source PDF. Draft gold is current Quick Run output, not verified truth.",
    "",
    `- Fixture id: ${input.id}`,
    `- Source PDF: ${input.pdfPath}`,
    "",
    "## Review checklist",
    "",
  ];

  for (const result of input.results) {
    const methodology = buildMethodologyExpectation(result);
    lines.push(
      `### ${result.checkName}`,
      "",
      `- current answer: ${result.answer ?? "null"}`,
      `- current status: ${result.status}`,
      `- current quote: ${result.evidence?.quote ?? "null"}`,
      `- page: ${result.evidence?.page ?? "null"}`,
      `- section: ${result.evidence?.sectionHeading ?? result.evidence?.sectionPath.join(" > ") ?? "null"}`,
      `- spanId: ${result.evidence?.spanId ?? "null"}`,
      `- source type: ${result.evidence?.sourceType ?? "null"}`,
      `- strength: ${strengthLabel(result)}`,
      `- suggested gold answer: ${result.answer ?? "null"}`,
      `- suggested gold quote: ${result.evidence?.quote ?? "null"}`,
      `- suggested expected status: ${result.status}`,
      "- weak evidence to reject: TODO: add related-but-insufficient PDF text that must not pass",
      methodology
        ? `- notes for method ID/version: ${methodology.methodologyId ?? "UNKNOWN"} ${methodology.pddDeclaredMethodologyVersion ?? "UNKNOWN"} (${methodology.versionStatus ?? "UNKNOWN"})`
        : "- notes for method ID/version: N/A",
      "",
    );
  }

  return `${lines.join("\n").trim()}\n`;
}

async function loadManifest(manifestPath: string): Promise<Manifest> {
  if (!(await pathExists(manifestPath))) {
    return { version: 1, fixtures: [] };
  }
  return JSON.parse(await fs.readFile(manifestPath, "utf-8")) as Manifest;
}

async function writeManifest(manifestPath: string, manifest: Manifest, id: string): Promise<void> {
  const fixtures = manifest.fixtures.filter((fixture) => fixture.id !== id && fixture.directory !== id);
  fixtures.push({ id, directory: id });
  await fs.writeFile(manifestPath, toJson({ ...manifest, fixtures }));
}

export async function addQuickCheckV2Fixture(args: FixtureIntakeArgs): Promise<FixtureIntakeResult> {
  const id = normalizeFixtureId(args.id);
  const pdfPath = path.resolve(expandHome(args.pdfPath));
  const fixtureRoot = path.resolve(args.fixtureRoot ?? DEFAULT_FIXTURE_ROOT);
  const fixtureDir = path.join(fixtureRoot, id);
  const tempDir = path.join(fixtureRoot, `.${id}.tmp-${process.pid}-${Date.now()}`);
  const manifestPath = path.join(fixtureRoot, "manifest.json");
  const documentId = `${id}-extracted`;

  if (!(await pathExists(pdfPath))) {
    throw new Error(`PDF not found: ${pdfPath}`);
  }
  if ((await pathExists(fixtureDir)) && !args.force) {
    throw new Error(`Fixture already exists: ${fixtureDir}. Use --force to overwrite.`);
  }

  await fs.mkdir(fixtureRoot, { recursive: true });
  await fs.rm(tempDir, { recursive: true, force: true });
  await fs.mkdir(tempDir, { recursive: true });

  try {
    const pdfBytes = await fs.readFile(pdfPath);
    await fs.writeFile(path.join(tempDir, "source.pdf"), pdfBytes);

    const extractor = args.extractPdfPages ?? ((bytes: ArrayBuffer) => extractPdfPagesWithPdfParse({ bytes }));
    const extraction = await extractor(arrayBufferFromBuffer(pdfBytes));
    const extractedText = formatQuickCheckPdfPages(extraction.pages);
    await fs.writeFile(path.join(tempDir, "extracted.txt"), `${extractedText}\n`);

    const document = parseExtractedText(extractedText, documentId, "pdf-parse");
    const results = validateAnswerResults(extractAnswersForAllChecks(document));
    const gold = results.map(toGoldRecord);
    const corrections = results.map(toCorrectionRecord);
    const meta: FixtureMeta = {
      id,
      title: args.title.trim(),
      documentId,
      runtimeMode: "static",
      comparisonMode: "full",
      phase: "fixture_intake",
      registry: "UNKNOWN",
      documentType: "PDD / Project Description",
    };

    await fs.writeFile(path.join(tempDir, "meta.json"), toJson(meta));
    await fs.writeFile(path.join(tempDir, "gold.draft.json"), toJson(gold));
    await fs.writeFile(path.join(tempDir, "gold.json"), toJson(gold));
    await fs.writeFile(path.join(tempDir, "corrections.json"), toJson(corrections));
    await fs.writeFile(
      path.join(tempDir, "REVIEW.md"),
      buildReviewMarkdown({ id, title: args.title.trim(), pdfPath, results }),
    );

    if (args.force) {
      await fs.rm(fixtureDir, { recursive: true, force: true });
    }
    await fs.rename(tempDir, fixtureDir);

    const manifest = await loadManifest(manifestPath);
    await writeManifest(manifestPath, manifest, id);

    return {
      fixtureDir,
      files: [
        "source.pdf",
        "extracted.txt",
        "gold.draft.json",
        "gold.json",
        "meta.json",
        "corrections.json",
        "REVIEW.md",
      ],
    };
  } catch (error) {
    await fs.rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}

export function parseFixtureAddArgs(argv: string[]): FixtureIntakeArgs {
  const { values } = parseArgs({
    args: argv,
    options: {
      pdf: { type: "string" },
      id: { type: "string" },
      title: { type: "string" },
      force: { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  if (!values.pdf || !values.id || !values.title) {
    throw new Error(
      "Usage: npm run quickcheck:fixture:add -- --pdf ~/Desktop/example.pdf --id example-pdd --title \"Example PDD\" [--force]",
    );
  }

  return {
    pdfPath: values.pdf,
    id: values.id,
    title: values.title,
    force: values.force,
  };
}
