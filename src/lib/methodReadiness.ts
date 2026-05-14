import { isSourceAuditedMeta, metaUrlFromRulesPath } from "@/lib/methodBadge";
import type { MethodInventoryItem } from "@/app/m/_lib/methodInventory";

export type MethodReadiness = {
  hasRules: boolean;
  hasSections: boolean;
  hasMeta: boolean;
  sourceAudited: boolean;
  ruleCount: number;
  activeBlockers: string[];
  missingArtifacts: string[];
};

export type ArtifactUrls = {
  metaUrl: string | null;
  rulesUrl: string | null;
  sectionsUrl: string | null;
};

export function deriveArtifactUrls(method: MethodInventoryItem): ArtifactUrls {
  const latest = method.latestVersion;
  if (!latest) return { metaUrl: null, rulesUrl: null, sectionsUrl: null };

  const base = `/methodologies/${method.program}/${method.sector}/${method.code}/${latest}`;
  const rulesPath = `${base}/rules.json`;

  return {
    metaUrl: metaUrlFromRulesPath(rulesPath),
    rulesUrl: rulesPath,
    sectionsUrl: `${base}/sections.json`,
  };
}

export function computeReadiness(
  meta: unknown,
  ruleCount: number,
): MethodReadiness {
  const sourceAudited = isSourceAuditedMeta(meta);
  const m = meta as Record<string, unknown> | undefined;

  const activeBlockers: string[] = [];
  if (m?.methodology_linked_review_blockers && Array.isArray(m.methodology_linked_review_blockers)) {
    for (const b of m.methodology_linked_review_blockers) {
      if (typeof b === "string" && b.trim()) activeBlockers.push(b.trim());
    }
  }

  const missingArtifacts: string[] = [];
  const status = m?.artifact_status as Record<string, unknown> | undefined;
  if (!status?.rules) missingArtifacts.push("rules.json");
  if (!status?.sections) missingArtifacts.push("sections.json");

  return {
    hasRules: Boolean(status?.rules),
    hasSections: Boolean(status?.sections),
    hasMeta: true,
    sourceAudited,
    ruleCount,
    activeBlockers,
    missingArtifacts,
  };
}

export function emptyReadiness(): MethodReadiness {
  return {
    hasRules: false,
    hasSections: false,
    hasMeta: false,
    sourceAudited: false,
    ruleCount: 0,
    activeBlockers: [],
    missingArtifacts: ["META.json"],
  };
}
