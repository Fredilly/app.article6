import { globby } from "globby";

const forbidden = await globby(["docs/projects/**/PLAN.md", "docs/projects/**/phase-status.json"]);

if (forbidden.length) {
  console.error("docs layout error: roadmap files found under docs/projects/");
  for (const file of forbidden) console.error(` - ${file}`);
  process.exit(1);
}

console.log("docs layout OK");
