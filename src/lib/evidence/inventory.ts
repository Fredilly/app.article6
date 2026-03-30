import type { EvidencePin } from "@/lib/proofMap/types";

export type EvidenceInventoryLinkState = "unlinked" | "linked";

export type EvidenceInventoryItem = {
  evidence_id: string;
  display_name: string;
  type: string;
  source: string;
  provenance_summary: string;
  added_at: string;
  link_state: EvidenceInventoryLinkState;
  linked_requirement_ids: string[];
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

function evidenceTypeLabel(pin: EvidencePin): string {
  const attachments = pin.attachments ?? [];
  const hasPdf = attachments.some((attachment) => attachment.mime === "application/pdf");
  const hasImage = attachments.some((attachment) => attachment.mime.startsWith("image/"));
  if ((pin.stac_item_ids?.length ?? 0) > 0 && attachments.length > 0) return "stac evidence bundle";
  if ((pin.stac_item_ids?.length ?? 0) > 0) return "stac item";
  if (hasPdf) return "uploaded document";
  if (hasImage) return "uploaded image";
  if (pin.kind === "doc") return "document";
  if (pin.kind === "photo") return "photo";
  return "note";
}

function sourceSummary(pin: EvidencePin): string {
  if (pin.stac_run_id?.trim()) return `STAC run ${pin.stac_run_id.trim()}`;
  const attachment = pin.attachments?.[0];
  if (attachment?.filename?.trim()) return `Upload ${attachment.filename.trim()}`;
  if (pin.note?.trim()) return "Workspace note";
  return "Workspace evidence";
}

function provenanceSummary(pin: EvidencePin): string {
  const attachments = pin.attachments ?? [];
  const stacItems = pin.stac_item_ids ?? [];
  const parts: string[] = [];

  if (stacItems.length === 1) parts.push(`STAC ${stacItems[0]}`);
  else if (stacItems.length > 1) parts.push(`${stacItems.length} STAC items`);

  if (attachments.length === 1) parts.push(`Attachment ${attachments[0]?.filename ?? attachments[0]?.id}`);
  else if (attachments.length > 1) parts.push(`${attachments.length} attachments`);

  if (pin.note?.trim()) parts.push(pin.note.trim());

  return parts.join(" • ") || "Provenance pending";
}

function displayName(pin: EvidencePin): string {
  const title = pin.title?.trim();
  if (title) return title;
  const attachmentName = pin.attachments?.[0]?.filename?.trim();
  if (attachmentName) return attachmentName;
  const stacItemId = pin.stac_item_ids?.[0]?.trim();
  if (stacItemId) return stacItemId;
  return pin.id;
}

export function linkedRequirementIdsForEvidence(pin: EvidencePin): string[] {
  const explicitRuleId = pin.ruleId ? [pin.ruleId] : [];
  return uniqSorted([...explicitRuleId, ...(pin.cited_ids ?? [])], /^R-/i);
}

export function buildEvidenceInventory(pins: EvidencePin[]): EvidenceInventoryItem[] {
  return [...(pins ?? [])]
    .map((pin) => {
      const linked_requirement_ids = linkedRequirementIdsForEvidence(pin);
      return {
        evidence_id: pin.id,
        display_name: displayName(pin),
        type: evidenceTypeLabel(pin),
        source: sourceSummary(pin),
        provenance_summary: provenanceSummary(pin),
        added_at: pin.created_at,
        link_state: linked_requirement_ids.length ? "linked" : "unlinked",
        linked_requirement_ids,
      } satisfies EvidenceInventoryItem;
    })
    .sort((a, b) => {
      const time = b.added_at.localeCompare(a.added_at);
      return time !== 0 ? time : a.evidence_id.localeCompare(b.evidence_id);
    });
}

export function linkEvidencePinToRequirement(pins: EvidencePin[], evidenceId: string, ruleId: string): EvidencePin[] {
  const normalizedRuleId = ruleId.trim();
  if (!normalizedRuleId) return pins;
  return pins.map((pin) => {
    if (pin.id !== evidenceId) return pin;
    const linked = uniqSorted([pin.ruleId ?? "", ...(pin.cited_ids ?? []), normalizedRuleId]);
    return {
      ...pin,
      ruleId: pin.ruleId?.trim() || normalizedRuleId,
      cited_ids: linked,
    };
  });
}

export function unlinkEvidencePinFromRequirement(pins: EvidencePin[], evidenceId: string, ruleId: string): EvidencePin[] {
  const normalizedRuleId = ruleId.trim();
  if (!normalizedRuleId) return pins;
  return pins.map((pin) => {
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
}
