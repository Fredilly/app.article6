import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { describe, expect, it } from "@jest/globals";

describe("extract-quick-check-pdf helper script", () => {
  it("returns per-page payloads when invoked with --pages", () => {
    const fixturePath = path.join(process.cwd(), "tests/fixtures/quick-check/malawi-strong-signal-evidence.pdf");
    expect(fs.existsSync(fixturePath)).toBe(true);

    const stdout = execFileSync(
      process.execPath,
      [path.join(process.cwd(), "scripts", "extract-quick-check-pdf.cjs"), fixturePath, "--pages"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
      },
    );

    const payload = JSON.parse(stdout) as {
      text?: string;
      pages?: Array<{ pageNumber?: number; text?: string }>;
    };

    expect(payload.text).toContain("Gold Standard TPDDTEC, Version 4.0");
    expect(Array.isArray(payload.pages)).toBe(true);
    expect(payload.pages?.length).toBeGreaterThan(0);
    expect(payload.pages?.[0]).toEqual(expect.objectContaining({
      pageNumber: 1,
      text: expect.any(String),
    }));
  }, 20000);
});
