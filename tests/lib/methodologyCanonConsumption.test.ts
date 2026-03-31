import { probeMethodRich } from "@/app/m/_lib/methodRich";
import { loadMethodRules } from "@/app/m/_lib/methodRules";
import { loadMethodSections } from "@/app/m/_lib/methodSections";

describe("methodology canon consumption", () => {
  test("loads rich rules from the synced methodology pack", async () => {
    const result = await loadMethodRules("AR-AM0014", "v03-0");

    expect(result.source).toBe("rules.rich.json");
    expect(result.byId.has("UNFCCC.Forestry.AR-AM0014.v03-0.R-1-0001")).toBe(true);
  });

  test("loads rich sections from the synced methodology pack", async () => {
    const result = await loadMethodSections("AR-AM0014", "v03-0");

    expect(result.source).toBe("sections.rich.json");
    expect(result.byId.get("S-1")?.title).toBe("Scope and applicability");
  });

  test("probes rich methodology artifacts from the synced methodology pack", async () => {
    const result = await probeMethodRich("AR-AM0014", "v03-0");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.sources).toEqual(expect.arrayContaining(["rules.rich.json", "sections.rich.json"]));
  });
});
