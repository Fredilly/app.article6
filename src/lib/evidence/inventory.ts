import type { EvidenceAttachment, EvidencePin, WorkbookEvidenceAsset, WorkbookRecordGroup } from "@/lib/proofMap/types";

export type EvidenceInventoryLinkState = "unlinked" | "linked";
export type WorkbookCandidateEvidenceType =
  | "spreadsheet-workbook"
  | "calculation-support"
  | "monitoring-report";

export type EvidenceInventoryWorkbookGroup = WorkbookRecordGroup & {
  candidate_evidence_types: WorkbookCandidateEvidenceType[];
};

export type EvidenceInventoryItem = {
  evidence_id: string;
  dedupe_key: string;
  display_name: string;
  type: string;
  source_summary: string;
  provenance_summary: string;
  added_at: string;
  link_state: EvidenceInventoryLinkState;
  linked_requirement_ids: string[];
  workbook_assets?: WorkbookEvidenceAsset[];
  workbook_record_groups?: EvidenceInventoryWorkbookGroup[];
};

function uniqSorted(values: string[] | undefined | null, matcher?: RegExp): string[] {
  if (!values?.length) return [];
  const set = new Set<string>();
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    if (matcher && !matcher.test(value)) continue;
    set.add(value);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function uniqAttachments(items: EvidenceAttachment[]): EvidenceAttachment[] {
  const seen = new Set<string>();
  const next: EvidenceAttachment[] = [];
  for (const item of items) {
    const key = `${item.sha256}:${item.filename}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(item);
  }
  return next.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

function evidenceTypeLabel(pin: EvidencePin): string {
  const attachments = pin.attachments ?? [];
  const hasWorkbook = attachments.some((attachment) => attachment.workbook_asset);
  const hasPdf = attachments.some((attachment) => attachment.mime === "application/pdf");
  const hasImage = attachments.some((attachment) => attachment.mime.startsWith("image/"));
  if ((pin.stac_item_ids?.length ?? 0) > 0) return "STAC item";
  if (hasWorkbook) return "Workbook";
  if (hasPdf || hasImage || attachments.length > 0) return "Upload";
  if (pin.kind === "doc") return "Document";
  if (pin.kind === "photo") return "Photo";
  return "Note";
}

function sourceSummary(pin: EvidencePin): string {
  if ((pin.attachments ?? []).some((attachment) => attachment.workbook_asset)) return "Workbook upload";
  if (pin.stac_run_id?.trim()) return "STAC run";
  if ((pin.attachments?.length ?? 0) > 0) return "Upload";
  if (pin.note?.trim()) return "Workspace note";
  return "Workspace evidence";
}

function provenanceSummary(pin: EvidencePin): string {
  const attachments = pin.attachments ?? [];
  const stacItems = pin.stac_item_ids ?? [];
  const parts: string[] = [];
  const workbookAssets = attachments.map((attachment) => attachment.workbook_asset).filter(Boolean) as WorkbookEvidenceAsset[];

  if (stacItems.length === 1) parts.push(`STAC ${stacItems[0]}`);
  else if (stacItems.length > 1) parts.push(`${stacItems.length} STAC items`);

  if (workbookAssets.length === 1) {
    const workbook = workbookAssets[0]!;
    parts.push(`${workbook.file_kind.toUpperCase()} ${workbook.file_name}`);
    parts.push(`${workbook.sheet_count} sheet${workbook.sheet_count === 1 ? "" : "s"}`);
    if (workbook.record_groups.length) parts.push(`${workbook.record_groups.length} derived group${workbook.record_groups.length === 1 ? "" : "s"}`);
  } else if (workbookAssets.length > 1) {
    parts.push(`${workbookAssets.length} workbook assets`);
  }

  if (attachments.length === 1) parts.push(`Attachment ${attachments[0]?.filename ?? attachments[0]?.id}`);
  else if (attachments.length > 1) parts.push(`${attachments.length} attachments`);

  if (pin.note?.trim()) parts.push(pin.note.trim());

  return parts.join(" • ") || "Provenance pending";
}

function looksLikeLegacyPinTitle(value: string | undefined): boolean {
  const title = value?.trim() ?? "";
  return /^pin\s+/i.test(title) || /↔/.test(title);
}

function displayName(pin: EvidencePin): string {
  const stacItemId = pin.stac_item_ids?.[0]?.trim() || pin.itemId?.trim();
  if (stacItemId) return stacItemId;
  const attachmentName = pin.attachments?.[0]?.filename?.trim();
  if (attachmentName) return attachmentName;
  const title = pin.title?.trim();
  if (title && !looksLikeLegacyPinTitle(title)) return title;
  if (title) return title.replace(/^Pin\s+/i, "").replace(/\s*↔\s*/g, " ").trim() || title;
  return pin.id;
}

function earliestPinId(pins: EvidencePin[]): string {
  return [...pins]
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))[0]?.id ?? "unknown";
}

export function formatEvidenceInventoryId(value: string): string {
  const compact = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const suffix = compact.slice(0, 6) || "000000";
  return `EV-${suffix}`;
}

export function linkedRequirementIdsForEvidence(pin: EvidencePin): string[] {
  const explicitRuleId = pin.ruleId ? [pin.ruleId] : [];
  return uniqSorted([...explicitRuleId, ...(pin.cited_ids ?? [])], /^R-/i);
}

export function evidencePinDedupeKey(pin: EvidencePin): string {
  const stacItems = uniqSorted([...(pin.stac_item_ids ?? []), pin.itemId ?? ""]);
  if (stacItems.length) return `stac:${stacItems.join("|")}`;

  const attachmentSha = uniqSorted((pin.attachments ?? []).map((attachment) => attachment.sha256));
  if (attachmentSha.length) return `attachment:${attachmentSha.join("|")}`;

  const title = pin.title?.trim();
  if (title) return `title:${title.toLowerCase()}`;

  return `pin:${pin.id}`;
}

export function coalesceEvidencePins(pins: EvidencePin[]): EvidencePin[] {
  const groups = new Map<string, EvidencePin[]>();
  for (const pin of pins ?? []) {
    const dedupeKey = evidencePinDedupeKey(pin);
    const current = groups.get(dedupeKey) ?? [];
    current.push(pin);
    groups.set(dedupeKey, current);
  }

  const merged: EvidencePin[] = [];
  for (const group of groups.values()) {
    const ordered = [...group].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    const base = ordered[0]!;
    const cited_ids = uniqSorted(group.flatMap((pin) => pin.cited_ids ?? []));
    const linkedRuleIds = uniqSorted(group.flatMap((pin) => linkedRequirementIdsForEvidence(pin)));
    const stac_item_ids = uniqSorted(group.flatMap((pin) => [...(pin.stac_item_ids ?? []), pin.itemId ?? ""]));
    const attachments = uniqAttachments(group.flatMap((pin) => pin.attachments ?? []));
    const representative: EvidencePin = {
      ...base,
      title: displayName({ ...base, stac_item_ids, attachments }),
      itemId: stac_item_ids[0] ?? base.itemId,
      stac_item_ids: stac_item_ids.length ? stac_item_ids : undefined,
      stac_run_id: group.map((pin) => pin.stac_run_id).find((value) => value?.trim()),
      attachments: attachments.length ? attachments : undefined,
      cited_ids,
      ruleId: linkedRuleIds[0],
      created_at: ordered[0]?.created_at ?? base.created_at,
    };
    merged.push(representative);
  }

  return merged.sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
}

export function buildEvidenceInventory(pins: EvidencePin[]): EvidenceInventoryItem[] {
  return coalesceEvidencePins(pins).map((pin) => {
    const linked_requirement_ids = linkedRequirementIdsForEvidence(pin);
    const workbookAssets = uniqWorkbookAssets(pin.attachments ?? []);
    const workbook_record_groups = workbookAssets.flatMap((asset) =>
      asset.record_groups.map((group) => ({
        ...group,
        candidate_evidence_types: candidateEvidenceTypesForWorkbookGroup(group),
      })),
    );
    return {
      evidence_id: earliestPinId((pins ?? []).filter((candidate) => evidencePinDedupeKey(candidate) === evidencePinDedupeKey(pin))),
      dedupe_key: evidencePinDedupeKey(pin),
      display_name: displayName(pin),
      type: evidenceTypeLabel(pin),
      source_summary: sourceSummary(pin),
      provenance_summary: provenanceSummary(pin),
      added_at: pin.created_at,
      link_state: linked_requirement_ids.length ? "linked" : "unlinked",
      linked_requirement_ids,
      workbook_assets: workbookAssets.length ? workbookAssets : undefined,
      workbook_record_groups: workbook_record_groups.length ? workbook_record_groups : undefined,
    } satisfies EvidenceInventoryItem;
  });
}

function uniqWorkbookAssets(attachments: EvidenceAttachment[]): WorkbookEvidenceAsset[] {
  const seen = new Set<string>();
  const next: WorkbookEvidenceAsset[] = [];
  for (const attachment of attachments) {
    const asset = attachment.workbook_asset;
    if (!asset) continue;
    const key = `${asset.workbook_id}:${asset.file_sha256}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(asset);
  }
  return next.sort((a, b) => a.workbook_id.localeCompare(b.workbook_id));
}

export function candidateEvidenceTypesForWorkbookGroup(group: WorkbookRecordGroup): WorkbookCandidateEvidenceType[] {
  const next = new Set<WorkbookCandidateEvidenceType>(["spreadsheet-workbook"]);
  if (group.group_type === "calculation_table" || group.group_type === "parameter_source_table") {
    next.add("calculation-support");
  }
  if (group.group_type === "monitoring_period_table" || group.group_type === "sampling_log" || group.group_type === "activity_data_table") {
    next.add("monitoring-report");
  }
  return Array.from(next);
}

export function linkEvidencePinToRequirement(pins: EvidencePin[], evidenceId: string, ruleId: string): EvidencePin[] {
  const normalizedRuleId = ruleId.trim();
  if (!normalizedRuleId) return coalesceEvidencePins(pins);
  const next = pins.map((pin) => {
    if (pin.id !== evidenceId) return pin;
    const linked = uniqSorted([pin.ruleId ?? "", ...(pin.cited_ids ?? []), normalizedRuleId]);
    return {
      ...pin,
      ruleId: pin.ruleId?.trim() || normalizedRuleId,
      cited_ids: linked,
    };
  });
  return coalesceEvidencePins(next);
}

export function unlinkEvidencePinFromRequirement(pins: EvidencePin[], evidenceId: string, ruleId: string): EvidencePin[] {
  const normalizedRuleId = ruleId.trim();
  if (!normalizedRuleId) return coalesceEvidencePins(pins);
  const next = pins.map((pin) => {
    if (pin.id !== evidenceId) return pin;
    const cited_ids = uniqSorted((pin.cited_ids ?? []).filter((id) => id.trim() !== normalizedRuleId));
    const nextRuleId = pin.ruleId?.trim() === normalizedRuleId ? undefined : pin.ruleId;
    const linked = linkedRequirementIdsForEvidence({ ...pin, ruleId: nextRuleId, cited_ids });
    return {
      ...pin,
      ruleId: nextRuleId ?? linked[0],
      cited_ids,
    };
  });
  return coalesceEvidencePins(next);
}
