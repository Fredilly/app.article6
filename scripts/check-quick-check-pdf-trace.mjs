import fs from "fs";
import path from "path";

const requiredPatterns = [
  /scripts\/extract-quick-check-pdf\.cjs$/,
  /node_modules\/pdf-parse\//,
  /node_modules\/pdfjs-dist\//,
  /node_modules\/@napi-rs\/canvas\//,
];

const routeTraces = [
  {
    label: "Quick Check PDF route",
    tracePath: path.join(process.cwd(), ".next", "server", "app", "api", "quick-check", "pdf-extract", "route.js.nft.json"),
  },
  {
    label: "Manual Review extract-findings route",
    tracePath: path.join(process.cwd(), ".next", "server", "app", "api", "projects", "manual-review", "extract-findings", "route.js.nft.json"),
  },
];

for (const routeTrace of routeTraces) {
  if (!fs.existsSync(routeTrace.tracePath)) {
    console.error(`Missing build trace: ${routeTrace.tracePath}`);
    process.exit(1);
  }

  const trace = JSON.parse(fs.readFileSync(routeTrace.tracePath, "utf8"));
  const files = Array.isArray(trace.files) ? trace.files.map(String) : [];
  const missing = requiredPatterns.filter((pattern) => !files.some((file) => pattern.test(file)));

  if (missing.length) {
    console.error(`${routeTrace.label} trace is missing required runtime files.`);
    for (const pattern of missing) {
      console.error(`- ${pattern}`);
    }
    process.exit(1);
  }
}

console.log("Quick Check and Manual Review PDF traces include helper and parser runtime files.");
