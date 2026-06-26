import type { NextConfig } from "next";

const gitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? "";
const pkgVersion = "0.1.0";
const appVersion = gitSha ? `${pkgVersion}+${gitSha.slice(0, 7)}` : pkgVersion;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GIT_SHA: gitSha,
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_QUICK_CHECK_LLM: process.env.QUICK_CHECK_LLM_FACT_EXTRACTOR === "ollama" || process.env.QUICK_CHECK_LLM_FACT_EXTRACTOR === "openrouter" ? "1" : "0",
  },
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/": [
      "./scripts/pymupdf-parse.py",
    ],
    "/api/quick-check/pdf-extract": [
      "./scripts/extract-quick-check-pdf.cjs",
      "./node_modules/pdf-parse/**/*",
      "./node_modules/pdfjs-dist/**/*",
      "./node_modules/@napi-rs/canvas/**/*",
    ],
    "/api/projects/manual-review/extract-findings": [
      "./scripts/extract-quick-check-pdf.cjs",
      "./node_modules/pdf-parse/**/*",
      "./node_modules/pdfjs-dist/**/*",
      "./node_modules/@napi-rs/canvas/**/*",
    ],
    "/api/quick-check/semantic-evidence": [
      "./scripts/pymupdf-parse.py",
    ],
  },
};

export default nextConfig;
