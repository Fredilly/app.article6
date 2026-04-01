export const CANON_SCHEMA_PATHS = [
  "schemas/artifacts/rules.rich.schema.json",
  "schemas/artifacts/sections.rich.schema.json",
  "src/integrity/schemas/rulesRich.schema.json",
  "src/integrity/schemas/sectionsRich.schema.json",
] as const;

export const VENDORED_METHODOLOGY_PATH_PREFIXES = [
  "public/methodologies/",
  "public/_provenance/methodologies_PROVENANCE.json",
] as const;

export const APPROVED_SYNC_BRANCH_PREFIXES = [
  "sync/methodologies-",
  "chore/sync-methodologies-",
  "chore/methodologies-sync-",
] as const;

export type MethodologyBoundaryInput = {
  allowMethodologySync?: boolean;
  branchName?: string | null;
  changedFiles: string[];
};

export type MethodologyBoundaryResult = {
  allowed: boolean;
  approvedSyncPath: boolean;
  blockedCanonSchemaFiles: string[];
  blockedVendoredMethodologyFiles: string[];
  messages: string[];
};

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").trim();
}

export function isApprovedMethodologySyncBranch(branchName?: string | null): boolean {
  if (!branchName) return false;
  return APPROVED_SYNC_BRANCH_PREFIXES.some((prefix) => branchName.startsWith(prefix));
}

export function evaluateMethodologyBoundary(input: MethodologyBoundaryInput): MethodologyBoundaryResult {
  const changedFiles = input.changedFiles.map(normalizePath).filter(Boolean);
  const approvedSyncPath = Boolean(input.allowMethodologySync) || isApprovedMethodologySyncBranch(input.branchName);

  const blockedCanonSchemaFiles = changedFiles.filter((filePath) =>
    CANON_SCHEMA_PATHS.some((blockedPath) => blockedPath === filePath),
  );

  const blockedVendoredMethodologyFiles = approvedSyncPath
    ? []
    : changedFiles.filter((filePath) =>
        VENDORED_METHODOLOGY_PATH_PREFIXES.some((prefix) =>
          prefix.endsWith(".json") ? prefix === filePath : filePath.startsWith(prefix),
        ),
      );

  const messages: string[] = [];

  if (blockedCanonSchemaFiles.length) {
    messages.push(
      [
        "Canonical methodology schema edits are not owned by app.article6.",
        "Open the schema/artifact change upstream in article6-methodologies first, then update app consumer compatibility separately.",
        `Blocked files: ${blockedCanonSchemaFiles.join(", ")}`,
      ].join(" "),
    );
  }

  if (blockedVendoredMethodologyFiles.length) {
    messages.push(
      [
        "Vendored methodology pack files cannot be edited directly in normal app PRs.",
        "Use an approved methodologies sync path instead.",
        "Approved paths: set ALLOW_METHODOLOGY_SYNC=1 or use a sync branch prefix",
        `(${APPROVED_SYNC_BRANCH_PREFIXES.join(", ")}).`,
        `Blocked files: ${blockedVendoredMethodologyFiles.join(", ")}`,
      ].join(" "),
    );
  }

  return {
    allowed: messages.length === 0,
    approvedSyncPath,
    blockedCanonSchemaFiles,
    blockedVendoredMethodologyFiles,
    messages,
  };
}
