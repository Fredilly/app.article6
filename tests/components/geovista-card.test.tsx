import { describe, expect, test } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import GeoVistaCard from "@/components/assistant/GeoVistaCard";

describe("GeoVistaCard", () => {
  test("does not render Unavailable badge when mode is mock", () => {
    const html = renderToStaticMarkup(
      <GeoVistaCard
        verification={{
          mode: "mock",
          status: "not_run",
          summary: "GeoVista enabled (mock).",
          artifacts: [{ id: "geovista:section:S-1", kind: "section", ref_id: "S-1" }],
          generated_at: "2026-01-01T00:00:00Z",
        }}
      />,
    );

    expect(html).toContain("Mock");
    expect(html).not.toContain("Unavailable");
  });
});

