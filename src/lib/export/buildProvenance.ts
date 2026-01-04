type ProvenanceInput = {
  generated_at?: string;
  app_git_sha?: string;
  aoi_id?: string;
  aoi_fingerprint?: string;
  methodology_code?: string;
  methodology_version?: string;
  provider?: "stac" | string;
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

export default function buildProvenance(input: ProvenanceInput): string {
  const generatedAt = normalize(input.generated_at, new Date().toISOString());
  const gitSha = normalize(input.app_git_sha, process.env.NEXT_PUBLIC_GIT_SHA || "unknown");
  const aoiId = normalize(input.aoi_id, "unknown");
  const aoiFingerprint = normalize(input.aoi_fingerprint, "unknown");
  const methodCode = normalize(input.methodology_code, "unknown");
  const methodVersion = normalize(input.methodology_version, "unknown");
  const provider = normalize(input.provider, "stac");
  const stacRunId = normalize(input.stac_run_id, "none");
  const stacStatus = normalize(input.stac_status, "none");
  const stacExecutedAt = normalize(input.stac_executed_at, "none");
  const stacItemCount = normalizeCount(input.stac_item_count);

  const lines = [
    `generated_at=${generatedAt}`,
    `app_git_sha=${gitSha || "unknown"}`,
    `aoi_id=${aoiId}`,
    `aoi_fingerprint=${aoiFingerprint}`,
    `methodology=${methodCode}@${methodVersion}`,
    `provider=${provider}`,
    `stac_run_id=${stacRunId}`,
    `stac_status=${stacStatus}`,
    `stac_executed_at=${stacExecutedAt}`,
    `stac_item_count=${stacItemCount}`,
  ];
  return `${lines.join("\n")}\n`;
}

