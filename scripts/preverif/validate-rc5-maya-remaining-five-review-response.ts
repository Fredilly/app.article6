#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { main as validateResponseMain } from "./rc5-maya-remaining-five-response-validator";

const ownPath = fileURLToPath(import.meta.url);

export function main(argv = process.argv.slice(2)) {
  return validateResponseMain(argv, ownPath);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main();
}
