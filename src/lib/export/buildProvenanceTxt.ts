type Input = {
  exported_at?: string;
  app_git_sha?: string;
  method_code?: string;
  method_version?: string;
  aoi_id?: string;
  aoi_fingerprint?: string;
  stac_run_id?: string;
  stac_status?: string;
  stac_executed_at?: string;
  stac_item_count?: number;
};

function normalize(value: unknown, fallback: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : fallback;
}

function normalizeCount(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? String(Math.floor(value)) : "0";
}

export default function buildProvenanceTxt(input: Input): string {
  const exportedAt = normalize(input.exported_at, new Date().toISOString());
  const gitSha = normalize(input.app_git_sha, process.env.NEXT_PUBLIC_GIT_SHA || "unknown");
  const methodCode = normalize(input.method_code, "unknown");
  const methodVersion = normalize(input.method_version, "unknown");
  const aoiId = normalize(input.aoi_id, "unknown");
  const aoiFingerprint = normalize(input.aoi_fingerprint, "unknown");
  const stacRunId = normalize(input.stac_run_id, "none");
  const stacStatus = normalize(input.stac_status, "none");
  const stacExecutedAt = normalize(input.stac_executed_at, "none");
  const stacItemCount = normalizeCount(input.stac_item_count);

  const lines = [
    `exported_at=${exportedAt}`,
    `app_git_sha=${gitSha || "unknown"}`,
    `method=${methodCode}@${methodVersion}`,
    `aoi_id=${aoiId}`,
    `aoi_fingerprint=${aoiFingerprint}`,
    `stac_run_id=${stacRunId}`,
    `stac_status=${stacStatus}`,
    `stac_executed_at=${stacExecutedAt}`,
    `stac_item_count=${stacItemCount}`,
  ];

  return `${lines.join("\n")}\n`;
}

