import { describe, expect, it } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { parseWorkbookEvidenceAsset } from "@/lib/evidence/workbook";

async function buildMinimalWorkbook(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
    <workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <sheets>
        <sheet name="Activity Data" sheetId="1" r:id="rId1"/>
        <sheet name="Notes" sheetId="2" r:id="rId2"/>
      </sheets>
    </workbook>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/>
      <Relationship Id="rId2" Type="worksheet" Target="worksheets/sheet2.xml"/>
    </Relationships>`,
  );
  zip.file(
    "xl/worksheets/sheet1.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
    <worksheet>
      <dimension ref="A1:C3"/>
      <sheetData>
        <row r="1">
          <c r="A1" t="inlineStr"><is><t>monitoring_period</t></is></c>
          <c r="B1" t="inlineStr"><is><t>activity_volume</t></is></c>
          <c r="C1" t="inlineStr"><is><t>sample_id</t></is></c>
        </row>
        <row r="2">
          <c r="A2" t="inlineStr"><is><t>2026-Q1</t></is></c>
          <c r="B2"><v>10</v></c>
          <c r="C2" t="inlineStr"><is><t>S-1</t></is></c>
        </row>
        <row r="3">
          <c r="A3" t="inlineStr"><is><t>2026-Q1</t></is></c>
          <c r="B3"><v>11</v></c>
          <c r="C3" t="inlineStr"><is><t>S-2</t></is></c>
        </row>
      </sheetData>
    </worksheet>`,
  );
  zip.file(
    "xl/worksheets/sheet2.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
    <worksheet>
      <sheetData>
        <row r="1">
          <c r="A1" t="inlineStr"><is><t>freeform note</t></is></c>
        </row>
      </sheetData>
    </worksheet>`,
  );
  return await zip.generateAsync({ type: "arraybuffer" });
}

describe("workbook intake", () => {
  it("parses the checked-in workbook fixture into the checked-in normalized artifact", async () => {
    const fixturePath = path.join(process.cwd(), "tests/fixtures/workbook-intake/multi-group-workbook.xlsx");
    const artifactPath = path.join(process.cwd(), "tests/fixtures/workbook-intake/multi-group-workbook.normalized.json");
    const bytes = fs.readFileSync(fixturePath);
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as Awaited<ReturnType<typeof parseWorkbookEvidenceAsset>>;
    const parsed = await parseWorkbookEvidenceAsset({
      bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      filename: "multi-group-workbook.xlsx",
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileSha256: "9de17d219d599e7f522ed66e1d6fc671dbc61fba5b180cda0144809f9a9f2ac7",
    });

    expect(parsed).toEqual(artifact);
  });

  it("extracts multiple candidate evidence groups from one workbook fixture", async () => {
    const fixturePath = path.join(process.cwd(), "tests/fixtures/workbook-intake/multi-group-workbook.xlsx");
    const bytes = fs.readFileSync(fixturePath);
    const parsed = await parseWorkbookEvidenceAsset({
      bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      filename: "multi-group-workbook.xlsx",
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileSha256: "9de17d219d599e7f522ed66e1d6fc671dbc61fba5b180cda0144809f9a9f2ac7",
    });

    expect(parsed?.record_groups.map((group) => group.group_type)).toEqual([
      "calculation_table",
      "activity_data_table",
    ]);
    expect(parsed?.record_groups.map((group) => group.source_sheet)).toEqual([
      "Calculations",
      "Activity Data",
    ]);
  });

  it("parses csv into deterministic workbook-derived groups", async () => {
    const csv = "monitoring_period,activity_volume,sample_id\n2026-Q1,10,S-1\n2026-Q1,11,S-2\n";
    const bytes = new TextEncoder().encode(csv);
    const asset = await parseWorkbookEvidenceAsset({
      bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      filename: "activity.csv",
      mime: "text/csv",
      fileSha256: "sha-csv-001",
    });

    expect(asset?.file_kind).toBe("csv");
    expect(asset?.sheet_count).toBe(1);
    expect(asset?.record_groups).toHaveLength(1);
    expect(asset?.record_groups[0]?.group_type).toBe("activity_data_table");
    expect(asset?.record_groups[0]?.source_range).toBe("A1:C3");
  });

  it("parses xlsx sheets deterministically across repeated runs", async () => {
    const bytes = await buildMinimalWorkbook();
    const first = await parseWorkbookEvidenceAsset({
      bytes,
      filename: "activity.xlsx",
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileSha256: "sha-xlsx-001",
    });
    const second = await parseWorkbookEvidenceAsset({
      bytes,
      filename: "activity.xlsx",
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileSha256: "sha-xlsx-001",
    });

    expect(first).toEqual(second);
    expect(first?.sheet_count).toBe(2);
    expect(first?.record_groups[0]?.group_type).toBe("activity_data_table");
  });

  it("fails soft on malformed workbook tabs while preserving warnings", async () => {
    const zip = new JSZip();
    zip.file("xl/workbook.xml", `<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Broken" sheetId="1" r:id="rId1"/></sheets></workbook>`);
    zip.file("xl/_rels/workbook.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="worksheet" Target="worksheets/missing.xml"/></Relationships>`);
    const bytes = await zip.generateAsync({ type: "arraybuffer" });

    const asset = await parseWorkbookEvidenceAsset({
      bytes,
      filename: "broken.xlsx",
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileSha256: "sha-xlsx-bad",
    });

    expect(asset?.record_groups).toEqual([]);
    expect(asset?.warnings.join(" ")).toContain("Worksheet XML missing");
  });
});
