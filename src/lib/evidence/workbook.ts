import JSZip from "jszip";
import { sha256Text } from "@/lib/proof/hash";
import type { WorkbookEvidenceAsset, WorkbookRecordGroup, WorkbookRecordGroupType, WorkbookSheetSummary } from "@/lib/proofMap/types";

type ParsedSheet = {
  sheet_name: string;
  sheet_index: number;
  bounds_ref: string | null;
  rows: string[][];
  warnings: string[];
};

const WORKBOOK_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
  "text/plain",
]);

function normalizeWorkbookMime(filename: string, mime: string): "xlsx" | "csv" | null {
  const lowerName = filename.trim().toLowerCase();
  const lowerMime = mime.trim().toLowerCase();
  if (lowerName.endsWith(".xlsx") || lowerMime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return "xlsx";
  if (lowerName.endsWith(".csv") || lowerMime === "text/csv" || lowerMime === "application/csv" || lowerMime === "application/vnd.ms-excel") {
    return "csv";
  }
  return null;
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function stripXml(value: string): string {
  return decodeXmlText(value.replace(/<[^>]+>/g, ""));
}

function columnNumberToLabel(value: number): string {
  let current = value;
  let out = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    out = String.fromCharCode(65 + remainder) + out;
    current = Math.floor((current - 1) / 26);
  }
  return out || "A";
}

function columnLabelToNumber(value: string): number {
  let next = 0;
  for (const ch of value.toUpperCase()) {
    if (ch < "A" || ch > "Z") continue;
    next = next * 26 + (ch.charCodeAt(0) - 64);
  }
  return next;
}

function parseCellRef(value: string): { row: number; column: number } | null {
  const match = value.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;
  return {
    column: columnLabelToNumber(match[1] ?? ""),
    row: Number(match[2] ?? "0"),
  };
}

function normalizeHeader(value: string, index: number, seen: Set<string>): string {
  const base =
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || `column_${index + 1}`;
  let candidate = base;
  let suffix = 2;
  while (seen.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  seen.add(candidate);
  return candidate;
}

function csvSplitLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index] ?? "";
    const next = line[index + 1] ?? "";
    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  out.push(current);
  return out.map((value) => value.replace(/\r/g, "").trim());
}

function parseCsvRows(text: string): string[][] {
  const normalized = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index] ?? "";
    const next = normalized[index + 1] ?? "";
    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
        current += char;
      }
      continue;
    }
    if (char === "\n" && !inQuotes) {
      rows.push(csvSplitLine(current));
      current = "";
      continue;
    }
    current += char;
  }
  if (current.length || normalized.endsWith(",")) rows.push(csvSplitLine(current));
  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
}

function workbookIdFor(input: { fileSha256: string; filename: string }): string {
  const compact = input.fileSha256.slice(0, 12) || input.filename.replace(/[^a-z0-9]/gi, "").slice(0, 12);
  return `wbk_${compact}`;
}

function summarizeRange(rowCount: number, columnCount: number): string | null {
  if (rowCount <= 0 || columnCount <= 0) return null;
  return `A1:${columnNumberToLabel(columnCount)}${rowCount}`;
}

function mapGroupType(input: { sheetName: string; headers: string[] }): WorkbookRecordGroupType | null {
  const haystack = `${input.sheetName} ${input.headers.join(" ")}`.toLowerCase();
  if (/(parameter|emission_factor|source_document|factor_source|coefficient|assumption)/.test(haystack)) {
    return "parameter_source_table";
  }
  if (/(formula|equation|calc|calculation|input_value|output_value|result)/.test(haystack)) {
    return "calculation_table";
  }
  if (/(activity|production|quantity|volume|consumption|meter|throughput)/.test(haystack)) {
    return "activity_data_table";
  }
  if (/(sample|sampling|plot|transect|visit_date|sample_id)/.test(haystack)) return "sampling_log";
  if (/(monitoring.*period|period_start|period_end|reporting_period|start_date|end_date)/.test(haystack)) {
    return "monitoring_period_table";
  }
  return null;
}

function buildSheetSummary(sheet: ParsedSheet, headerColumns: string[], headerRowRef: number | null): WorkbookSheetSummary {
  const rowCount = sheet.rows.length;
  const columnCount = sheet.rows.reduce((max, row) => Math.max(max, row.length), 0);
  return {
    sheet_name: sheet.sheet_name,
    sheet_index: sheet.sheet_index,
    row_count: rowCount,
    column_count: columnCount,
    bounds_ref: sheet.bounds_ref ?? summarizeRange(rowCount, columnCount),
    header_row_ref: headerRowRef,
    header_columns: headerColumns,
    warnings: [...sheet.warnings].sort((a, b) => a.localeCompare(b)),
  };
}

async function buildRecordGroup(input: {
  workbookId: string;
  filename: string;
  fileSha256: string;
  sheet: ParsedSheet;
}): Promise<{ summary: WorkbookSheetSummary; group: WorkbookRecordGroup | null }> {
  const firstDataRowIndex = input.sheet.rows.findIndex((row) => row.some((cell) => cell.trim().length > 0));
  if (firstDataRowIndex < 0) {
    return {
      summary: buildSheetSummary(input.sheet, [], null),
      group: null,
    };
  }

  const headerRaw = input.sheet.rows[firstDataRowIndex] ?? [];
  const seen = new Set<string>();
  const headerColumns = headerRaw.map((value, index) => normalizeHeader(value, index, seen));
  const summary = buildSheetSummary(input.sheet, headerColumns, firstDataRowIndex + 1);
  const body = input.sheet.rows.slice(firstDataRowIndex + 1).filter((row) => row.some((cell) => cell.trim().length > 0));
  if (headerColumns.length < 2 || body.length === 0) {
    return {
      summary: {
        ...summary,
        warnings: [...summary.warnings, "Structured table not detected"].sort((a, b) => a.localeCompare(b)),
      },
      group: null,
    };
  }

  const groupType = mapGroupType({ sheetName: input.sheet.sheet_name, headers: headerColumns });
  if (!groupType) {
    return {
      summary: {
        ...summary,
        warnings: [...summary.warnings, "No supported workbook evidence mapping"].sort((a, b) => a.localeCompare(b)),
      },
      group: null,
    };
  }

  const rows = body.map((row) =>
    Object.fromEntries(
      headerColumns.map((columnName, index) => [columnName, row[index]?.trim() ?? ""]),
    ),
  );
  const sourceRange = input.sheet.bounds_ref ?? summarizeRange(input.sheet.rows.length, headerColumns.length);
  const groupHash = await sha256Text(
    JSON.stringify({
      workbook_id: input.workbookId,
      sheet: input.sheet.sheet_name,
      group_type: groupType,
      source_range: sourceRange,
      rows,
    }),
  );

  return {
    summary,
    group: {
      group_id: `wbg_${groupHash.slice(0, 12)}`,
      group_type: groupType,
      display_name: `${input.sheet.sheet_name} · ${groupType.replace(/_/g, " ")}`,
      workbook_id: input.workbookId,
      workbook_filename: input.filename,
      source_sheet: input.sheet.sheet_name,
      source_range: sourceRange,
      row_count: rows.length,
      column_names: headerColumns,
      rows,
      provenance_summary: `${input.filename} • ${input.sheet.sheet_name}${sourceRange ? ` • ${sourceRange}` : ""}`,
    },
  };
}

function extractSharedStrings(xml: string): string[] {
  const items = xml.match(/<si[\s\S]*?<\/si>/g) ?? [];
  return items.map((item) => stripXml(item));
}

function normalizeWorksheetTarget(target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  if (target.startsWith("xl/")) return target;
  return `xl/${target.replace(/^\.?\//, "")}`;
}

function parseWorksheetXml(xml: string, sharedStrings: string[], sheetName: string, sheetIndex: number): ParsedSheet {
  const dimensionMatch = xml.match(/<dimension[^>]*ref="([^"]+)"/i);
  const rowMatches = xml.match(/<row\b[\s\S]*?<\/row>/g) ?? [];
  const rowsByNumber = new Map<number, Map<number, string>>();
  const warnings: string[] = [];

  for (const rowXml of rowMatches) {
    const cells = rowXml.match(/<c\b[\s\S]*?<\/c>|<c\b[^>]*\/>/g) ?? [];
    for (const cellXml of cells) {
      const refMatch = cellXml.match(/\br="([^"]+)"/i);
      const ref = parseCellRef(refMatch?.[1] ?? "");
      if (!ref) continue;
      const row = rowsByNumber.get(ref.row) ?? new Map<number, string>();
      const typeMatch = cellXml.match(/\bt="([^"]+)"/i);
      const valueMatch = cellXml.match(/<v[^>]*>([\s\S]*?)<\/v>/i);
      const inlineMatch = cellXml.match(/<is[\s\S]*?<\/is>/i);
      let value = "";

      if (typeMatch?.[1] === "s" && valueMatch?.[1] != null) {
        const index = Number(valueMatch[1]);
        value = sharedStrings[index] ?? "";
      } else if (typeMatch?.[1] === "inlineStr" && inlineMatch?.[0]) {
        value = stripXml(inlineMatch[0]);
      } else if (valueMatch?.[1] != null) {
        value = decodeXmlText(valueMatch[1]);
      }

      row.set(ref.column, value.trim());
      rowsByNumber.set(ref.row, row);
    }
  }

  const orderedRowNumbers = Array.from(rowsByNumber.keys()).sort((a, b) => a - b);
  const rows = orderedRowNumbers.map((rowNumber) => {
    const row = rowsByNumber.get(rowNumber);
    const maxColumn = row ? Math.max(...row.keys()) : 0;
    const cells = Array.from({ length: maxColumn }, (_, index) => row?.get(index + 1) ?? "");
    return cells;
  });

  if (!rows.length) warnings.push("No readable worksheet rows");

  return {
    sheet_name: sheetName,
    sheet_index: sheetIndex,
    bounds_ref: dimensionMatch?.[1] ?? null,
    rows,
    warnings,
  };
}

async function parseXlsxWorkbook(input: {
  bytes: ArrayBuffer;
  filename: string;
  fileSha256: string;
}): Promise<WorkbookEvidenceAsset> {
  const zip = await JSZip.loadAsync(input.bytes);
  const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  const sharedStringsXml = await zip.file("xl/sharedStrings.xml")?.async("string");
  if (!workbookXml || !relsXml) {
    return {
      workbook_id: workbookIdFor(input),
      file_kind: "xlsx",
      file_name: input.filename,
      file_sha256: input.fileSha256,
      sheet_count: 0,
      sheets: [],
      record_groups: [],
      warnings: ["Workbook XML missing required relationships"],
    };
  }

  const workbookId = workbookIdFor(input);
  const rels = new Map<string, string>();
  for (const match of relsXml.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/gi)) {
    const relId = match[1]?.trim();
    const target = match[2]?.trim();
    if (!relId || !target) continue;
    rels.set(relId, normalizeWorksheetTarget(target));
  }

  const sharedStrings = sharedStringsXml ? extractSharedStrings(sharedStringsXml) : [];
  const sheets: WorkbookSheetSummary[] = [];
  const recordGroups: WorkbookRecordGroup[] = [];
  const warnings: string[] = [];
  let sheetIndex = 0;

  for (const match of workbookXml.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/gi)) {
    const sheetName = decodeXmlText(match[1] ?? `Sheet ${sheetIndex + 1}`);
    const relId = match[2]?.trim();
    const target = relId ? rels.get(relId) : null;
    if (!target) {
      warnings.push(`Missing worksheet target for ${sheetName}`);
      sheetIndex += 1;
      continue;
    }
    const worksheetXml = await zip.file(target)?.async("string");
    if (!worksheetXml) {
      warnings.push(`Worksheet XML missing for ${sheetName}`);
      sheetIndex += 1;
      continue;
    }
    const parsed = parseWorksheetXml(worksheetXml, sharedStrings, sheetName, sheetIndex);
    const { summary, group } = await buildRecordGroup({
      workbookId,
      filename: input.filename,
      fileSha256: input.fileSha256,
      sheet: parsed,
    });
    sheets.push(summary);
    if (group) recordGroups.push(group);
    warnings.push(...summary.warnings);
    sheetIndex += 1;
  }

  return {
    workbook_id: workbookId,
    file_kind: "xlsx",
    file_name: input.filename,
    file_sha256: input.fileSha256,
    sheet_count: sheets.length,
    sheets,
    record_groups: recordGroups.sort((a, b) => a.group_id.localeCompare(b.group_id)),
    warnings: Array.from(new Set(warnings)).sort((a, b) => a.localeCompare(b)),
  };
}

async function parseCsvWorkbook(input: {
  bytes: ArrayBuffer;
  filename: string;
  fileSha256: string;
}): Promise<WorkbookEvidenceAsset> {
  const text = new TextDecoder("utf-8").decode(new Uint8Array(input.bytes));
  const sheetName = input.filename.replace(/\.[^.]+$/, "") || "Sheet1";
  const parsed: ParsedSheet = {
    sheet_name: sheetName,
    sheet_index: 0,
    bounds_ref: null,
    rows: parseCsvRows(text),
    warnings: [],
  };
  const workbookId = workbookIdFor(input);
  const { summary, group } = await buildRecordGroup({
    workbookId,
    filename: input.filename,
    fileSha256: input.fileSha256,
    sheet: parsed,
  });

  return {
    workbook_id: workbookId,
    file_kind: "csv",
    file_name: input.filename,
    file_sha256: input.fileSha256,
    sheet_count: 1,
    sheets: [summary],
    record_groups: group ? [group] : [],
    warnings: [...summary.warnings],
  };
}

export function isSupportedWorkbookUpload(input: { filename: string; mime: string }): boolean {
  const kind = normalizeWorkbookMime(input.filename, input.mime);
  if (kind) return true;
  return WORKBOOK_MIME_TYPES.has(input.mime.trim().toLowerCase());
}

export function workbookGroupTypeLabel(value: WorkbookRecordGroupType): string {
  return value.replace(/_/g, " ");
}

export async function parseWorkbookEvidenceAsset(input: {
  bytes: ArrayBuffer;
  filename: string;
  mime: string;
  fileSha256: string;
}): Promise<WorkbookEvidenceAsset | null> {
  const kind = normalizeWorkbookMime(input.filename, input.mime);
  if (!kind) return null;
  if (kind === "csv") return await parseCsvWorkbook(input);
  return await parseXlsxWorkbook(input);
}
