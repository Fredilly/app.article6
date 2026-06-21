import { execFile, execFileSync } from "child_process";
import { promisify } from "util";
import path from "path";

const execFileAsync = promisify(execFile);

/** Shape of the JSON produced by scripts/docling-parse.py */
export type DoclingHelperJson = {
  engine?: string;
  parser_version?: string;
  raw_text?: string;
  markdown?: string;
  pages?: Array<{ page_number: number; text: string }>;
  headings?: Array<{ text: string; level: number; page_number: number }>;
  tables?: Array<{
    id: string;
    page_number: number;
    row_count: number;
    column_count: number;
    cells: Array<{ row: number; col: number; text: string }>;
  }>;
  error?: string;
  message?: string;
  detail?: string;
  traceback?: string;
};

export function parseDoclingHelperOutput(stdout: string): DoclingHelperJson {
  try {
    return JSON.parse(stdout) as DoclingHelperJson;
  } catch {
    return { error: "json_parse_failed", message: "Docling helper produced invalid JSON." };
  }
}

/**
 * Run the Docling Python helper script against a PDF file synchronously.
 * Returns the helper's stdout string, or throws on failure.
 */
export function runDoclingHelperSync(pdfPath: string): string {
  const scriptPath = path.resolve(process.cwd(), "scripts", "docling-parse.py");
  return execFileSync("python3", [scriptPath, pdfPath], {
    timeout: 120000,
    maxBuffer: 50 * 1024 * 1024,
    encoding: "utf-8",
  });
}

/**
 * Run the Docling Python helper script against a PDF file asynchronously.
 * Returns the parsed JSON output, or an error-shaped object on failure.
 */
export async function runDoclingHelper(pdfPath: string): Promise<DoclingHelperJson> {
  const scriptPath = path.resolve(process.cwd(), "scripts", "docling-parse.py");

  try {
    const { stdout } = await execFileAsync("python3", [scriptPath, pdfPath], {
      timeout: 120000,
      maxBuffer: 50 * 1024 * 1024,
    });
    return parseDoclingHelperOutput(stdout);
  } catch (err) {
    const error = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    if (error.stdout) {
      return parseDoclingHelperOutput(error.stdout);
    }
    return {
      error: "helper_execution_failed",
      message: `Docling helper process failed: ${error.message ?? "unknown error"}`,
      detail: error.stderr ?? "",
    };
  }
}

export function isDoclingHelperAvailable(): boolean {
  try {
    execFileSync("python3", ["--version"], { timeout: 5000, encoding: "utf-8" });
    return true;
  } catch {
    return false;
  }
}
