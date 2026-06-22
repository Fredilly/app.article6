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

export type PymupdfAvailabilityCheck = {
  available: boolean;
  reason: string;
  pythonPath: string;
  pythonVersion?: string;
  pymupdfVersion?: string;
  pythonPackagesPath?: string;
};

function isVercelPreview(): boolean {
  return Boolean(
    process.env.VERCEL_ENV === "preview" ||
    process.env.VERCEL_ENV === "development" ||
    process.env.VERCEL,
  );
}

let _availabilityCache: PymupdfAvailabilityCheck | null = null;

export function checkPymupdfAvailability(): PymupdfAvailabilityCheck {
  if (_availabilityCache) return _availabilityCache;

  const python3 = _resolvePython3Path();
  const pythonPackagesPath = _resolvePythonPackagesPath();

  try {
    execFileSync(python3, ["--version"], {
      timeout: 5000,
      encoding: "utf-8",
    });
  } catch {
    const result: PymupdfAvailabilityCheck = {
      available: false,
      reason: `python3 not found at "${python3}". Is Python available in this environment?`,
      pythonPath: python3,
    };
    if (isVercelPreview()) {
      console.warn("[pymupdf:vercel] PyMuPDF unavailable — python3 not found.", {
        attemptedPythonPath: python3,
        cwd: process.cwd(),
      });
    }
    _availabilityCache = result;
    return result;
  }

  const pymupdfCheckEnv = _buildPythonEnv();
  if (pythonPackagesPath) {
    const existingPythonPath = pymupdfCheckEnv.PYTHONPATH ?? "";
    pymupdfCheckEnv.PYTHONPATH = existingPythonPath
      ? `${pythonPackagesPath}:${existingPythonPath}`
      : pythonPackagesPath;
  }

  try {
    const fitzOutput = execFileSync(python3, ["-c", "import fitz; print(fitz.version)"], {
      timeout: 10000,
      encoding: "utf-8",
      env: pymupdfCheckEnv,
    }).trim();

    const result: PymupdfAvailabilityCheck = {
      available: true,
      reason: "PyMuPDF is available",
      pythonPath: python3,
      pymupdfVersion: fitzOutput,
    };
    if (pythonPackagesPath) {
      result.pythonPackagesPath = pythonPackagesPath;
    }
    _availabilityCache = result;
    return result;
  } catch (importError) {
    const detail = importError instanceof Error ? importError.message : String(importError);
    const result: PymupdfAvailabilityCheck = {
      available: false,
      reason: `python3 found at "${python3}" but PyMuPDF (fitz) is not installed.`,
      pythonPath: python3,
    };
    if (pythonPackagesPath) {
      result.pythonPackagesPath = pythonPackagesPath;
    }
    if (detail) {
      result.reason += ` Detail: ${detail}`;
    }
    if (isVercelPreview()) {
      console.warn("[pymupdf:vercel] PyMuPDF unavailable — fitz import failed.", {
        pythonPath: python3,
        pythonPackagesPath: pythonPackagesPath ?? "not set",
        error: detail,
      });
    }
    _availabilityCache = result;
    return result;
  }
}

export function resetPymupdfAvailabilityCache(): void {
  _availabilityCache = null;
}

export function parsePymupdfHelperOutput(stdout: string): PymupdfHelperJson {
  try {
    return JSON.parse(stdout) as PymupdfHelperJson;
  } catch {
    return { error: "json_parse_failed", message: "PyMuPDF helper produced invalid JSON." };
  }
}

function _buildPythonEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const pythonPackagesPath = _resolvePythonPackagesPath();
  if (pythonPackagesPath) {
    const existingPythonPath = env.PYTHONPATH ?? "";
    env.PYTHONPATH = existingPythonPath
      ? `${pythonPackagesPath}:${existingPythonPath}`
      : pythonPackagesPath;
  }
  return env;
}

function _resolvePythonPackagesPath(): string | undefined {
  if (process.env.PYTHON_PACKAGES_PATH) return process.env.PYTHON_PACKAGES_PATH;
  const publicPath = path.resolve(process.cwd(), "public", ".python");
  if (existsSync(publicPath)) return publicPath;
  const vercelPath = path.resolve(process.cwd(), "node_modules", ".python");
  if (existsSync(vercelPath)) return vercelPath;
  const legacyPath = path.resolve(process.cwd(), "python_packages");
  if (existsSync(legacyPath)) return legacyPath;
  return undefined;
}

export function runPymupdfHelperSync(pdfPath: string): string {
  const scriptPath = path.resolve(process.cwd(), "scripts", "pymupdf-parse.py");
  const python3 = _resolvePython3Path();
  return execFileSync(python3, [scriptPath, pdfPath], {
    timeout: 120000,
    maxBuffer: 50 * 1024 * 1024,
    encoding: "utf-8",
    env: _buildPythonEnv(),
  });
}

function _candidatePython3Paths(): string[] {
  const candidates: string[] = [];
  if (process.env.PYTHON3) candidates.push(process.env.PYTHON3);
  candidates.push(path.resolve(process.cwd(), ".venv/bin/python3"));
  candidates.push("/usr/bin/python3");
  candidates.push("/usr/bin/python");
  candidates.push("/usr/local/bin/python3");
  candidates.push("python3");
  return candidates;
}

function _resolvePython3Path(): string {
  for (const candidate of _candidatePython3Paths()) {
    if (existsSync(candidate)) {
      // Verify it actually runs
      try {
        execFileSync(candidate, ["--version"], { timeout: 5000, encoding: "utf-8" });
        return candidate;
      } catch { /* try next */ }
    }
  }
  return "python3";
}
