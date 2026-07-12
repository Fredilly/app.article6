import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "@jest/globals";

const {
  classifyChangedFiles,
  formatScopeDecision,
  formatSelectionLabel,
} = require("../../scripts/pr-gate-scope.cjs") as {
  classifyChangedFiles: (files: readonly string[]) => { files: string[]; mode: "docs-only" | "full" };
  formatScopeDecision: (result: { files: string[]; mode: "docs-only" | "full" }) => string;
  formatSelectionLabel: (mode: "docs-only" | "full") => string;
};

describe("pr-gate scope classifier", () => {
  it("selects docs-only for a single docs file", () => {
    expect(classifyChangedFiles(["docs/roadmaps/example.md"])).toEqual({
      files: ["docs/roadmaps/example.md"],
      mode: "docs-only",
    });
  });

  it("selects docs-only when all changed files are under docs/", () => {
    expect(classifyChangedFiles(["docs/roadmaps/SUMMARY.md", "docs/example.md"])).toEqual({
      files: ["docs/roadmaps/SUMMARY.md", "docs/example.md"],
      mode: "docs-only",
    });
  });

  it("selects full when any non-docs file changes", () => {
    expect(classifyChangedFiles(["docs/example.md", "package.json"])).toEqual({
      files: ["docs/example.md", "package.json"],
      mode: "full",
    });
  });

  it("selects full for workflow file changes", () => {
    expect(classifyChangedFiles([".github/workflows/pr-gate.yml"])).toEqual({
      files: [".github/workflows/pr-gate.yml"],
      mode: "full",
    });
  });

  it("selects full when no changed files are reported", () => {
    expect(classifyChangedFiles([])).toEqual({
      files: [],
      mode: "full",
    });
  });

  it("formats the printed selection labels", () => {
    expect(formatSelectionLabel("docs-only")).toBe("docs-only fast gate");
    expect(formatSelectionLabel("full")).toBe("full gate");
    expect(formatScopeDecision(classifyChangedFiles(["docs/example.md"]))).toContain("Selected: docs-only fast gate");
    expect(formatScopeDecision(classifyChangedFiles(["package.json"]))).toContain("Selected: full gate");
  });

  it("prints the changed files and selection label from the CLI", () => {
    const scriptPath = path.join(process.cwd(), "scripts", "pr-gate-scope.cjs");
    expect(fs.existsSync(scriptPath)).toBe(true);

    const stdout = execFileSync(
      process.execPath,
      [scriptPath, "--print"],
      {
        cwd: process.cwd(),
        input: "docs/example.md\ndocs/roadmaps/SUMMARY.md\n",
        encoding: "utf8",
      },
    );

    expect(stdout).toContain("Changed files:");
    expect(stdout).toContain("- docs/example.md");
    expect(stdout).toContain("Selected: docs-only fast gate");
  });
});
