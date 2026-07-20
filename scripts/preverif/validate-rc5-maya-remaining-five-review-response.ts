#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createReviewResponseValidator, packetDir, selectedRuleIds } from "./generate-rc5-maya-remaining-five-review-packet";

type ValidationError = { message?: string; instancePath?: string };

const responseSchemaPath = path.join(packetDir, "review-response-schema.json");
const packetPath = path.join(packetDir, "review-packet.json");
const manifestPath = path.join(packetDir, "manifest.json");
const ownPath = fileURLToPath(import.meta.url);
const sha256 = (value: Buffer | string) => crypto.createHash("sha256").update(value).digest("hex");

function loadJson<T>(filePath: string, label: string): T {
  if (!fs.existsSync(filePath)) throw new Error(`${label} not found: ${filePath}`);
  const text = fs.readFileSync(filePath, "utf8");
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${filePath}`);
  }
}

function loadCommittedContext() {
  const schema = loadJson<object>(responseSchemaPath, "Committed response schema");
  const packet = loadJson<{ selectedRuleIds: string[] }>(packetPath, "Committed packet");
  const manifest = loadJson<{ responseValidator?: { path?: string; sha256?: string } }>(manifestPath, "Committed manifest");
  if (!manifest.responseValidator?.path || !manifest.responseValidator?.sha256) {
    throw new Error("Committed manifest is missing responseValidator pin");
  }
  if (manifest.responseValidator.path !== path.relative(process.cwd(), ownPath)) {
    throw new Error("Committed manifest responseValidator path changed");
  }
  if (manifest.responseValidator.sha256 !== sha256(fs.readFileSync(ownPath))) {
    throw new Error("Committed manifest responseValidator SHA changed");
  }
  if (JSON.stringify(packet.selectedRuleIds) !== JSON.stringify(selectedRuleIds)) {
    throw new Error("Committed packet selected rule IDs changed");
  }
  return { schema, packet, manifest };
}

function formatAjvError(errors: ValidationError[], decisionLabels: string[]) {
  const first = errors[0];
  if (!first) return "response validation failed";
  const pathParts = first.instancePath?.split("/").filter(Boolean) ?? [];
  if (pathParts[0] === "decisions" && pathParts[1] !== undefined) {
    const index = Number(pathParts[1]);
    const ruleId = decisionLabels[index] ?? `decision-${index + 1}`;
    const suffix = pathParts.slice(2).join("/");
    return `decision ${ruleId}: ${first.message ?? "response validation failed"}${suffix ? ` at ${suffix}` : ""}`;
  }
  return first.message ? `response validation failed: ${first.message}` : "response validation failed";
}

export function validateResponseFile(responseFilePath: string) {
  const { schema, packet } = loadCommittedContext();
  const candidate = loadJson<unknown>(responseFilePath, "Response file");
  const validate = createReviewResponseValidator(schema, packet.selectedRuleIds);
  const result = validate(candidate);
  if (!result.valid) {
    const errors = result.errors as ValidationError[];
    const message = errors.some((error) => typeof error.message === "string" && error.message.includes("acceptedEvidence/rejectedEvidence overlap"))
      ? errors[0]?.message ?? "acceptedEvidence/rejectedEvidence overlap"
      : formatAjvError(errors, packet.selectedRuleIds);
    throw new Error(message);
  }
  return candidate;
}

export function main(argv = process.argv.slice(2)) {
  try {
    if (argv.length !== 1) throw new Error("Usage: validate-rc5-maya-remaining-five-review-response <response.json>");
    validateResponseFile(argv[0]);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main();
}
