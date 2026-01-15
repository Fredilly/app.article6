const http = require("http");
const next = require("next");

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: "CommonJS" });
require("ts-node/register");
require("tsconfig-paths/register");

const { buildEvidenceSnapshot } = require("../src/lib/proofMap/evidenceSnapshot.ts");
const { canonicalJsonStringify } = require("../src/lib/export/canonicalJson.ts");
const { canonicalEvidencePath } = require("../src/lib/nav/canonicalEvidence.ts");

async function startServer() {
  const app = next({ dev: true, dir: process.cwd() });
  await app.prepare();
  const handle = app.getRequestHandler();

  const server = http.createServer((req, res) => handle(req, res));
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return { app, server, port };
}

async function run() {
  const { app, server, port } = await startServer();
  try {
    const urls = [
      `http://localhost:${port}/m/AR-ACM0003/v/v02-0/evidence`,
      `http://localhost:${port}/m/AR-ACM0003/v/v02-0/evidence?tab=map`,
    ];
    for (const url of urls) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Expected 200 but got ${res.status}`);
      const html = await res.text();
      if (!html.includes("Upload AOI") || !html.includes("Search STAC evidence")) {
        throw new Error("Smoke test failed: expected AOI upload and STAC search controls.");
      }
      if (html.includes("Use fixture") || html.includes("Evidence pins")) {
        throw new Error("Smoke test failed: dev controls should be hidden on /evidence.");
      }
    }
    const canonicalPath = canonicalEvidencePath(
      "/m/AR-ACM0003/v/v02-0/evidence",
      new URLSearchParams("tab=map"),
    );
    if (canonicalPath !== "/m/AR-ACM0003/v/v02-0/evidence") {
      throw new Error("Smoke test failed: canonical evidence path did not strip tab param.");
    }

    const snapshotInput = {
      method: { code: "AR-ACM0003", version: "v02-0" },
      aoi: {
        bbox: [10, 10, 12, 12],
        geojson: { type: "Polygon", coordinates: [[[10, 10], [12, 10], [12, 12], [10, 12], [10, 10]]] },
      },
      evidence_source: { type: "unknown", ref: "unknown" },
      selected: { ids: ["evidence-1", "evidence-2"] },
      app: { commit: "test" },
    };
    const snapA = await buildEvidenceSnapshot(snapshotInput);
    const snapB = await buildEvidenceSnapshot(snapshotInput);
    const snapTextA = canonicalJsonStringify(snapA);
    const snapTextB = canonicalJsonStringify(snapB);
    if (snapTextA !== snapTextB) {
      throw new Error("Smoke test failed: evidence snapshot output is not deterministic.");
    }
    if ("generated_at" in snapA) {
      throw new Error("Smoke test failed: evidence snapshot should not include generated_at.");
    }
  } finally {
    await app.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

run()
  .then(() => {
    console.log("Evidence map smoke test passed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
