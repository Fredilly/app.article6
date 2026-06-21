import { execFileSync } from "child_process";
import { existsSync } from "fs";
import path from "path";

export type PymupdfHelperJsonBlock = {
  text: string;
  bbox?: number[] | null;
};

export type PymupdfHelperJson = {
  engine?: string;
  parser_version?: string;
  raw_text?: string;
  markdown?: string;
  pages?: Array<{
    page_number: number;
    text: string;
    blocks?: PymupdfHelperJsonBlock[];
  }>;
  headings?: Array<{ text: string; level: number; page_number: number }>;
  tables?: Array<{
    id: string;
    page_number: number;
    row_count: number;
    column_count: number;
    cells: Array<{ row: number; col: number; text: string }>;
  }>;
  warnings?: string[];
  error?: string;
  message?: string;
  detail?: string;
  traceback?: string;
};

export function parsePymupdfHelperOutput(stdout: string): PymupdfHelperJson {
  try {
    return JSON.parse(stdout) as PymupdfHelperJson;
  } catch {
    return { error: "json_parse_failed", message: "PyMuPDF helper produced invalid JSON." };
  }
}

export function runPymupdfHelperSync(pdfPath: string): string {
  const scriptPath = path.resolve(process.cwd(), "scripts", "pymupdf-parse.py");
  const python3 = _resolvePython3Path();
  return execFileSync(python3, [scriptPath, pdfPath], {
    timeout: 120000,
    maxBuffer: 50 * 1024 * 1024,
    encoding: "utf-8",
  });
}

function _resolvePython3Path(): string {
  if (process.env.PYTHON3) return process.env.PYTHON3;
  const venvPath = path.resolve(process.cwd(), ".venv/bin/python3");
  if (existsSync(venvPath)) return venvPath;
  return "python3";
}
