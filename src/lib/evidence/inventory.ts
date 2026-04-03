import type {
  EvidenceAttachment,
  EvidencePin,
  PddDocumentAsset,
  PddFragment,
  PddFragmentLink,
  WorkbookEvidenceAsset,
  WorkbookRecordGroup,
} from "@/lib/proofMap/types";
import { isRuleLikeId } from "@/lib/proofMap/pins";

export type EvidenceInventoryLinkState = "unlinked" | "linked";
export type EvidenceInventoryKind = "stac-item" | "workbook" | "pdd" | "upload" | "document" | "photo" | "note";
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
  kind: EvidenceInventoryKind;
  type: string;
  source_summary: string;
  provenance_summary: string;
  added_at: string;
  link_state: EvidenceInventoryLinkState;
  linked_requirement_ids: string[];
  pdd_document?: PddDocumentAsset;
  pdd_fragments?: PddFragment[];
  pdd_fragment_links?: PddFragmentLink[];
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

function asPositiveInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const rounded = Math.trunc(value);
  return rounded > 0 ? rounded : undefined;
}

function trimOrUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizePddDocument(pin: EvidencePin): PddDocumentAsset | undefined {
  if (pin.kind !== "pdd" && !pin.pdd_document) return undefined;
  const fromPin = pin.pdd_document;
  if (fromPin?.file_name?.trim()) {
    return {
      evidence_id: pin.id,
      attachment_id: trimOrUndefined(fromPin.attachment_id ?? undefined) ?? null,
      file_name: fromPin.file_name.trim(),
      mime: trimOrUndefined(fromPin.mime) ?? "application/pdf",
      added_at: trimOrUndefined(fromPin.added_at) ?? pin.created_at,
      sha256: trimOrUndefined(fromPin.sha256 ?? undefined) ?? null,
    };
  }

  const attachment = (pin.attachments ?? []).find((item) => item.mime === "application/pdf") ?? pin.attachments?.[0];
  if (!attachment) return undefined;
  return {
    evidence_id: pin.id,
    attachment_id: attachment.id,
    file_name: attachment.filename,
    mime: attachment.mime,
    added_at: attachment.created_at ?? pin.created_at,
    sha256: attachment.sha256,
  };
}

function normalizePddFragments(pin: EvidencePin): PddFragment[] {
  const next = new Map<string, PddFragment>();
  for (const raw of pin.pdd_fragments ?? []) {
    const fragment_id = trimOrUndefined(raw.fragment_id);
    if (!fragment_id) continue;
    const page_start = asPositiveInt(raw.page_start);
    const page_end = asPositiveInt(raw.page_end);
    next.set(fragment_id, {
      fragment_id,
      evidence_id: pin.id,
      page_start,
      page_end: page_end ?? page_start,
      section_label: trimOrUndefined(raw.section_label),
      section_heading: trimOrUndefined(raw.section_heading),
      excerpt: trimOrUndefined(raw.excerpt),
      bbox_hint: raw.bbox_hint ?? null,
    });
  }
  return Array.from(next.values()).sort((a, b) => a.fragment_id.localeCompare(b.fragment_id));
}

function normalizePddFragmentLinks(pin: EvidencePin, fragments?: PddFragment[]): PddFragmentLink[] {
  const fragmentIds = new Set((fragments ?? normalizePddFragments(pin)).map((fragment) => fragment.fragment_id));
  const next = new Map<string, PddFragmentLink>();
  for (const raw of pin.pdd_fragment_links ?? []) {
    const fragment_id = trimOrUndefined(raw.fragment_id);
    const rule_id = trimOrUndefined(raw.rule_id);
    if (!fragment_id || !rule_id || !isRuleLikeId(rule_id) || !fragmentIds.has(fragment_id)) continue;
    const key = `${fragment_id}::${rule_id}`;
    next.set(key, {
      fragment_id,
      rule_id,
      linked_at: trimOrUndefined(raw.linked_at) ?? pin.created_at,
    });
  }
  return Array.from(next.values()).sort((a, b) =>
    a.fragment_id.localeCompare(b.fragment_id) || a.rule_id.localeCompare(b.rule_id),
  );
}

function syncPddRuleLinks(pin: EvidencePin): EvidencePin {
  const fragments = normalizePddFragments(pin);
  const pdd_fragment_links = normalizePddFragmentLinks(pin, fragments);
  if (pin.kind !== "pdd" && !pin.pdd_document && !pdd_fragment_links.length && !fragments.length) {
    return pin;
  }
  const ruleIds = uniqSorted(pdd_fragment_links.map((link) => link.rule_id)).filter((value) => isRuleLikeId(value));
  const preservedCitations = uniqSorted((pin.cited_ids ?? []).filter((value) => !isRuleLikeId(value)));
  return {
    ...pin,
    pdd_document: normalizePddDocument(pin) ?? pin.pdd_document ?? undefined,
    pdd_fragments: fragments.length ? fragments : undefined,
    pdd_fragment_links: pdd_fragment_links.length ? pdd_fragment_links : undefined,
    ruleId: ruleIds[0] ?? (pin.ruleId && isRuleLikeId(pin.ruleId) ? pin.ruleId : undefined),
    cited_ids: uniqSorted([...preservedCitations, ...ruleIds]),
  };
}

function inventoryKind(pin: EvidencePin): EvidenceInventoryKind {
  const attachments = pin.attachments ?? [];
  const hasWorkbook = attachments.some((attachment) => attachment.workbook_asset);
  const hasPdf = attachments.some((attachment) => attachment.mime === "application/pdf");
  const hasImage = attachments.some((attachment) => attachment.mime.startsWith("image/"));
  if ((pin.stac_item_ids?.length ?? 0) > 0) return "stac-item";
  if (pin.kind === "pdd" || Boolean(pin.pdd_document)) return "pdd";
  if (hasWorkbook) return "workbook";
  if (hasPdf || attachments.length > 0) return "upload";
  if (hasImage || pin.kind === "photo") return "photo";
  if (pin.kind === "doc") return "document";
  return "note";
}

function evidenceTypeLabel(pin: EvidencePin): string {
  const kind = inventoryKind(pin);
  if (kind === "stac-item") return "STAC item";
  if (kind === "workbook") return "Workbook";
  if (kind === "pdd") return "PDD";
  if (kind === "document") return "Document";
  if (kind === "photo") return "Photo";
  if (kind === "upload") return "Upload";
  return "Note";
}

function sourceSummary(pin: EvidencePin): string {
  if (inventoryKind(pin) === "pdd") return "PDD upload";
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
  const pddDocument = normalizePddDocument(pin);
  const pddFragments = normalizePddFragments(pin);

  if (stacItems.length === 1) parts.push(`STAC ${stacItems[0]}`);
  else if (stacItems.length > 1) parts.push(`${stacItems.length} STAC items`);

  if (pddDocument) {
    parts.push(pddDocument.file_name);
    if (pddFragments.length === 1) parts.push("1 fragment");
    else if (pddFragments.length > 1) parts.push(`${pddFragments.length} fragments`);
  }

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
  const pddLinks = normalizePddFragmentLinks(pin).map((link) => link.rule_id);
  const explicitRuleId = pin.ruleId ? [pin.ruleId] : [];
  return uniqSorted([...explicitRuleId, ...(pin.cited_ids ?? []), ...pddLinks]).filter((value) => isRuleLikeId(value));
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
    const pdd_document = group.map((pin) => normalizePddDocument(pin)).find(Boolean);
    const pdd_fragments = Array.from(
      new Map(
        group
          .flatMap((pin) => normalizePddFragments(pin))
          .map((fragment) => [fragment.fragment_id, fragment] as const),
      ).values(),
    ).sort((a, b) => a.fragment_id.localeCompare(b.fragment_id));
    const pdd_fragment_links = Array.from(
      new Map(
        group
          .flatMap((pin) => normalizePddFragmentLinks(pin))
          .map((link) => [`${link.fragment_id}::${link.rule_id}`, link] as const),
      ).values(),
    ).sort((a, b) => a.fragment_id.localeCompare(b.fragment_id) || a.rule_id.localeCompare(b.rule_id));
    const representative = syncPddRuleLinks({
      ...base,
      kind: base.kind === "pdd" || pdd_document ? "pdd" : base.kind,
      title: displayName({ ...base, stac_item_ids, attachments }),
      itemId: stac_item_ids[0] ?? base.itemId,
      stac_item_ids: stac_item_ids.length ? stac_item_ids : undefined,
      stac_run_id: group.map((pin) => pin.stac_run_id).find((value) => value?.trim()),
      attachments: attachments.length ? attachments : undefined,
      cited_ids,
      ruleId: linkedRuleIds[0],
      pdd_document: pdd_document ?? undefined,
      pdd_fragments: pdd_fragments.length ? pdd_fragments : undefined,
      pdd_fragment_links: pdd_fragment_links.length ? pdd_fragment_links : undefined,
      created_at: ordered[0]?.created_at ?? base.created_at,
    });
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
      kind: inventoryKind(pin),
      type: evidenceTypeLabel(pin),
      source_summary: sourceSummary(pin),
      provenance_summary: provenanceSummary(pin),
      added_at: pin.created_at,
      link_state: linked_requirement_ids.length ? "linked" : "unlinked",
      linked_requirement_ids,
      pdd_document: normalizePddDocument(pin),
      pdd_fragments: normalizePddFragments(pin),
      pdd_fragment_links: normalizePddFragmentLinks(pin),
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

function newFragmentId(evidenceId: string): string {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(16).slice(2, 10);
  return `${evidenceId}:frag:${suffix}`;
}

export function upsertPddFragmentOnEvidencePin(
  pins: EvidencePin[],
  evidenceId: string,
  fragment: Omit<PddFragment, "fragment_id" | "evidence_id"> & { fragment_id?: string },
): EvidencePin[] {
  const next = pins.map((pin) => {
    if (pin.id !== evidenceId) return pin;
    const fragment_id = trimOrUndefined(fragment.fragment_id) ?? newFragmentId(evidenceId);
    const page_start = asPositiveInt(fragment.page_start);
    const page_end = asPositiveInt(fragment.page_end) ?? page_start;
    const entry: PddFragment = {
      fragment_id,
      evidence_id: evidenceId,
      page_start,
      page_end,
      section_label: trimOrUndefined(fragment.section_label),
      section_heading: trimOrUndefined(fragment.section_heading),
      excerpt: trimOrUndefined(fragment.excerpt),
      bbox_hint: fragment.bbox_hint ?? null,
    };
    return {
      ...pin,
      kind: "pdd" as const,
      pdd_fragments: [
        ...(pin.pdd_fragments ?? []).filter((item) => item.fragment_id !== fragment_id),
        entry,
      ],
    };
  });
  return coalesceEvidencePins(next);
}

export function linkPddFragmentToRequirement(
  pins: EvidencePin[],
  evidenceId: string,
  fragmentId: string,
  ruleId: string,
): EvidencePin[] {
  const normalizedRuleId = ruleId.trim();
  const normalizedFragmentId = fragmentId.trim();
  if (!normalizedRuleId || !normalizedFragmentId) return coalesceEvidencePins(pins);
  const next = pins.map((pin) => {
    if (pin.id !== evidenceId) return pin;
    return {
      ...pin,
      kind: "pdd" as const,
      pdd_fragment_links: [
        ...(pin.pdd_fragment_links ?? []),
        { fragment_id: normalizedFragmentId, rule_id: normalizedRuleId, linked_at: pin.created_at },
      ],
    };
  });
  return coalesceEvidencePins(next);
}

export function unlinkPddFragmentFromRequirement(
  pins: EvidencePin[],
  evidenceId: string,
  fragmentId: string,
  ruleId: string,
): EvidencePin[] {
  const normalizedRuleId = ruleId.trim();
  const normalizedFragmentId = fragmentId.trim();
  if (!normalizedRuleId || !normalizedFragmentId) return coalesceEvidencePins(pins);
  const next = pins.map((pin) => {
    if (pin.id !== evidenceId) return pin;
    return {
      ...pin,
      pdd_fragment_links: (pin.pdd_fragment_links ?? []).filter(
        (link) => !(link.fragment_id === normalizedFragmentId && link.rule_id === normalizedRuleId),
      ),
    };
  });
  return coalesceEvidencePins(next);
}
