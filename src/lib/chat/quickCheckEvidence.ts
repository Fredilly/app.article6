import type { EvidenceInventoryItem } from "@/lib/evidence/inventory";
import { unzlibSync } from "fflate";
import { getAttachmentBytes } from "@/lib/proofMap/attachments";
import type { EvidenceAttachment, PddFragment, WorkbookEvidenceAsset, WorkbookRecordGroup } from "@/lib/proofMap/types";

export type QuickCheckEvidenceFactCategory =
  | "boundary"
  | "coordinates"
  | "mapped-area"
  | "project-location"
  | "monitoring-plan"
  | "workbook-reference"
  | "monitoring-evidence"
  | "plot-count"
  | "reporting-period"
  | "monitoring-records"
  | "qa-summary";

export type QuickCheckEvidenceFact = {
  id: string;
  category: QuickCheckEvidenceFactCategory;
  summary: string;
  matchText: string;
  sourceLabel: string;
  detail?: string;
};

export type QuickCheckEvidenceAnalysis = {
  facts: QuickCheckEvidenceFact[];
  parsedEvidenceLabels: string[];
  documentTypes: string[];
  methodologyMentions: string[];
  extractionConfidence: number;
  warnings: string[];
  rawPddText?: string;
};

export type QuickCheckClaimIntent =
  | "boundary"
  | "project-area"
  | "mapped-area"
  | "aoi"
  | "coordinates"
  | "location"
  | "monitoring-plan";

type QuickCheckEvidenceSource = {
  evidenceId: string;
  sourceLabel: string;
  attachments: EvidenceAttachment[];
  pddFragments?: PddFragment[];
  inventoryItem?: EvidenceInventoryItem;
};

type ResolveAttachmentBytes = (attachmentId: string) => Promise<ArrayBuffer | null>;
export type QuickCheckResolvedPdfText = {
  text: string;
  engine: "pdf-parse" | "heuristic";
  methodologyMentions?: string[];
  warning?: string;
  diagnosticCode?:
    | "file-too-large"
    | "parser-failed"
    | "no-selectable-text"
    | "selected-methodology-mismatch"
    | "methodology-not-detected";
};
type ResolvePdfText = (input: {
  attachmentId: string;
  filename: string;
  mime: string;
  bytes: ArrayBuffer;
}) => Promise<QuickCheckResolvedPdfText | null>;

type QuickCheckRuleLike = {
  id: string;
  title: string;
  snippet: string;
  summary?: string;
  logic?: string;
  notes?: string;
  when?: string[];
  expectedEvidence?: string[];
  tags?: string[];
};

export type QuickCheckLocalRuleCandidate = {
  requirementId: string;
  requirementLabel: string;
  score: number;
};

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "your",
  "have",
  "has",
  "one",
  "item",
  "evidence",
  "claim",
  "project",
  "documented",
]);

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSnippetText(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/([A-Za-z])(\d)/g, "$1 $2")
      .replace(/(\d)([A-Za-z])/g, "$1 $2")
      .replace(/(\d)\s*-\s*(\d)/g, "$1 - $2")
      .replace(/\s*([,.;:!?])\s*/g, "$1 ")
      .replace(/\.{3,}/g, "...")
      .replace(/\b([A-Z]{2,})([A-Z][a-z])/g, "$1 $2"),
  );
}

function extractLabeledDetail(text: string, pattern: RegExp, maxLength = 120): string | undefined {
  const normalized = normalizeSnippetText(text);
  const flags = pattern.flags.includes("i") ? pattern.flags : `${pattern.flags}i`;
  const searchPattern = new RegExp(pattern.source, flags.replace(/g/g, ""));
  const match = searchPattern.exec(normalized);
  if (!match || typeof match.index !== "number") return undefined;

  const slice = normalized.slice(match.index);
  const nextSentenceBreak = slice.search(/[.;!?](?:\s|$)/);
  const candidate =
    nextSentenceBreak >= 0
      ? slice.slice(0, nextSentenceBreak + 1)
      : slice.slice(0, maxLength);
  const detail = normalizeSnippetText(candidate).replace(/\.{2,}/g, ".").trim();
  return detail.length > maxLength ? `${detail.slice(0, maxLength - 3).trimEnd()}...` : detail;
}

function extractReportingPeriodDetail(text: string): string | undefined {
  const normalized = normalizeSnippetText(text);
  const explicitDateRange =
    normalized.match(/\b\d{1,2}\s+[A-Z][a-z]+\s+\d{4}\s*(?:to|-)\s*\d{1,2}\s+[A-Z][a-z]+\s+\d{4}\b/) ??
    normalized.match(/\b\d{4}\s*Q[1-4]\s*(?:to|-)\s*\d{4}\s*Q[1-4]\b/i);

  if (explicitDateRange?.[0]) {
    return `Reporting period ${normalizeSnippetText(explicitDateRange[0])}.`;
  }

  return extractLabeledDetail(normalized, /(reporting period|monitoring period)\s*[:\-]?\s*/i);
}

function asLower(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stableFactId(input: { sourceLabel: string; category: QuickCheckEvidenceFactCategory; summary: string }): string {
  return `${input.sourceLabel}:${input.category}:${input.summary}`.toLowerCase().replace(/[^a-z0-9:]+/g, "-");
}

function addFact(
  next: Map<string, QuickCheckEvidenceFact>,
  input: Omit<QuickCheckEvidenceFact, "id">,
): void {
  const summary = normalizeWhitespace(input.summary);
  if (!summary) return;
  const key = `${input.category}::${summary.toLowerCase()}`;
  if (next.has(key)) return;
  next.set(key, {
    ...input,
    summary,
    matchText: normalizeWhitespace(input.matchText),
    id: stableFactId({ sourceLabel: input.sourceLabel, category: input.category, summary }),
  });
}

function decodePdfLiteral(value: string): string {
  return value
    .replace(/\\([nrtbf()\\])/g, (_, escaped: string) => {
      if (escaped === "n") return " ";
      if (escaped === "r") return " ";
      if (escaped === "t") return " ";
      if (escaped === "b") return " ";
      if (escaped === "f") return " ";
      return escaped;
    })
    .replace(/\\\d{1,3}/g, " ")
    .replace(/\\\r?\n/g, "");
}

function latin1BytesToString(bytes: Uint8Array): string {
  let output = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    output += String.fromCharCode(...chunk);
  }
  return output;
}

function latin1StringToBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) bytes[index] = value.charCodeAt(index) & 0xff;
  return bytes;
}

function ascii85DigitValue(charCode: number): number {
  return charCode - 33;
}

function decodeAscii85(input: Uint8Array): Uint8Array {
  const output: number[] = [];
  const chunk: number[] = [];
  let index = 0;

  while (index < input.length) {
    const charCode = input[index]!;
    index += 1;

    if (charCode === 0x7e) break;
    if (charCode === 0x3c && input[index] === 0x7e) {
      index += 1;
      continue;
    }
    if (charCode === 0x7a) {
      if (chunk.length) throw new Error("Invalid ASCII85 zero shortcut");
      output.push(0, 0, 0, 0);
      continue;
    }
    if (charCode <= 32) continue;
    if (charCode < 33 || charCode > 117) throw new Error("Invalid ASCII85 digit");

    chunk.push(ascii85DigitValue(charCode));
    if (chunk.length < 5) continue;

    let value = 0;
    for (const digit of chunk) value = value * 85 + digit;
    output.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
    chunk.length = 0;
  }

  if (chunk.length) {
    const originalLength = chunk.length;
    while (chunk.length < 5) chunk.push(84);
    let value = 0;
    for (const digit of chunk) value = value * 85 + digit;
    const tail = [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
    output.push(...tail.slice(0, originalLength - 1));
  }

  return new Uint8Array(output);
}

function hexToBytes(value: string): Uint8Array {
  const normalized = value.replace(/[^0-9A-Fa-f]/g, "");
  const bytes = new Uint8Array(Math.floor(normalized.length / 2));
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function decodePdfUnicodeHex(value: string): string {
  if (!value) return "";
  const bytes = hexToBytes(value);
  let output = "";

  for (let index = 0; index + 1 < bytes.length; index += 2) {
    const codeUnit = (bytes[index]! << 8) | bytes[index + 1]!;
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff && index + 3 < bytes.length) {
      const lowSurrogate = (bytes[index + 2]! << 8) | bytes[index + 3]!;
      output += String.fromCodePoint(((codeUnit - 0xd800) << 10) + (lowSurrogate - 0xdc00) + 0x10000);
      index += 2;
      continue;
    }
    output += String.fromCharCode(codeUnit);
  }

  return output;
}

type PdfObjectRecord = {
  id: string;
  body: string;
  dict: string;
  stream: string | null;
};

function extractPdfObjectStream(body: string): string | null {
  const marker = /stream\r?\n/.exec(body);
  if (!marker?.index && marker?.index !== 0) return null;
  const start = marker.index + marker[0].length;
  const end = body.indexOf("endstream", start);
  if (end === -1) return null;
  return body.slice(start, end).replace(/\r?\n$/, "");
}

function parsePdfObjects(raw: string): PdfObjectRecord[] {
  const next: PdfObjectRecord[] = [];
  for (const match of raw.matchAll(/(\d+)\s+\d+\s+obj([\s\S]*?)endobj/g)) {
    const id = match[1] ?? "";
    const body = match[2] ?? "";
    const dict = body.match(/<<([\s\S]*?)>>/)?.[1] ?? "";
    const stream = extractPdfObjectStream(body);
    next.push({ id, body, dict, stream });
  }
  return next;
}

function parsePdfStreamFilters(dict: string): string[] {
  const filterBlock = dict.match(/\/Filter\s*(\[[^\]]+\]|\/[A-Za-z0-9]+)/)?.[1] ?? "";
  if (!filterBlock) return [];
  return Array.from(filterBlock.matchAll(/\/([A-Za-z0-9]+)/g)).map((match) => match[1] ?? "").filter(Boolean);
}

function decodePdfStreamBytes(record: PdfObjectRecord): Uint8Array | null {
  if (!record.stream) return null;

  try {
    let bytes = latin1StringToBytes(record.stream);
    for (const filter of parsePdfStreamFilters(record.dict)) {
      if (filter === "ASCII85Decode" || filter === "A85") {
        bytes = decodeAscii85(bytes);
        continue;
      }
      if (filter === "FlateDecode" || filter === "Fl") {
        bytes = unzlibSync(bytes);
        continue;
      }
      return null;
    }
    return bytes;
  } catch {
    return null;
  }
}

function inflatePdfStream(record: PdfObjectRecord): string | null {
  const bytes = decodePdfStreamBytes(record);
  return bytes ? latin1BytesToString(bytes) : null;
}

function decodePdfHexText(value: string, cmap: Map<string, string>): string {
  if (!value || !cmap.size) return "";
  const keyLengths = Array.from(new Set(Array.from(cmap.keys()).map((key) => key.length))).sort((a, b) => b - a);
  const input = value.toUpperCase();
  let cursor = 0;
  let output = "";

  while (cursor < input.length) {
    let matched = false;
    for (const keyLength of keyLengths) {
      const chunk = input.slice(cursor, cursor + keyLength);
      if (chunk.length !== keyLength) continue;
      const resolved = cmap.get(chunk);
      if (!resolved) continue;
      output += resolved;
      cursor += keyLength;
      matched = true;
      break;
    }
    if (matched) continue;
    cursor += 2;
  }

  return output;
}

function buildPdfToUnicodeMaps(objects: PdfObjectRecord[]): Map<string, Map<string, string>> {
  const maps = new Map<string, Map<string, string>>();

  for (const object of objects) {
    const stream = inflatePdfStream(object);
    if (!stream || !stream.includes("begincmap")) continue;
    const cmap = new Map<string, string>();

    for (const block of stream.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
      for (const bfchar of block[1]!.matchAll(/<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/g)) {
        cmap.set(bfchar[1]!.toUpperCase(), decodePdfUnicodeHex(bfchar[2]!));
      }
    }

    for (const block of stream.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
      for (const range of block[1]!.matchAll(/<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/g)) {
        const [start, end, dest] = [range[1]!, range[2]!, range[3]!];
        if (dest.length > 4) continue;
        const width = start.length;
        let source = parseInt(start, 16);
        const sourceEnd = parseInt(end, 16);
        let destCodePoint = parseInt(dest, 16);
        if (!Number.isFinite(destCodePoint) || destCodePoint > 0x10ffff) continue;
        while (source <= sourceEnd && destCodePoint <= 0x10ffff) {
          cmap.set(source.toString(16).toUpperCase().padStart(width, "0"), String.fromCodePoint(destCodePoint));
          source += 1;
          destCodePoint += 1;
        }
      }
    }

    if (cmap.size) maps.set(object.id, cmap);
  }

  return maps;
}

function buildPdfResourceFontMaps(
  objects: PdfObjectRecord[],
  toUnicodeMaps: Map<string, Map<string, string>>,
): Map<string, Map<string, Map<string, string>>> {
  const byObjectId = new Map(objects.map((object) => [object.id, object]));
  const resourceMaps = new Map<string, Map<string, Map<string, string>>>();

  function resolveFontMaps(objectId: string, seen = new Set<string>()): Map<string, Map<string, string>> {
    if (seen.has(objectId)) return new Map();
    seen.add(objectId);

    const object = byObjectId.get(objectId);
    if (!object) return new Map();

    const fontMaps = new Map<string, Map<string, string>>();

    for (const match of object.body.matchAll(/\/(F\d+)\s+(\d+)\s+0\s+R/g)) {
      const alias = match[1] ?? "";
      const fontObject = byObjectId.get(match[2] ?? "");
      const toUnicodeId = fontObject?.dict.match(/\/ToUnicode\s+(\d+)\s+0\s+R/)?.[1] ?? null;
      if (!alias || !toUnicodeId) continue;
      const cmap = toUnicodeMaps.get(toUnicodeId);
      if (cmap?.size) fontMaps.set(alias, cmap);
    }

    for (const match of object.body.matchAll(/\/Font\s+(\d+)\s+0\s+R/g)) {
      const nested = resolveFontMaps(match[1] ?? "", seen);
      for (const [alias, cmap] of nested) {
        if (cmap.size) fontMaps.set(alias, cmap);
      }
    }

    return fontMaps;
  }

  for (const object of objects) {
    const fontMaps = resolveFontMaps(object.id);
    if (fontMaps.size) resourceMaps.set(object.id, fontMaps);
  }

  return resourceMaps;
}

function extractPageContentObjectIds(body: string): string[] {
  const direct = body.match(/\/Contents\s+(\d+)\s+0\s+R/)?.[1];
  if (direct) return [direct];

  const arrayBody = body.match(/\/Contents\s*\[([\s\S]*?)\]/)?.[1] ?? "";
  return Array.from(arrayBody.matchAll(/(\d+)\s+0\s+R/g)).map((match) => match[1] ?? "").filter(Boolean);
}

function extractEncodedPdfText(bytes: ArrayBuffer): string {
  const raw = latin1BytesToString(new Uint8Array(bytes));
  const objects = parsePdfObjects(raw);
  if (!objects.length) return "";

  const objectMap = new Map(objects.map((object) => [object.id, object]));
  const toUnicodeMaps = buildPdfToUnicodeMaps(objects);
  const resourceFontMaps = buildPdfResourceFontMaps(objects, toUnicodeMaps);
  const parts: string[] = [];

  for (const object of objects) {
    if (!/\/Type\s*\/Page\b/.test(object.body)) continue;
    const resourceId = object.body.match(/\/Resources\s+(\d+)\s+0\s+R/)?.[1] ?? null;
    const contentIds = extractPageContentObjectIds(object.body);
    if (!contentIds.length) continue;
    const fontMaps = resourceId ? (resourceFontMaps.get(resourceId) ?? new Map<string, Map<string, string>>()) : new Map<string, Map<string, string>>();

    for (const contentId of contentIds) {
      const contentObject = objectMap.get(contentId);
      if (!contentObject) continue;
      const stream = inflatePdfStream(contentObject);
      if (!stream) continue;

      let inTextBlock = false;
      let currentFont: string | null = null;
      const textTokens: string[] = [];
      const tokenPattern = /BT|ET|\/(F\d+)\s+\d+(?:\.\d+)?\s+Tf|<([0-9A-Fa-f]+)>|\(([^()]*)\)/g;

      for (const match of stream.matchAll(tokenPattern)) {
        if (match[0] === "BT") {
          inTextBlock = true;
          continue;
        }
        if (match[0] === "ET") {
          inTextBlock = false;
          currentFont = null;
          if (textTokens.length) {
            parts.push(textTokens.join(""));
            textTokens.length = 0;
          }
          continue;
        }
        if (!inTextBlock) continue;
        if (match[1]) {
          currentFont = match[1];
          continue;
        }
        if (match[2] && currentFont) {
          const decoded = decodePdfHexText(match[2], fontMaps.get(currentFont) ?? new Map());
          if (decoded.trim()) textTokens.push(decoded);
          continue;
        }
        if (match[3]) {
          const decoded = normalizeWhitespace(decodePdfLiteral(match[3]));
          if (decoded) textTokens.push(decoded);
        }
      }

      if (textTokens.length) parts.push(textTokens.join(""));
    }
  }

  return normalizeWhitespace(parts.join(" "));
}

function extractPdfLiteralStrings(raw: string): string[] {
  const next: string[] = [];
  let buffer = "";
  let depth = 0;
  let escaping = false;

  for (const char of raw) {
    if (depth > 0) {
      buffer += char;
    }
    if (escaping) {
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = true;
      continue;
    }
    if (char === "(") {
      if (depth === 0) buffer = "";
      depth += 1;
      continue;
    }
    if (char === ")" && depth > 0) {
      depth -= 1;
      if (depth === 0) {
        const decoded = normalizeWhitespace(decodePdfLiteral(buffer.slice(0, -1)));
        if (decoded.length >= 8) next.push(decoded);
        buffer = "";
      }
    }
  }

  return next;
}

function extractPrintableSequences(raw: string): string[] {
  return Array.from(
    new Set(
      (raw.match(/[A-Za-z][A-Za-z0-9,.;:()/_ \-\n]{20,}/g) ?? [])
        .map((entry) => normalizeWhitespace(entry))
        .filter((entry) => entry.length >= 16),
    ),
  );
}

export function extractPdfText(bytes: ArrayBuffer): string {
  const raw = latin1BytesToString(new Uint8Array(bytes));
  const encodedText = extractEncodedPdfText(bytes);
  const segments = encodedText
    ? [encodedText]
    : [...extractPdfLiteralStrings(raw), ...extractPrintableSequences(raw)];
  return normalizeWhitespace(Array.from(new Set(segments)).join(" "));
}

export function extractMethodologyMentions(text: string): string[] {
  const mentions = new Set<string>(text.match(/\b[A-Z]{2}-[A-Z]{3,}\d{4}\b/g) ?? []);

  for (const match of text.matchAll(/\b([A-Z]{2,})[\s/]+([A-Z]{2,}\d{4})\b/g)) {
    const prefix = match[1]?.trim();
    const suffix = match[2]?.trim();
    if (prefix && suffix) mentions.add(`${prefix}-${suffix}`);
  }

  // Standard-name-qualified methodology mentions (existing)
  for (const match of text.matchAll(
    /\b((?:Gold Standard|Verified Carbon Standard|Climate Action Reserve|American Carbon Registry)[A-Za-z0-9,./() -]{0,80}?(?:version|v)\s*\d+(?:\.\d+)*)\b/gi,
  )) {
    const phrase = normalizeWhitespace(match[1] ?? "");
    if (phrase) mentions.add(phrase);
  }

  // Verra / VCS standalone mentions
  for (const match of text.matchAll(/\b(Verra|VCS|CCB)\b/g)) {
    mentions.add(match[1]);
  }

  // Gold Standard standalone mention (common in PDD cover pages)
  for (const match of text.matchAll(/\b(Gold Standard)\b/gi)) {
    mentions.add(match[1]);
  }

  // Verified Carbon Standard (full name, standalone)
  for (const match of text.matchAll(/\b(Verified Carbon Standard)\b/gi)) {
    mentions.add(match[1]);
  }

  // VM-prefixed methodology codes: VM0007, VM 0007
  for (const match of text.matchAll(/\b(VM\d{4})\b/g)) {
    mentions.add(match[1]);
  }
  for (const match of text.matchAll(/\b(VM)\s+(\d{4})\b/g)) {
    mentions.add(`${match[1]}${match[2]}`);
  }

  // Requested Verra detection terms and related abbreviations.
  for (const match of text.matchAll(/\b(REDD\+\s+Methodology\s+Framework|REDD\+\s+MF)\b/gi)) {
    mentions.add(normalizeWhitespace(match[1] ?? ""));
  }
  for (const match of text.matchAll(/\b(VMD\d{4})\b/g)) {
    mentions.add(match[1]);
  }
  for (const match of text.matchAll(/\b(VMD)\s+(\d{4})\b/g)) {
    mentions.add(`${match[1]}${match[2]}`);
  }
  for (const match of text.matchAll(/\b(APD|ARR|RWE|APWD)\b/g)) {
    mentions.add(match[1]);
  }

  // UNFCCC methodology codes: ACM0010, AM0014, AMS-III.AU, AMS0007
  for (const match of text.matchAll(/\b((?:ACM|AM)\d{4})\b/g)) {
    mentions.add(match[1]);
  }
  for (const match of text.matchAll(/\bAMS[- ]?([A-Z0-9.]+)\b/gi)) {
    const suffix = String(match[1] ?? "").toUpperCase().replace(/\s+/g, "");
    if (suffix) mentions.add(`AMS-${suffix}`);
  }

  // VMR-prefixed methodology codes: VMR001, VMR 001
  for (const match of text.matchAll(/\b(VMR\d{3,4})\b/g)) {
    mentions.add(match[1]);
  }
  for (const match of text.matchAll(/\b(VMR)\s+(\d{3,4})\b/g)) {
    mentions.add(`${match[1]}${match[2]}`);
  }

  // Gold Standard for the Global Goals (GS4GG) and related
  for (const match of text.matchAll(/\b(GS4GG|Gold Standard for the Global Goals)\b/gi)) {
    mentions.add(match[1]);
  }

  // GS-prefixed methodology codes: GS-VER1, GS VER1, GS VER2
  for (const match of text.matchAll(/\bGS[- ]?(VER\d+)\b/gi)) {
    mentions.add(`GS-${match[1].toUpperCase()}`);
  }

  return Array.from(mentions).sort((a, b) => a.localeCompare(b));
}

function classifyDocumentType(source: QuickCheckEvidenceSource): string {
  const attachmentMimes = source.attachments.map((attachment) => attachment.mime);
  if (source.pddFragments?.length || attachmentMimes.includes("application/pdf")) return "PDD / PDF";
  if (source.attachments.some((attachment) => attachment.workbook_asset) || attachmentMimes.some((mime) => /(sheet|excel|csv)/i.test(mime))) {
    return "Workbook";
  }
  if (attachmentMimes.some((mime) => mime.startsWith("image/"))) return "Image";
  if (attachmentMimes.length > 0) return "Document";
  return "Unknown document";
}

function extractMatchSnippet(text: string, pattern: RegExp): string | undefined {
  const flags = pattern.flags.includes("i") ? pattern.flags : `${pattern.flags}i`;
  const globalSafePattern = new RegExp(pattern.source, flags.replace(/g/g, ""));
  const match = globalSafePattern.exec(text);
  if (!match || typeof match.index !== "number") return undefined;

  const start = Math.max(0, match.index - 48);
  const end = Math.min(text.length, match.index + match[0].length + 72);
  let snippet = text.slice(start, end);
  snippet = normalizeSnippetText(snippet);
  snippet = snippet.replace(new RegExp(`^${escapeRegExp(match[0])}\\s*[:.-]?\\s*`, "i"), `${match[0]} `);
  if (!snippet) return undefined;
  if (start > 0) snippet = `...${snippet}`;
  if (end < text.length) snippet = `${snippet}...`;
  return snippet.length > 140 ? `${snippet.slice(0, 137).trimEnd()}...` : snippet;
}

function derivePdfFactsFromText(text: string, sourceLabel: string): QuickCheckEvidenceFact[] {
  const haystack = asLower(text);
  const next = new Map<string, QuickCheckEvidenceFact>();

  const boundaryPattern = /(project boundary|boundary description|grouped activity boundary|boundary covers|eligibility boundary)/i;
  const coordinatesPattern =
    /(latitude|longitude|coordinates?|lat[./ ]*long|geographic coordinates?|decimal degrees?|\b-?\d{1,3}\.\d{2,}\s*,\s*-?\d{1,3}\.\d{2,}\b)/i;
  const mappedAreaPattern = /(area of interest|aoi|polygon|mapped area|project area|project geography|geographic area|shape file|shapefile|geojson|boundary map)/i;
  const locationPattern = /(project location|located in|district|province|municipality|coordinates of the project location|site location)/i;
  const monitoringPlanPattern = /(monitoring plan|monitoring procedures|monitoring approach|plan for monitoring)/i;
  const reportingPeriodPattern = /(reporting period|monitoring period|period covered|coverage period|\b20\d{2}\s*[-/]?\s*q[1-4]\b|\bq[1-4]\s*20\d{2}\b)/i;
  const workbookPattern = /(workbook|spreadsheet|excel)/i;
  const monitoringEvidencePattern = /(monitoring plan|monitoring report|monitoring records|monitoring data|monitoring procedures)/i;
  const projectAreaDetail = extractLabeledDetail(text, /(project area|project location)\s*[:\-]?\s*/i);
  const reportingPeriodDetail = extractReportingPeriodDetail(text);
  const monitoringClaimDetail = extractLabeledDetail(text, /(claim support|primary claim)\s*[:\-]?\s*/i);

  if (boundaryPattern.test(haystack)) {
    addFact(next, {
      category: "boundary",
      summary: "The project boundary is described in the PDD",
      matchText: "project boundary described",
      sourceLabel,
      detail: extractLabeledDetail(text, /(project boundary|boundary description)\s*[:\-]?\s*/i) ?? extractMatchSnippet(text, boundaryPattern),
    });
  }

  if (coordinatesPattern.test(haystack)) {
    addFact(next, {
      category: "coordinates",
      summary: "Project coordinates are present in the PDD",
      matchText: "project coordinates present",
      sourceLabel,
      detail: extractMatchSnippet(text, coordinatesPattern),
    });
  }

  if (mappedAreaPattern.test(haystack)) {
    addFact(next, {
      category: "mapped-area",
      summary: "The PDD references the mapped project area or AOI",
      matchText: "mapped project area referenced",
      sourceLabel,
      detail: projectAreaDetail ?? extractMatchSnippet(text, mappedAreaPattern),
    });
  }

  if (locationPattern.test(haystack)) {
    addFact(next, {
      category: "project-location",
      summary: "The project location is described in the PDD",
      matchText: "project location described",
      sourceLabel,
      detail: projectAreaDetail ?? extractMatchSnippet(text, locationPattern),
    });
  }

  if (monitoringPlanPattern.test(haystack)) {
    addFact(next, {
      category: "monitoring-plan",
      summary: "The project has a documented monitoring plan",
      matchText: "documented monitoring plan",
      sourceLabel,
      detail: extractMatchSnippet(text, monitoringPlanPattern),
    });
  }

  if (reportingPeriodPattern.test(haystack)) {
    addFact(next, {
      category: "reporting-period",
      summary: "The PDF states a monitoring or reporting period",
      matchText: "reporting period stated",
      sourceLabel,
      detail: reportingPeriodDetail ?? extractMatchSnippet(text, reportingPeriodPattern),
    });
  }

  if (workbookPattern.test(haystack)) {
    addFact(next, {
      category: "workbook-reference",
      summary: "The workbook is referenced in the PDD",
      matchText: "workbook referenced in pdd",
      sourceLabel,
      detail: extractMatchSnippet(text, workbookPattern),
    });
  }

  if (monitoringEvidencePattern.test(haystack)) {
    addFact(next, {
      category: "monitoring-evidence",
      summary: "The project has documented monitoring evidence",
      matchText: "documented monitoring evidence",
      sourceLabel,
      detail: monitoringClaimDetail,
    });
  }

  return Array.from(next.values());
}

export function classifyQuickCheckClaimIntents(claimText: string): QuickCheckClaimIntent[] {
  const haystack = asLower(claimText);
  const intents = new Set<QuickCheckClaimIntent>();

  if (/(boundary|delineat|perimeter)/.test(haystack)) intents.add("boundary");
  if (/(project area|project boundary area)/.test(haystack)) intents.add("project-area");
  if (/(mapped area|map area|mapped project area|map boundary)/.test(haystack)) intents.add("mapped-area");
  if (/(^|\W)aoi(\W|$)|area of interest/.test(haystack)) intents.add("aoi");
  if (/(coordinate|latitude|longitude|lat\/long|lat long)/.test(haystack)) intents.add("coordinates");
  if (/(location|located|district|province|municipality|site)/.test(haystack)) intents.add("location");
  if (/(monitoring plan|monitoring approach|monitoring procedures|monitoring report|reporting period|monitoring period)/.test(haystack)) intents.add("monitoring-plan");

  return Array.from(intents).sort((a, b) => a.localeCompare(b));
}

function derivePddFragmentFacts(fragments: PddFragment[], sourceLabel: string): QuickCheckEvidenceFact[] {
  const next = new Map<string, QuickCheckEvidenceFact>();
  for (const fragment of fragments) {
    const text = [fragment.label, fragment.section_label, fragment.section_heading, fragment.excerpt].filter(Boolean).join(" ");
    for (const fact of derivePdfFactsFromText(text, sourceLabel)) {
      addFact(next, fact);
    }
  }
  return Array.from(next.values());
}

function firstMatchingValue(group: WorkbookRecordGroup, pattern: RegExp): string | null {
  for (const row of group.rows) {
    for (const [key, value] of Object.entries(row)) {
      if (!pattern.test(key)) continue;
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
}

function uniqueMatchingValues(group: WorkbookRecordGroup, pattern: RegExp): string[] {
  const next = new Set<string>();
  for (const row of group.rows) {
    for (const [key, value] of Object.entries(row)) {
      if (!pattern.test(key)) continue;
      const trimmed = value.trim();
      if (trimmed) next.add(trimmed);
    }
  }
  return Array.from(next).sort((a, b) => a.localeCompare(b));
}

function deriveWorkbookFactsFromAsset(asset: WorkbookEvidenceAsset, sourceLabel: string): QuickCheckEvidenceFact[] {
  const next = new Map<string, QuickCheckEvidenceFact>();

  for (const group of asset.record_groups) {
    if (group.group_type === "sampling_log" || group.group_type === "activity_data_table" || group.group_type === "monitoring_period_table") {
      addFact(next, {
        category: "monitoring-records",
        summary: "The workbook contains monitoring records",
        matchText: "workbook monitoring records",
        sourceLabel,
      });
    }

    const plotValues = uniqueMatchingValues(group, /(plot|sample(_id)?|transect)/i);
    if (plotValues.length) {
      addFact(next, {
        category: "plot-count",
        summary: `Monitoring data exists for ${plotValues.length} ${plotValues.length === 1 ? "plot" : "plots"}`,
        matchText: `monitoring data ${plotValues.length} plots`,
        sourceLabel,
        detail: plotValues.slice(0, 5).join(", "),
      });
    }

    const period = firstMatchingValue(group, /(monitoring_period|reporting_period|period_start|period_end|quarter|q[1-4])/i);
    if (period) {
      addFact(next, {
        category: "reporting-period",
        summary: `The workbook contains ${period} monitoring records`,
        matchText: `${period} monitoring records`,
        sourceLabel,
      });
    }

    const qaValue = firstMatchingValue(group, /(qa|quality|review|checked|status)/i);
    if (qaValue || /(qa|quality|review)/i.test(`${group.display_name} ${group.source_sheet} ${group.column_names.join(" ")}`)) {
      addFact(next, {
        category: "qa-summary",
        summary: "The workbook includes QA summary evidence",
        matchText: "qa summary workbook evidence",
        sourceLabel,
        detail: qaValue ?? undefined,
      });
    }
  }

  return Array.from(next.values());
}

export async function analyzeQuickCheckEvidence(
  sources: QuickCheckEvidenceSource[],
  options?: { resolveAttachmentBytes?: ResolveAttachmentBytes; resolvePdfText?: ResolvePdfText },
): Promise<QuickCheckEvidenceAnalysis> {
  const facts = new Map<string, QuickCheckEvidenceFact>();
  const parsedEvidenceLabels = new Set<string>();
  const documentTypes = new Set<string>();
  const methodologyMentions = new Set<string>();
  const warningSet = new Set<string>();
  const rawPddTextParts: string[] = [];
  const resolveAttachmentBytes = options?.resolveAttachmentBytes ?? getAttachmentBytes;
  const resolvePdfText = options?.resolvePdfText;

  for (const source of sources) {
    documentTypes.add(classifyDocumentType(source));
    if (source.pddFragments?.length) {
      parsedEvidenceLabels.add(source.sourceLabel);
      for (const mention of extractMethodologyMentions(source.pddFragments.map((fragment) =>
        [fragment.label, fragment.section_label, fragment.section_heading, fragment.excerpt].filter(Boolean).join(" "),
      ).join(" "))) {
        methodologyMentions.add(mention);
      }
      for (const fact of derivePddFragmentFacts(source.pddFragments, source.sourceLabel)) {
        addFact(facts, fact);
      }
    }

    const workbookAssets = source.attachments.map((attachment) => attachment.workbook_asset).filter(Boolean) as WorkbookEvidenceAsset[];
    for (const asset of workbookAssets) {
      parsedEvidenceLabels.add(source.sourceLabel);
      for (const mention of extractMethodologyMentions(JSON.stringify(asset))) {
        methodologyMentions.add(mention);
      }
      for (const fact of deriveWorkbookFactsFromAsset(asset, source.sourceLabel)) {
        addFact(facts, fact);
      }
    }

    for (const attachment of source.attachments) {
      if (attachment.mime !== "application/pdf") continue;
      const bytes = await resolveAttachmentBytes(attachment.id).catch(() => null);
      if (!bytes) continue;
      let text = "";
      if (resolvePdfText) {
        try {
          const resolved = await resolvePdfText({
            attachmentId: attachment.id,
            filename: attachment.filename,
            mime: attachment.mime,
            bytes,
          });
          text = resolved?.text ?? "";
          if (resolved?.warning) warningSet.add(resolved.warning);
          for (const mention of resolved?.methodologyMentions ?? []) {
            methodologyMentions.add(mention);
          }
        } catch {
          text = extractPdfText(bytes);
        }
      } else {
        text = extractPdfText(bytes);
      }
      if (!text) continue;
      parsedEvidenceLabels.add(source.sourceLabel);
      rawPddTextParts.push(text);
      for (const mention of extractMethodologyMentions(text)) {
        methodologyMentions.add(mention);
      }
      for (const fact of derivePdfFactsFromText(text, source.sourceLabel)) {
        addFact(facts, fact);
      }
    }
  }

  const warnings = Array.from(warningSet);
  if (!parsedEvidenceLabels.size) {
    warnings.push("We couldn't extract usable text from this file yet.");
  } else if (!facts.size) {
    warnings.push("We parsed the file, but couldn't extract enough requirement-relevant facts yet.");
  }
  if (parsedEvidenceLabels.size && !methodologyMentions.size) {
    warnings.push("No methodology mentions were detected in the uploaded evidence.");
  }

  const extractionConfidence =
    !parsedEvidenceLabels.size
      ? 0.12
      : !facts.size
      ? 0.28
      : Math.min(0.92, 0.42 + Math.min(facts.size, 4) * 0.11 + (methodologyMentions.size ? 0.06 : 0));

  return {
    facts: Array.from(facts.values()),
    parsedEvidenceLabels: Array.from(parsedEvidenceLabels).sort((a, b) => a.localeCompare(b)),
    documentTypes: Array.from(documentTypes).sort((a, b) => a.localeCompare(b)),
    methodologyMentions: Array.from(methodologyMentions).sort((a, b) => a.localeCompare(b)),
    extractionConfidence,
    warnings,
    rawPddText: rawPddTextParts.length > 0 ? rawPddTextParts.join("\n\n") : undefined,
  };
}

function queryTextForIntent(intent: QuickCheckClaimIntent): string {
  if (intent === "boundary") return "project boundary requirement";
  if (intent === "project-area") return "project area requirement";
  if (intent === "mapped-area") return "mapped area boundary";
  if (intent === "aoi") return "area of interest boundary";
  if (intent === "coordinates") return "project coordinates boundary";
  if (intent === "location") return "project location boundary";
  return "documented monitoring plan";
}

export function buildQuickCheckQueryTexts(
  claimText: string,
  facts: QuickCheckEvidenceFact[],
  claimIntents: QuickCheckClaimIntent[] = classifyQuickCheckClaimIntents(claimText),
): string[] {
  const next = new Set<string>();
  const claim = normalizeWhitespace(claimText);
  if (claim) next.add(claim);
  for (const fact of facts.slice(0, 4)) {
    if (fact.matchText) next.add(fact.matchText);
  }
  for (const intent of claimIntents) {
    next.add(queryTextForIntent(intent));
  }
  return Array.from(next);
}

function tokenize(value: string): string[] {
  return normalizeWhitespace(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function scoreRuleAgainstFacts(rule: QuickCheckRuleLike, facts: QuickCheckEvidenceFact[]): number {
  const haystack = asLower(
    [
      rule.title,
      rule.snippet,
      rule.summary,
      rule.logic,
      rule.notes,
      ...(rule.when ?? []),
      ...(rule.expectedEvidence ?? []),
      ...(rule.tags ?? []),
    ]
      .filter(Boolean)
      .join(" "),
  );
  let score = 0;

  for (const fact of facts) {
    if (fact.category === "boundary" && haystack.includes("boundary")) score += 1.25;
    if (
      fact.category === "coordinates" &&
      (haystack.includes("coordinate") || haystack.includes("location") || haystack.includes("boundary") || haystack.includes("map"))
    ) {
      score += 1.05;
    }
    if (
      fact.category === "mapped-area" &&
      (haystack.includes("mapped area") || haystack.includes("project area") || haystack.includes("aoi") || haystack.includes("polygon") || haystack.includes("boundary") || haystack.includes("map"))
    ) {
      score += 1.2;
    }
    if (
      fact.category === "project-location" &&
      (haystack.includes("location") || haystack.includes("boundary") || haystack.includes("area") || haystack.includes("map"))
    ) {
      score += 1;
    }
    if (fact.category === "monitoring-plan" && haystack.includes("monitoring") && (haystack.includes("plan") || haystack.includes("report"))) {
      score += 1.15;
    }
    if (fact.category === "workbook-reference" && (haystack.includes("workbook") || haystack.includes("spreadsheet"))) score += 0.9;
    if (fact.category === "monitoring-evidence" && haystack.includes("monitoring")) score += 0.8;
    if (fact.category === "plot-count" && (haystack.includes("plot") || haystack.includes("sampling") || haystack.includes("monitoring"))) score += 1;
    if (fact.category === "reporting-period" && (haystack.includes("period") || haystack.includes("monitoring"))) score += 1;
    if (fact.category === "monitoring-records" && (haystack.includes("monitoring") || haystack.includes("workbook"))) score += 0.85;
    if (fact.category === "qa-summary" && (haystack.includes("qa") || haystack.includes("quality") || haystack.includes("review"))) score += 0.8;
  }

  return score;
}

function scoreRuleAgainstClaimIntents(rule: QuickCheckRuleLike, claimIntents: QuickCheckClaimIntent[]): number {
  const haystack = asLower(
    [
      rule.id,
      rule.title,
      rule.snippet,
      rule.summary,
      rule.logic,
      rule.notes,
      ...(rule.when ?? []),
      ...(rule.expectedEvidence ?? []),
      ...(rule.tags ?? []),
    ]
      .filter(Boolean)
      .join(" "),
  );
  let score = 0;

  for (const intent of claimIntents) {
    if (intent === "boundary" && haystack.includes("boundary")) score += 0.9;
    if (intent === "project-area" && (haystack.includes("project area") || haystack.includes("boundary") || haystack.includes("area"))) score += 0.8;
    if (intent === "mapped-area" && (haystack.includes("mapped area") || haystack.includes("map") || haystack.includes("boundary"))) score += 0.9;
    if (intent === "aoi" && (haystack.includes("aoi") || haystack.includes("area of interest") || haystack.includes("polygon") || haystack.includes("boundary"))) score += 0.85;
    if (intent === "coordinates" && (haystack.includes("coordinate") || haystack.includes("location") || haystack.includes("boundary"))) score += 0.85;
    if (intent === "location" && (haystack.includes("location") || haystack.includes("site") || haystack.includes("district") || haystack.includes("boundary"))) score += 0.75;
    if (intent === "monitoring-plan" && haystack.includes("monitoring") && (haystack.includes("plan") || haystack.includes("report"))) score += 0.8;
  }

  return score;
}

export function buildLocalRuleCandidates(input: {
  claimText: string;
  facts: QuickCheckEvidenceFact[];
  rules: QuickCheckRuleLike[];
  claimIntents?: QuickCheckClaimIntent[];
  minimumScore?: number;
}): QuickCheckLocalRuleCandidate[] {
  const claimKeywords = tokenize(input.claimText);
  const claimIntents = input.claimIntents ?? classifyQuickCheckClaimIntents(input.claimText);

  return input.rules
    .map((rule) => {
      const haystack = asLower(
        [
          rule.id,
          rule.title,
          rule.snippet,
          rule.summary,
          rule.logic,
          rule.notes,
          ...(rule.when ?? []),
          ...(rule.expectedEvidence ?? []),
          ...(rule.tags ?? []),
        ]
          .filter(Boolean)
          .join(" "),
      );
      let score = scoreRuleAgainstFacts(rule, input.facts);
      score += scoreRuleAgainstClaimIntents(rule, claimIntents);
      for (const keyword of claimKeywords) {
        if (haystack.includes(keyword)) score += keyword.length >= 7 ? 0.45 : 0.25;
      }
      return {
        requirementId: rule.id,
        requirementLabel: `${rule.id} · ${rule.title}`,
        score,
      };
    })
    .filter((candidate) => candidate.score >= (input.minimumScore ?? 1.2))
    .sort((a, b) => b.score - a.score || a.requirementLabel.localeCompare(b.requirementLabel))
    .slice(0, 4);
}
