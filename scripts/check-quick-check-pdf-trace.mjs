import fs from "fs";
import path from "path";

const tracePath = path.join(process.cwd(), ".next", "server", "app", "api", "quick-check", "pdf-extract", "route.js.nft.json");

if (!fs.existsSync(tracePath)) {
  console.error(`Missing build trace: ${tracePath}`);
  process.exit(1);
}

const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
const files = Array.isArray(trace.files) ? trace.files.map(String) : [];

const requiredPatterns = [
  /scripts\/extract-quick-check-pdf\.cjs$/,
  /node_modules\/pdf-parse\//,
  /node_modules\/pdfjs-dist\//,
];

const missing = requiredPatterns.filter((pattern) => !files.some((file) => pattern.test(file)));

if (missing.length) {
  console.error("Quick Check PDF trace is missing required runtime files.");
  for (const pattern of missing) {
    console.error(`- ${pattern}`);
  }
  process.exit(1);
}

console.log("Quick Check PDF trace includes helper and parser runtime files.");
