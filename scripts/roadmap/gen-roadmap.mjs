import fs from "node:fs";
import path from "node:path";
import { generateRoadmapContent } from "./roadmap-lib.mjs";

const repoRoot = process.cwd();
const docsRoot = path.join(repoRoot, "docs");
const ssotRoot = path.join(docsRoot, "roadmaps");
const outPath = path.join(docsRoot, "projects", "ROADMAP.md");

const content = generateRoadmapContent(ssotRoot, docsRoot);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, content.endsWith("\n") ? content : `${content}\n`);
