export type DeeplinkContext = {
  method?: string;
  version?: string;
};

export type InventoryMethodSummary = {
  code: string;
  versions: string[];
  latestVersion?: string;
};

export type InventorySummary = {
  methods: InventoryMethodSummary[];
};

export type ResolvedDeeplinkContext = {
  method?: string;
  requestedVersion?: string;
  resolvedVersion?: string;
  warnings: string[];
};

function normalizeToken(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseDeeplinkContext(params: URLSearchParams | Readonly<URLSearchParams>): DeeplinkContext {
  return {
    method: normalizeToken(params.get("method")),
    version: normalizeToken(params.get("version")),
  };
}

export function resolveDeeplinkContext(
  context: DeeplinkContext,
  inventory: InventorySummary,
): ResolvedDeeplinkContext {
  const warnings: string[] = [];
  const method = context.method;
  const requestedVersion = context.version;

  if (!method) {
    return { warnings };
  }

  const match =
    inventory.methods.find((candidate) => candidate.code.toLowerCase() === method.toLowerCase()) ??
    null;

  if (!match) {
    warnings.push(`Unknown method "${method}".`);
    return { warnings };
  }

  const availableVersions = match.versions ?? [];
  const latest = match.latestVersion ?? availableVersions.at(-1);

  if (!requestedVersion) {
    return {
      method: match.code,
      resolvedVersion: latest,
      warnings,
    };
  }

  const hasRequested = availableVersions.some(
    (version) => version.toLowerCase() === requestedVersion.toLowerCase(),
  );

  if (hasRequested) {
    const resolved =
      availableVersions.find((version) => version.toLowerCase() === requestedVersion.toLowerCase()) ??
      requestedVersion;
    return {
      method: match.code,
      requestedVersion,
      resolvedVersion: resolved,
      warnings,
    };
  }

  warnings.push(
    `Unknown version "${requestedVersion}" for method "${match.code}". Using "${latest ?? "—"}".`,
  );
  return {
    method: match.code,
    requestedVersion,
    resolvedVersion: latest,
    warnings,
  };
}

