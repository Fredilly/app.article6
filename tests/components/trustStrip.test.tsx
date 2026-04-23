/** @jest-environment jsdom */

import { describe, expect, it, jest } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

const TrustStrip = require("@/components/TrustStrip").default as typeof import("@/components/TrustStrip").default;

const provenanceJson = {
  generated_at: "2026-04-22T10:00:00Z",
  generatedAt: "2026-04-22T10:00:00Z",
  repo: "Fredilly/app.article6",
  sha: "1234567890abcdef1234567890abcdef12345678",
};

describe("TrustStrip", () => {
  it("renders a compact Methods surface when requested", () => {
    const html = renderToStaticMarkup(
      <TrustStrip
        methodCode="UNFCCC.Forestry.AR-ACM0003"
        version="02.0"
        provenanceJson={provenanceJson}
        surface="methods"
      />,
    );

    expect(html).toContain("Download verification pack");
    expect(html).toContain("Last reviewed");
    expect(html).not.toContain("Trust strip");
    expect(html).not.toContain("Derived");
    expect(html).not.toContain("Advanced");
  });

  it("keeps the default trust surface unchanged elsewhere", () => {
    const html = renderToStaticMarkup(
      <TrustStrip
        methodCode="UNFCCC.Forestry.AR-ACM0003"
        version="02.0"
        provenanceJson={provenanceJson}
      />,
    );

    expect(html).toContain("Trust strip");
    expect(html).toContain("Derived");
    expect(html).toContain("Advanced");
    expect(html).toContain("Download verification pack");
  });
});
