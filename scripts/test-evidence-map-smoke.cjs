const http = require("http");
const next = require("next");

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
    const res = await fetch(`http://localhost:${port}/m/AR-ACM0003/v/v02-0/evidence`);
    if (!res.ok) throw new Error(`Expected 200 but got ${res.status}`);
    const html = await res.text();
    const marker = html.includes("AOI + Evidence") || html.includes("Upload AOI");
    if (!marker) {
      throw new Error("Smoke test failed: expected Map surface marker in /evidence response.");
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
