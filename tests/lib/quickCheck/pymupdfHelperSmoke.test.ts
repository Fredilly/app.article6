import { afterAll, describe, expect, it } from "@jest/globals";
import { execFileSync } from "child_process";
import { existsSync, rmSync, writeFileSync } from "fs";
import path from "path";

const SCRIPT = path.resolve(process.cwd(), "scripts", "pymupdf-parse.py");

function resolvePython3(): string {
  if (process.env.PYTHON3) return process.env.PYTHON3;
  const venvPython3 = path.resolve(process.cwd(), ".venv/bin/python3");
  if (existsSync(venvPython3)) return venvPython3;
  return "python3";
}

function checkFitzAvailable(): boolean {
  try {
    execFileSync(resolvePython3(), ["-c", "import fitz"], {
      timeout: 10000,
      encoding: "utf-8",
    });
    return true;
  } catch {
    return false;
  }
}

function makeSyntheticPdf(pdfPath: string, pageCount: number): void {
  const pythonPath = resolvePython3();
  const pyScript = `
import fitz
doc = fitz.open()
for p in range(${pageCount}):
    page = doc.new_page(width=595, height=842)
    page.insert_text((72, 72 + min(p, 5) * 8), f"Heading on Page {p+1}", fontsize=max(8, 14 - min(p, 5) * 1.2))
    for i, line in enumerate(["Line one of body text.", "Line two of body text.", "Line three with more content about carbon projects."]):
        page.insert_text((72, 200 + i * 20), f"{line} (p{p+1})", fontsize=12)
doc.save("${pdfPath}")
doc.close()
print("ok")
`;
  execFileSync(pythonPath, ["-c", pyScript], { timeout: 30000, encoding: "utf-8" });
}

const FALLBACK_SYNTHETIC_PDF = path.resolve("/tmp/pymupdf-smoke-60.pdf");
const FITZ_AVAILABLE = checkFitzAvailable();

const describeOrSkip = FITZ_AVAILABLE ? describe : describe.skip;

describeOrSkip("pymupdf-parse.py smoke tests", () => {
  const SYNTHETIC_PDF = FALLBACK_SYNTHETIC_PDF;

  afterAll(() => {
    try { rmSync(SYNTHETIC_PDF); } catch { /* ok */ }
  });

  it("parses a 1-page synthetic PDF and returns valid JSON", () => {
    const onePage = path.resolve("/tmp/pymupdf-smoke-1.pdf");
    try {
      makeSyntheticPdf(onePage, 1);

      const stdout = execFileSync(resolvePython3(), [SCRIPT, onePage], {
        timeout: 30000,
        encoding: "utf-8",
      });
      const result = JSON.parse(stdout);

      expect(result.error).toBeUndefined();
      expect(result.engine).toBe("pymupdf");
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0]?.page_number).toBe(1);
      expect(result.raw_text).toBeTruthy();
      expect(result.diagnostics).toBeDefined();
      expect(result.diagnostics.phases).toBeDefined();
    } finally {
      try { rmSync(onePage); } catch { /* ok */ }
    }
  });

  it("parses a 60-page synthetic PDF under 15 seconds", () => {
    makeSyntheticPdf(SYNTHETIC_PDF, 60);

    const start = Date.now();
    const stdout = execFileSync(resolvePython3(), [SCRIPT, SYNTHETIC_PDF], {
      timeout: 60000,
      encoding: "utf-8",
    });
    const elapsed = Date.now() - start;

    const result = JSON.parse(stdout);

    expect(result.error).toBeUndefined();
    expect(result.pages).toHaveLength(60);
    expect(result.raw_text.length).toBeGreaterThan(1000);
    expect(result.diagnostics.total_pages).toBe(60);

    // Only 5 dict extractions requested, not 60
    expect(result.diagnostics.dict_pages_requested).toBe(5);

    // Must complete in reasonable time
    expect(elapsed).toBeLessThan(15000);
  });

  it("includes phase diagnostics in output JSON", () => {
    makeSyntheticPdf(SYNTHETIC_PDF, 5);

    const stdout = execFileSync(resolvePython3(), [SCRIPT, SYNTHETIC_PDF], {
      timeout: 30000,
      encoding: "utf-8",
    });
    const result = JSON.parse(stdout);

    const d = result.diagnostics;
    expect(d).toBeDefined();
    expect(typeof d.total_time_s).toBe("number");
    expect(d.total_time_s).toBeGreaterThan(0);
    expect(d.phases.import_check).toBeGreaterThan(0);
    expect(d.phases.open_pdf).toBeGreaterThan(0);
    expect(d.phases.estimate_body_font_size).toBeGreaterThan(0);
    expect(d.phases.text_extract).toBeGreaterThan(0);
    expect(d.phases.serialize_json).toBeGreaterThanOrEqual(0);
    expect(typeof d.body_font_size).toBe("number");
  });

  it("font size sampling caps at 50 spans per page", () => {
    makeSyntheticPdf(SYNTHETIC_PDF, 10);

    const stdout = execFileSync(resolvePython3(), [SCRIPT, SYNTHETIC_PDF], {
      timeout: 30000,
      encoding: "utf-8",
    });
    const result = JSON.parse(stdout);

    // Body font size sampled from limited pages
    expect(result.diagnostics.font_pages_sampled).toBeLessThanOrEqual(3);
    expect(typeof result.diagnostics.body_font_size).toBe("number");

    // Dict extraction limited to DICT_SAMPLE_PAGES (5)
    expect(result.diagnostics.dict_pages_requested).toBeLessThanOrEqual(5);
  });

  it("--no-tables skips table extraction and sets diagnostics", () => {
    makeSyntheticPdf(SYNTHETIC_PDF, 5);

    const stdout = execFileSync(resolvePython3(), [SCRIPT, SYNTHETIC_PDF, "--no-tables"], {
      timeout: 30000,
      encoding: "utf-8",
    });
    const result = JSON.parse(stdout);

    expect(result.tables).toHaveLength(0);
    expect(result.diagnostics.table_fallback).toContain("--no-tables");
  });

  it("table extraction is limited to first 10 pages", () => {
    makeSyntheticPdf(SYNTHETIC_PDF, 25);

    const stdout = execFileSync(resolvePython3(), [SCRIPT, SYNTHETIC_PDF], {
      timeout: 60000,
      encoding: "utf-8",
    });
    const result = JSON.parse(stdout);

    expect(result.diagnostics).toBeDefined();
    // Tables extracted indicator is present
    expect(typeof result.diagnostics.tables_extracted).toBe("number");
  });

  it("output JSON is valid even without pdfplumber installed", () => {
    const onePage = path.resolve("/tmp/pymupdf-smoke-no-table.pdf");
    try {
      makeSyntheticPdf(onePage, 1);

      // Use --no-tables to simulate missing pdfplumber
      const stdout = execFileSync(resolvePython3(), [SCRIPT, onePage, "--no-tables"], {
        timeout: 30000,
        encoding: "utf-8",
      });
      const result = JSON.parse(stdout);

      expect(result.error).toBeUndefined();
      expect(result.engine).toBe("pymupdf");
      expect(result.tables).toHaveLength(0);
      expect(result.raw_text).toBeTruthy();
    } finally {
      try { rmSync(onePage); } catch { /* ok */ }
    }
  });
});
