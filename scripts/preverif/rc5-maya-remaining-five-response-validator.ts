import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020";

const ownPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(ownPath), "..", "..");

export const packetDir = path.join(repoRoot, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-remaining-five-review-packet");
export const responseValidatorImplementationPath = "scripts/preverif/rc5-maya-remaining-five-response-validator.ts";
export const responseValidatorCliPath = "scripts/preverif/validate-rc5-maya-remaining-five-review-response.ts";
export const selectedRuleIds = [
  "Verra.AFOLU.VM0007.v1-8.R-2-0002",
  "Verra.AFOLU.VM0007.v1-8.R-2-0004",
  "Verra.AFOLU.VM0007.v1-8.R-2-0007",
  "Verra.AFOLU.VM0007.v1-8.R-2-0008",
  "Verra.AFOLU.VM0007.v1-8.R-3-0008",
] as const;

type ValidationError = { message?: string; instancePath?: string };
type EvidenceObject = {
  sourcePath: string;
  sourceSha256: string;
  sourcePdfPath: string;
  sourcePdfSha256: string;
  page: number;
  completeExactQuote: string;
};
type CommittedManifest = {
  generatedFileSha256?: Record<string, string>;
  responseValidator?: {
    cliPath?: string;
    cliSha256?: string;
    implementationPath?: string;
    implementationSha256?: string;
  };
};

const sha256 = (value: Buffer | string) => crypto.createHash("sha256").update(value).digest("hex");
const loadJson = <T>(filePath: string, label: string): T => {
  if (!fs.existsSync(filePath)) throw new Error(`${label} not found: ${filePath}`);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    throw new Error(`${label} is not valid JSON: ${filePath}`);
  }
};
const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
};
const formatAjvError = (errors: ValidationError[], decisionLabels: string[]) => {
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
};

function loadCommittedContext(cliAbsolutePath: string) {
  const responseSchemaPath = path.join(packetDir, "review-response-schema.json");
  const packetPath = path.join(packetDir, "review-packet.json");
  const manifestPath = path.join(packetDir, "manifest.json");
  const schema = loadJson<object>(responseSchemaPath, "Committed response schema");
  const packet = loadJson<{ selectedRuleIds: string[] }>(packetPath, "Committed packet");
  const manifest = loadJson<CommittedManifest>(manifestPath, "Committed manifest");

  const generated = manifest.generatedFileSha256 ?? {};
  if (generated["review-response-schema.json"] !== sha256(fs.readFileSync(responseSchemaPath))) {
    throw new Error("Committed response schema SHA changed");
  }
  if (generated["review-packet.json"] !== sha256(fs.readFileSync(packetPath))) {
    throw new Error("Committed packet SHA changed");
  }
  if (!manifest.responseValidator?.cliPath) {
    throw new Error("Committed manifest is missing responseValidator CLI path");
  }
  if (!manifest.responseValidator?.cliSha256) {
    throw new Error("Committed manifest is missing responseValidator CLI SHA");
  }
  if (!manifest.responseValidator?.implementationPath) {
    throw new Error("Committed manifest is missing responseValidator implementation path");
  }
  if (!manifest.responseValidator?.implementationSha256) {
    throw new Error("Committed manifest is missing responseValidator implementation SHA");
  }
  if (manifest.responseValidator.cliPath !== responseValidatorCliPath) {
    throw new Error("Committed manifest responseValidator CLI path changed");
  }
  if (manifest.responseValidator.implementationPath !== responseValidatorImplementationPath) {
    throw new Error("Committed manifest responseValidator implementation path changed");
  }
  if (manifest.responseValidator.cliSha256 !== sha256(fs.readFileSync(cliAbsolutePath))) {
    throw new Error("Committed manifest responseValidator CLI SHA changed");
  }
  if (manifest.responseValidator.implementationSha256 !== sha256(fs.readFileSync(ownPath))) {
    throw new Error("Committed manifest responseValidator implementation SHA changed");
  }
  if (JSON.stringify(packet.selectedRuleIds) !== JSON.stringify(selectedRuleIds)) {
    throw new Error("Committed packet selected rule IDs changed");
  }
  return { schema, packet };
}

export function createReviewResponseValidator(responseSchema: object, decisionRuleIds: readonly string[] = selectedRuleIds) {
  const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true, strict: false });
  const validate = ajv.compile(responseSchema);
  return (candidate: unknown) => {
    if (!validate(candidate)) return { valid: false, errors: validate.errors ?? [] };
    const response = candidate as { decisions?: Array<{ acceptedEvidence?: EvidenceObject[]; rejectedEvidence?: EvidenceObject[] }> };
    for (const [index, decision] of (response.decisions ?? []).entries()) {
      const accepted = new Set((decision.acceptedEvidence ?? []).map(canonicalJson));
      const rejected = new Set((decision.rejectedEvidence ?? []).map(canonicalJson));
      const label = decisionRuleIds[index] ?? `decision-${index + 1}`;
      for (const evidence of accepted) {
        if (rejected.has(evidence)) {
          return { valid: false, errors: [{ message: `decision ${label}: acceptedEvidence/rejectedEvidence overlap` }] };
        }
      }
    }
    return { valid: true, errors: [] as Array<{ message?: string }> };
  };
}

export function validateResponseFile(responseFilePath: string, cliAbsolutePath = ownPath) {
  const { schema, packet } = loadCommittedContext(cliAbsolutePath);
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

export function main(argv = process.argv.slice(2), cliAbsolutePath = ownPath) {
  try {
    if (argv.length !== 1) throw new Error("Usage: validate-rc5-maya-remaining-five-review-response <response.json>");
    validateResponseFile(argv[0], cliAbsolutePath);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return 1;
  }
}
