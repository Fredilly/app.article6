import { describe, expect, it } from "@jest/globals";
import { getMethodInventory } from "@/app/m/_lib/methodInventory";
import { deriveStandard } from "@/lib/methodBadge";

describe("getMethodInventory real Verra import", () => {
  it("includes VM0007 and VM0047", async () => {
    const { methods } = await getMethodInventory();
    const codes = methods.map((m) => m.code);
    expect(codes).toContain("VM0007");
    expect(codes).toContain("VM0047");
  });

  it("includes UNFCCC methods alongside Verra", async () => {
    const { methods } = await getMethodInventory();
    const unfcccMethods = methods.filter((m) => deriveStandard(m.program) === "UNFCCC");
    expect(unfcccMethods.length).toBeGreaterThanOrEqual(1);
  });

  it("includes at least 2 Verra methods", async () => {
    const { methods } = await getMethodInventory();
    const verraMethods = methods.filter((m) => deriveStandard(m.program) === "Verra");
    expect(verraMethods.length).toBeGreaterThanOrEqual(2);
  });

  it("does not include GS-00XX", async () => {
    const { methods } = await getMethodInventory();
    const codes = methods.map((m) => m.code);
    expect(codes).not.toContain("GS-00XX");
  });

  it("VM0007 latest version is v1-8", async () => {
    const { methods } = await getMethodInventory();
    const vm = methods.find((m) => m.code === "VM0007");
    expect(vm).toBeDefined();
    expect(vm!.latestVersion).toBe("v1-8");
  });

  it("VM0047 latest version is v1-0", async () => {
    const { methods } = await getMethodInventory();
    const vm = methods.find((m) => m.code === "VM0047");
    expect(vm).toBeDefined();
    expect(vm!.latestVersion).toBe("v1-0");
  });

  it("VM0007 has 58 rules in latest version", async () => {
    const { methods } = await getMethodInventory();
    const vm = methods.find((m) => m.code === "VM0007");
    expect(vm).toBeDefined();
    expect(vm!.ruleCountByVersion["v1-8"]).toBe(58);
  });

  it("VM0047 has 11 rules in latest version", async () => {
    const { methods } = await getMethodInventory();
    const vm = methods.find((m) => m.code === "VM0047");
    expect(vm).toBeDefined();
    expect(vm!.ruleCountByVersion["v1-0"]).toBe(11);
  });
});
