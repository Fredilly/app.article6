const REGION_NAMES = typeof Intl.DisplayNames === "function"
  ? new Intl.DisplayNames(["en"], { type: "region" as Intl.DisplayNamesOptions["type"] })
  : null;

const COUNTRY_NAMES = REGION_NAMES
  ? Array.from({ length: 26 }, (_, first) => String.fromCharCode(65 + first))
    .flatMap((first) => Array.from({ length: 26 }, (_, second) => `${first}${String.fromCharCode(65 + second)}`))
    .map((code) => REGION_NAMES.of(code)?.trim())
    .filter((name): name is string => Boolean(name && name.length > 2 && name !== "Unknown Region" && name !== "world"))
    .sort((left, right) => right.length - left.length)
  : [];

/** Extract a country name from identity/location prose without a document-specific list. */
export function extractCountryName(value: string): string | null {
  for (const country of COUNTRY_NAMES) {
    const escaped = country.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(value)) return country;
  }
  return null;
}
