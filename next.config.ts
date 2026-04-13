import type { NextConfig } from "next";

const gitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? "";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GIT_SHA: gitSha,
  },
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/quick-check/pdf-extract": [
      "./scripts/extract-quick-check-pdf.cjs",
      "./node_modules/pdf-parse/**/*",
      "./node_modules/pdfjs-dist/**/*",
      "./node_modules/@napi-rs/canvas/**/*",
    ],
  },
};

export default nextConfig;
