import fs from "fs/promises";
import path from "path";
import { jest, describe, expect, it, beforeEach } from "@jest/globals";
import { extractPdfTextWithOpenDataLoader } from "@/lib/chat/quickCheckPdfExtractor";

describe("quick check opendataloader extractor", () => {
  const mockedConvert = jest.fn<(...args: unknown[]) => Promise<string>>();

  beforeEach(() => {
    mockedConvert.mockReset();
  });

  it("reads text output emitted by opendataloader", async () => {
    mockedConvert.mockImplementation(async (inputPath, options = {}) => {
      const resolvedInput = Array.isArray(inputPath) ? inputPath[0]! : inputPath;
      const outputDir = options.outputDir!;
      const baseName = path.parse(resolvedInput).name;
      await fs.writeFile(path.join(outputDir, `${baseName}.txt`), "Project area  Lilongwe District");
      await fs.writeFile(path.join(outputDir, `${baseName}.json`), JSON.stringify({ kids: [] }));
      return "";
    });

    const result = await extractPdfTextWithOpenDataLoader({
      bytes: new TextEncoder().encode("%PDF-test").buffer,
      filename: "Malawi Evidence.pdf",
      convertPdf: mockedConvert as never,
    });

    expect(result.text).toBe("Project area Lilongwe District");
    expect(result.metadata).toEqual({
      jsonExtracted: true,
      textExtracted: true,
    });
  });

  it("falls back to structured json content when text output is empty", async () => {
    mockedConvert.mockImplementation(async (inputPath, options = {}) => {
      const resolvedInput = Array.isArray(inputPath) ? inputPath[0]! : inputPath;
      const outputDir = options.outputDir!;
      const baseName = path.parse(resolvedInput).name;
      await fs.writeFile(
        path.join(outputDir, `${baseName}.json`),
        JSON.stringify({
          kids: [
            { content: "Monitoring report covers the reporting period." },
            { kids: [{ content: "Gold Standard TPDD TEC Version 4.0" }] },
          ],
        }),
      );
      return "";
    });

    const result = await extractPdfTextWithOpenDataLoader({
      bytes: new TextEncoder().encode("%PDF-json").buffer,
      filename: "Kenya Evidence.pdf",
      convertPdf: mockedConvert as never,
    });

    expect(result.text).toContain("Monitoring report covers the reporting period.");
    expect(result.text).toContain("Gold Standard TPDD TEC Version 4.0");
    expect(result.metadata).toEqual({
      jsonExtracted: true,
      textExtracted: false,
    });
  });

  it("surfaces the java prerequisite clearly", async () => {
    mockedConvert.mockRejectedValue(new Error("'java' command not found. Please ensure Java is installed and in your system's PATH."));

    await expect(
      extractPdfTextWithOpenDataLoader({
        bytes: new TextEncoder().encode("%PDF-missing-java").buffer,
        filename: "needs-java.pdf",
        convertPdf: mockedConvert as never,
      }),
    ).rejects.toThrow("Java 11+");
  });
});
