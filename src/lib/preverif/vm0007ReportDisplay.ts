import type { Vm0007EvidenceMapRow } from "@/lib/preverif/fixtureBackedVm0007Report";

export type Vm0007DisplayField = {
  label: string;
  value: string | number;
};

export type Vm0007RejectedEvidenceBlock = {
  label: "Rejected evidence";
  entries: Array<{
    quote: string;
    rejectionReason: string;
  }>;
};

export type Vm0007DisplayBlock = Vm0007DisplayField | Vm0007RejectedEvidenceBlock;

export function hasText(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}

function provenanceFields(row: Vm0007EvidenceMapRow): Vm0007DisplayField[] {
  const fields: Vm0007DisplayField[] = [];

  if (hasText(row.acceptedQuote)) {
    fields.push({
      label: row.status === "UNCLEAR" ? "Weak quote" : "Accepted quote",
      value: row.acceptedQuote,
    });
  }

  if (row.page != null) {
    fields.push({ label: "Page", value: row.page });
  }

  if (hasText(row.sectionHeading)) {
    fields.push({ label: "Section", value: row.sectionHeading });
  }

  return fields;
}

export function buildEvidenceMapDisplayBlocks(row: Vm0007EvidenceMapRow): Vm0007DisplayBlock[] {
  const blocks: Vm0007DisplayBlock[] = [...provenanceFields(row)];

  if (row.status === "FOUND" && hasText(row.whyEvidenceIsAccepted)) {
    blocks.push({ label: "Accepted reason", value: row.whyEvidenceIsAccepted });
  }

  if (row.status === "UNCLEAR" && hasText(row.whyEvidenceIsAccepted)) {
    blocks.push({ label: "Why this is insufficient", value: row.whyEvidenceIsAccepted });
  }

  if (row.status === "UNCLEAR" && row.rejectedEvidenceExamples.length > 0) {
    blocks.push({ label: "Rejected evidence", entries: row.rejectedEvidenceExamples });
  }

  if (row.status === "UNCLEAR" && hasText(row.whyRejectedEvidenceIsNotEnough)) {
    blocks.push({ label: "Why the rejected evidence is not enough", value: row.whyRejectedEvidenceIsNotEnough });
  }

  if (row.status === "UNCLEAR" && hasText(row.clientAction)) {
    blocks.push({ label: "Client action", value: row.clientAction });
  }

  if (row.status === "MISSING" && hasText(row.whyEvidenceIsAccepted)) {
    blocks.push({ label: "Missing reason", value: row.whyEvidenceIsAccepted });
  }

  if (row.status === "MISSING" && hasText(row.clientAction)) {
    blocks.push({ label: "Client action", value: row.clientAction });
  }

  if (row.status === "N/A" && hasText(row.naReason)) {
    blocks.push({ label: "N/A reason", value: row.naReason });
  }

  return blocks;
}

export function buildPriorityActionDisplayBlocks(row: Vm0007EvidenceMapRow): Vm0007DisplayBlock[] {
  const blocks: Vm0007DisplayBlock[] = [];

  if (row.status === "UNCLEAR") {
    blocks.push(...provenanceFields(row));

    if (hasText(row.whyEvidenceIsAccepted)) {
      blocks.push({ label: "Why this is insufficient", value: row.whyEvidenceIsAccepted });
    }

    if (row.rejectedEvidenceExamples.length > 0) {
      blocks.push({ label: "Rejected evidence", entries: row.rejectedEvidenceExamples });
    }

    if (hasText(row.whyRejectedEvidenceIsNotEnough)) {
      blocks.push({ label: "Why the rejected evidence is not enough", value: row.whyRejectedEvidenceIsNotEnough });
    }

    if (hasText(row.clientAction)) {
      blocks.push({ label: "Client action", value: row.clientAction });
    }

    return blocks;
  }

  if (row.status === "MISSING") {
    if (hasText(row.whyEvidenceIsAccepted)) {
      blocks.push({ label: "Missing reason", value: row.whyEvidenceIsAccepted });
    }

    if (hasText(row.clientAction)) {
      blocks.push({ label: "Client action", value: row.clientAction });
    }
  }

  return blocks;
}
