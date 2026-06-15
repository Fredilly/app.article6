import { describe, expect, it } from "@jest/globals";

import { extractCountryFromLocationText } from "@/lib/quickCheck/projectFacts/countryMatcher";

describe("countryMatcher", () => {
  it("extracts a country when the location lists country before subregion", () => {
    expect(extractCountryFromLocationText("Indonesia, Central Kalimantan")).toBe("Indonesia");
  });

  it("extracts a country when the location lists subregion before country", () => {
    expect(extractCountryFromLocationText("Central Kalimantan Province, Indonesia")).toBe("Indonesia");
  });

  it("normalizes common country aliases used in PDDs", () => {
    expect(extractCountryFromLocationText("Lao PDR, Vientiane Province")).toBe("Laos");
    expect(extractCountryFromLocationText("Sud-Ubangi Province, DRC")).toBe("Democratic Republic of the Congo");
  });

  it("returns null when a location contains only subregions", () => {
    expect(extractCountryFromLocationText("Central Kalimantan Province, Katingan Regency")).toBeNull();
  });
});
