import { describe, expect, test } from "@jest/globals";
import { filterMethods } from "@/components/manifest/MethodsInventoryApp";
import type { MethodInventoryItem } from "@/app/m/_lib/methodInventory";

function method(partial: Partial<MethodInventoryItem>): MethodInventoryItem {
  return {
    code: partial.code ?? "METH",
    program: partial.program ?? "Program",
    sector: partial.sector ?? "Sector",
    versions: partial.versions ?? ["v1-0"],
    latestVersion: partial.latestVersion ?? "v1-0",
    versionCount: partial.versionCount ?? (partial.versions?.length ?? 1),
    ruleCountByVersion: partial.ruleCountByVersion ?? { "v1-0": 10 },
    hasRich: partial.hasRich ?? false,
    hasPrevious: partial.hasPrevious ?? false,
    generated_at: partial.generated_at,
    source_sha: partial.source_sha,
    audit_hashes: partial.audit_hashes,
    versionAuditHashes: partial.versionAuditHashes ?? {},
  };
}

describe("MethodsInventoryApp filtering", () => {
  test("filters by query against method fields", () => {
    const methods = [
      method({ code: "AR-AM0014", program: "UNFCCC", sector: "Forestry" }),
      method({ code: "VM0001", program: "Verra", sector: "Energy" }),
    ];

    const filtered = filterMethods(methods, {
      query: "unfccc",
      program: "all",
      sector: "all",
      richOnly: false,
      hasPreviousOnly: false,
    });

    expect(filtered.map((m) => m.code)).toEqual(["AR-AM0014"]);
  });

  test("filters by program/sector and flags", () => {
    const methods = [
      method({ code: "A", program: "UNFCCC", sector: "Forestry", hasRich: true }),
      method({ code: "B", program: "UNFCCC", sector: "Energy", hasRich: false }),
      method({ code: "C", program: "Verra", sector: "Forestry", hasRich: true, hasPrevious: true }),
    ];

    const filtered = filterMethods(methods, {
      query: "",
      program: "unfccc",
      sector: "forestry",
      richOnly: true,
      hasPreviousOnly: false,
    });

    expect(filtered.map((m) => m.code)).toEqual(["A"]);
  });
});

