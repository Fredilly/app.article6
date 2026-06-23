import type { NoiseContext } from "@/lib/quickCheck/evidence/evidenceTypes";

const CONTACT_EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const CONTACT_PHONE_RE = /(?:\+\d{1,3}[-.\s]?)?(?:\(\d{2,4}\)[-.\s]?){2,3}\d{2,6}/;
const CONTACT_URL_RE = /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.(?:com|org|net|io|gov|edu|int)\b/i;
const CONTACT_TITLE_RE = /\b(?:phone|tel|fax|email|e-mail|website|url|contact|for more information|for further information|coordinator|manager|director)\b/i;

const REFERENCE_RE = /\b(?:(?:[A-Z][a-z]+,\s[A-Z]\.\s*\(?\d{4}\)?)|(?:et al\.?,\s\d{4})|DOI[:\s]|(?:doi\.org\/)|(?:ISBN[:\s])|(?:ISSN[:\s]))/;
const BIBLIOGRAPHY_SECTION_RE = /\b(?:references?|bibliography|works cited|literature cited|citations?|sources?)\b/i;
const CAPTION_PREFIX_RE = /^(?:figure\s+\d+|fig\.?\s*\d+|table\s+\d+|map\s+\d+|chart\s+\d+|source\s*:|adapted\s+from|modified\s+from|reproduced\s+from|courtesy\s+of)\b/i;
const SOURCE_ATTRIBUTION_RE = /\b(?:source\s*:|adapted\s+from|modified\s+from|reproduced\s+from|courtesy\s+of)\b/i;
const TOC_EXPLICIT_RE = /^(?:table\s+of\s+contents|contents|list of figures|list of tables|list of abbreviations|acronyms? and abbreviations)$/i;
const TOC_LEADER_RE = /\.{3,}\s*\d+\s*$/;
const HEADER_FOOTER_DECLARATION_RE = /^(?:page\s+\d+(?:\s+of\s+\d+)?|\d+\s+of\s+\d+|v\d+(?:\.\d+)+|draft|confidential|for internal use only)\s*$/i;

export function detectNoiseContexts(
  text: string,
  options?: {
    blockType?: string;
    sectionHeading?: string;
    isPageEdge?: boolean;
    isRepeated?: boolean;
    page?: number | null;
    isFirstPage?: boolean;
  },
): NoiseContext[] {
  const contexts: NoiseContext[] = [];
  const trimmed = text.trim();
  if (!trimmed) return contexts;

  const isShort = trimmed.length < 160;
  const isStandalone = options?.blockType === "header" || options?.blockType === "footer" || isShort;

  if (options?.isRepeated && options?.isPageEdge) {
    contexts.push("header");
  }

  if (options?.blockType === "header" || (isShort && HEADER_FOOTER_DECLARATION_RE.test(trimmed))) {
    if (!contexts.includes("header")) contexts.push("header");
  }
  if (options?.blockType === "footer") {
    if (!contexts.includes("footer")) contexts.push("footer");
  }

  if (
    TOC_EXPLICIT_RE.test(trimmed) ||
    TOC_LEADER_RE.test(trimmed) ||
    options?.blockType === "toc"
  ) {
    contexts.push("toc");
  }

  if (
    CONTACT_EMAIL_RE.test(trimmed) ||
    CONTACT_PHONE_RE.test(trimmed) ||
    CONTACT_URL_RE.test(trimmed)
  ) {
    contexts.push("contact");
  }

  if (options?.sectionHeading && BIBLIOGRAPHY_SECTION_RE.test(options.sectionHeading)) {
    contexts.push("reference");
  }
  if (isStandalone && REFERENCE_RE.test(trimmed) && trimmed.length < 300) {
    contexts.push("reference");
  }

  if (isStandalone && CAPTION_PREFIX_RE.test(trimmed)) {
    contexts.push("source-caption");
  } else if (isStandalone && SOURCE_ATTRIBUTION_RE.test(trimmed)) {
    contexts.push("source-caption");
  }

  if (
    !contexts.includes("contact") &&
    (options?.sectionHeading &&
     CONTACT_TITLE_RE.test(options.sectionHeading))
  ) {
    contexts.push("contact");
  }

  if (
    options?.sectionHeading &&
    BIBLIOGRAPHY_SECTION_RE.test(options.sectionHeading) &&
    !contexts.includes("reference")
  ) {
    contexts.push("reference");
  }

  return contexts;
}

export function adjustReliabilityForNoise(
  reliability: import("@/lib/quickCheck/evidence/evidenceTypes").EvidenceSpanReliability,
  noise: NoiseContext[],
): import("@/lib/quickCheck/evidence/evidenceTypes").EvidenceSpanReliability {
  if (noise.includes("header") || noise.includes("footer")) {
    return "excluded";
  }
  if (noise.includes("toc")) {
    return "excluded";
  }
  if (noise.includes("source-caption")) {
    return "excluded";
  }
  if (noise.includes("contact")) {
    return "limited";
  }
  if (noise.includes("reference")) {
    return "limited";
  }
  return reliability;
}
