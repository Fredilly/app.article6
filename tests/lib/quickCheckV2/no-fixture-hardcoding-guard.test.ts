import { describe, expect, it } from "@jest/globals";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SCRIPT_PATH = path.resolve("scripts/quickcheck/check-no-fixture-hardcoding.mjs");

function git(cwd: string, args: string[]) {
  execFileSync("git", args, { cwd, stdio: "pipe" });
}

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function initRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "no-fixture-hardcoding-"));
  git(root, ["init"]);
  git(root, ["config", "user.email", "codex@example.com"]);
  git(root, ["config", "user.name", "Codex"]);
  return root;
}

function commitAll(cwd: string, message: string) {
  git(cwd, ["add", "."]);
  git(cwd, ["commit", "-m", message]);
}

function runGuard(cwd: string) {
  return spawnSync("node", [SCRIPT_PATH, "--base-ref", "HEAD~1"], {
    cwd,
    encoding: "utf8",
    env: process.env,
  });
}

describe("quickcheck no-fixture-hardcoding guard", () => {
  it("allows reusable methodology registry data in src/lib/quickCheckV2", () => {
    const root = initRepo();
    try {
      writeFile(
        path.join(root, "src/lib/quickCheckV2/methodologyRegistry.ts"),
        ["export const METHODOLOGY_REGISTRY = {};", ""].join("\n"),
      );
      commitAll(root, "base");

      writeFile(
        path.join(root, "src/lib/quickCheckV2/methodologyRegistry.ts"),
        [
          "export const METHODOLOGY_REGISTRY = {",
          "  VM0007: {",
          '    methodologyId: "VM0007",',
          '    methodologyName: "REDD+ Methodology Framework",',
          '    versions: ["v1.8"],',
          "  },",
          "};",
          "",
        ].join("\n"),
      );
      commitAll(root, "registry data");

      const result = runGuard(root);
      expect(result.status).toBe(0);
      const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
      expect(output).toContain("ok");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("flags obvious fixture-shaped source hardcoding in src/lib/quickCheckV2", () => {
    const root = initRepo();
    try {
      writeFile(
        path.join(root, "src/lib/quickCheckV2/guard-target.ts"),
        [
          "export function demoGuard(block: { page: number }, quote: string) {",
          '  return "generic source";',
          "}",
          "",
        ].join("\n"),
      );
      writeFile(
        path.join(root, "tests/fixtures/quick-check/v2/demo-fixture/meta.json"),
        JSON.stringify(
          {
            id: "demo-fixture",
            title: "Demo Fixture Project",
            documentId: "demo-fixture-document",
          },
          null,
          2,
        ),
      );
      writeFile(
        path.join(root, "tests/fixtures/quick-check/v2/demo-fixture/gold.json"),
        JSON.stringify(
          [
            {
              checkName: "methodology",
              expectedStatus: "FOUND",
              expectedAnswer: "VM0007 REDD+ Methodology Framework v1.8",
              goldQuote: "Demo gold quote.",
              page: 1,
              sectionHeading: null,
              sectionPath: ["1"],
              spanId: "demo-fixture-extracted:p1:b1:deadbeef",
              sourceType: "fact_contract",
            },
          ],
          null,
          2,
        ),
      );
      commitAll(root, "base");

      writeFile(
        path.join(root, "src/lib/quickCheckV2/guard-target.ts"),
        [
          "export function demoGuard(block: { page: number }, quote: string) {",
          '  if (block.page === 47) return "The project activities would not occur without carbon finance due to substantial financial barriers.";',
          '  if (quote.includes("VM0048") && quote.includes("VM0007")) return "VM0007 REDD+ Methodology Framework v1.8";',
          '  return "demo-fixture";',
          "}",
          "",
        ].join("\n"),
      );
      commitAll(root, "guarded change");

      const result = runGuard(root);
      expect(result.status).not.toBe(0);
      const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
      expect(output).toContain("page gate");
      expect(output).toContain("methodology pair special case");
      expect(output).toContain("exact gold answer string");
      expect(output).toContain("project-specific fixture id/title");
      expect(output).toContain("src/lib/quickCheckV2/guard-target.ts");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("allows document-specific fixture text under tests/fixtures/quick-check/v2", () => {
    const root = initRepo();
    try {
      writeFile(
        path.join(root, "src/lib/quickCheckV2/guard-target.ts"),
        [
          "export function okGuard() {",
          '  return "generic source";',
          "}",
          "",
        ].join("\n"),
      );
      writeFile(
        path.join(root, "tests/fixtures/quick-check/v2/demo-fixture/meta.json"),
        JSON.stringify(
          {
            id: "demo-fixture",
            title: "Demo Fixture Project",
            documentId: "demo-fixture-document",
          },
          null,
          2,
        ),
      );
      writeFile(
        path.join(root, "tests/fixtures/quick-check/v2/demo-fixture/gold.json"),
        JSON.stringify(
          [
            {
              checkName: "host_country",
              expectedStatus: "FOUND",
              expectedAnswer: "Belize",
              goldQuote: "Project location Belize, Cayo Districts.",
              page: 1,
              sectionHeading: null,
              sectionPath: ["1"],
              spanId: "demo-fixture-extracted:p1:b1:deadbeef",
              sourceType: "fact_contract",
            },
          ],
          null,
          2,
        ),
      );
      commitAll(root, "base");

      writeFile(
        path.join(root, "tests/fixtures/quick-check/v2/demo-fixture/gold.json"),
        JSON.stringify(
          [
            {
              checkName: "host_country",
              expectedStatus: "FOUND",
              expectedAnswer: "Belize",
              goldQuote: "Project location Belize, Cayo Districts.",
              page: 1,
              sectionHeading: null,
              sectionPath: ["1"],
              spanId: "demo-fixture-extracted:p1:b1:deadbeef",
              sourceType: "fact_contract",
            },
            {
              checkName: "methodology",
              expectedStatus: "FOUND",
              expectedAnswer: "Demo specific truth remains in fixtures.",
              goldQuote: "Document-specific fixture truth belongs here.",
              page: 2,
              sectionHeading: "Fixture truth",
              sectionPath: ["1", "1.1"],
              spanId: "demo-fixture-extracted:p2:b2:deadbeef",
              sourceType: "fact_contract",
            },
          ],
          null,
          2,
        ),
      );
      commitAll(root, "fixture update");

      const result = runGuard(root);
      expect(result.status).toBe(0);
      const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
      expect(output).toContain("ok");
      expect(output).toContain("changed=0");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
