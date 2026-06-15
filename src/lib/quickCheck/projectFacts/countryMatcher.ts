const ISO_COUNTRY_CODES = [
  "AF", "AL", "DZ", "AD", "AO", "AG", "AR", "AM", "AU", "AT", "AZ", "BS", "BH", "BD", "BB", "BY", "BE", "BZ",
  "BJ", "BT", "BO", "BA", "BW", "BR", "BN", "BG", "BF", "BI", "CV", "KH", "CM", "CA", "CF", "TD", "CL", "CN",
  "CO", "KM", "CG", "CD", "CR", "CI", "HR", "CU", "CY", "CZ", "DK", "DJ", "DM", "DO", "EC", "EG", "SV", "GQ",
  "ER", "EE", "SZ", "ET", "FJ", "FI", "FR", "GA", "GM", "GE", "DE", "GH", "GR", "GD", "GT", "GN", "GW", "GY",
  "HT", "HN", "HU", "IS", "IN", "ID", "IR", "IQ", "IE", "IL", "IT", "JM", "JP", "JO", "KZ", "KE", "KI", "KP",
  "KR", "KW", "KG", "LA", "LV", "LB", "LS", "LR", "LY", "LI", "LT", "LU", "MG", "MW", "MY", "MV", "ML", "MT",
  "MH", "MR", "MU", "MX", "FM", "MD", "MC", "MN", "ME", "MA", "MZ", "MM", "NA", "NR", "NP", "NL", "NZ", "NI",
  "NE", "NG", "MK", "NO", "OM", "PK", "PW", "PA", "PG", "PY", "PE", "PH", "PL", "PT", "QA", "RO", "RU", "RW",
  "KN", "LC", "VC", "WS", "SM", "ST", "SA", "SN", "RS", "SC", "SL", "SG", "SK", "SI", "SB", "SO", "ZA", "SS",
  "ES", "LK", "SD", "SR", "SE", "CH", "SY", "TJ", "TZ", "TH", "TL", "TG", "TO", "TT", "TN", "TR", "TM", "TV",
  "UG", "UA", "AE", "GB", "US", "UY", "UZ", "VU", "VA", "VE", "VN", "YE", "ZM", "ZW",
] as const;

const COUNTRY_ALIASES: Array<{ alias: string; canonical: string }> = [
  { alias: "bolivia", canonical: "Bolivia" },
  { alias: "bolivia plurinational state of", canonical: "Bolivia" },
  { alias: "cape verde", canonical: "Cape Verde" },
  { alias: "cabo verde", canonical: "Cape Verde" },
  { alias: "congo drc", canonical: "Democratic Republic of the Congo" },
  { alias: "democratic republic of congo", canonical: "Democratic Republic of the Congo" },
  { alias: "democratic republic of the congo", canonical: "Democratic Republic of the Congo" },
  { alias: "drc", canonical: "Democratic Republic of the Congo" },
  { alias: "guinea bissau", canonical: "Guinea-Bissau" },
  { alias: "guinea-bissau", canonical: "Guinea-Bissau" },
  { alias: "republic of guinea bissau", canonical: "Guinea-Bissau" },
  { alias: "republic of guinea-bissau", canonical: "Guinea-Bissau" },
  { alias: "ivory coast", canonical: "Cote d'Ivoire" },
  { alias: "lao pdr", canonical: "Laos" },
  { alias: "laos", canonical: "Laos" },
  { alias: "micronesia", canonical: "Micronesia" },
  { alias: "moldova", canonical: "Moldova" },
  { alias: "palestine", canonical: "Palestine" },
  { alias: "russia", canonical: "Russia" },
  { alias: "south korea", canonical: "South Korea" },
  { alias: "north korea", canonical: "North Korea" },
  { alias: "syria", canonical: "Syria" },
  { alias: "taiwan", canonical: "Taiwan" },
  { alias: "tanzania", canonical: "Tanzania" },
  { alias: "the bahamas", canonical: "Bahamas" },
  { alias: "the gambia", canonical: "Gambia" },
  { alias: "timor leste", canonical: "Timor-Leste" },
  { alias: "turkey", canonical: "Turkey" },
  { alias: "united kingdom", canonical: "United Kingdom" },
  { alias: "uk", canonical: "United Kingdom" },
  { alias: "united states", canonical: "United States" },
  { alias: "united states of america", canonical: "United States" },
  { alias: "usa", canonical: "United States" },
  { alias: "venezuela", canonical: "Venezuela" },
  { alias: "viet nam", canonical: "Vietnam" },
  { alias: "vietnam", canonical: "Vietnam" },
];

type CountryNameEntry = {
  alias: string;
  canonical: string;
};

function normalizeCountryText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[()'".,/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripLocationArtifacts(value: string): string {
  return value
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\b(?:figure|table|appendix)\s+\d+[\s.:].*$/gim, " ")
    .replace(/\bsource\s*:\s.*$/gim, " ")
    .replace(/\([^)]*(?:source|available at|http|www\.|gadm|global administrative areas|portugal|references?)\b[^)]*\)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCountryNameEntries(): CountryNameEntry[] {
  const seen = new Map<string, string>();
  const displayNames = typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

  for (const code of ISO_COUNTRY_CODES) {
    const displayName = displayNames?.of(code)?.trim();
    if (!displayName) continue;
    const normalized = normalizeCountryText(displayName);
    if (!normalized) continue;
    seen.set(normalized, displayName);
  }

  for (const alias of COUNTRY_ALIASES) {
    const normalizedAlias = normalizeCountryText(alias.alias);
    if (!normalizedAlias) continue;
    seen.set(normalizedAlias, alias.canonical);
  }

  return Array.from(seen.entries())
    .map(([alias, canonical]) => ({ alias, canonical }))
    .sort((left, right) => right.alias.length - left.alias.length);
}

const COUNTRY_NAME_ENTRIES = buildCountryNameEntries();

function exactCountryMatch(segment: string): CountryNameEntry | null {
  const normalized = normalizeCountryText(segment);
  if (!normalized) return null;
  return COUNTRY_NAME_ENTRIES.find((entry) => entry.alias === normalized) ?? null;
}

function embeddedCountryMatches(segment: string): CountryNameEntry[] {
  const normalized = ` ${normalizeCountryText(segment)} `;
  if (!normalized.trim()) return [];
  return COUNTRY_NAME_ENTRIES.filter((entry) => normalized.includes(` ${entry.alias} `));
}

export function extractCountryFromLocationText(value: string): string | null {
  const sanitizedValue = stripLocationArtifacts(value);
  if (/\brepublic of guinea[\s-]+bissau\b|\bguinea[\s-]+bissau\b/i.test(sanitizedValue)) return "Guinea-Bissau";
  if (/\bviet[\s-]+nam\b/i.test(sanitizedValue)) return "Vietnam";
  if (/\blao\s+pdr\b/i.test(sanitizedValue)) return "Laos";
  if (/\bdrc\b|\bdemocratic republic of (?:the )?congo\b/i.test(sanitizedValue)) return "Democratic Republic of the Congo";
  if (/\busa\b|\bunited states(?: of america)?\b/i.test(sanitizedValue)) return "United States";
  const segments = sanitizedValue
    .split(/[;,]/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => segment.replace(/^\s*(?:project location|location|geographic(?:al)? location|geographic(?:al)? reference|country\/area|country)\s*[:\-]?\s*/i, "").trim())
    .filter(Boolean);

  for (const segment of segments) {
    const exact = exactCountryMatch(segment);
    if (exact) return exact.canonical;
  }

  for (const segment of segments) {
    const embedded = embeddedCountryMatches(segment);
    if (embedded.length === 1) return embedded[0].canonical;
  }

  const fullText = normalizeCountryText(sanitizedValue);
  let earliest: { canonical: string; index: number; aliasLength: number } | null = null;
  for (const entry of COUNTRY_NAME_ENTRIES) {
    const index = fullText.indexOf(entry.alias);
    if (index < 0) continue;
    if (!earliest || index < earliest.index || (index === earliest.index && entry.alias.length > earliest.aliasLength)) {
      earliest = { canonical: entry.canonical, index, aliasLength: entry.alias.length };
    }
  }
  return earliest?.canonical ?? null;
}
