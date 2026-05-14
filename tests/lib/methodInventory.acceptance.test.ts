import { describe, expect, it } from "@jest/globals";
import { getMethodInventory } from "@/app/m/_lib/methodInventory";
import { deriveStandard } from "@/lib/methodBadge";

describe("getMethodInventory cross-standard discovery", () => {
  it("includes Verra methods", async () => {
    const { methods } = await getMethodInventory();
    const verraMethods = methods.filter((m) => deriveStandard(m.program) === "Verra");
    expect(verraMethods.length).toBeGreaterThanOrEqual(2);
    const codes = verraMethods.map((m) => m.code);
    expect(codes).toContain("VM0007");
    expect(codes).toContain("VM0047");
  });

  it("includes UNFCCC methods alongside Verra", async () => {
    const { methods } = await getMethodInventory();
    const unfcccMethods = methods.filter((m) => deriveStandard(m.program) === "UNFCCC");
    expect(unfcccMethods.length).toBeGreaterThanOrEqual(1);
    const verraMethods = methods.filter((m) => deriveStandard(m.program) === "Verra");
    expect(verraMethods.length).toBeGreaterThanOrEqual(2);
  });

  it("does not include GS-00XX", async () => {
    const { methods } = await getMethodInventory();
    const codes = methods.map((m) => m.code);
    expect(codes).not.toContain("GS-00XX");
  });
});
