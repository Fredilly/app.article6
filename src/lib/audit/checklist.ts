export type ChecklistItem = {
  id: string;
  label: string;
  description: string;
  category: "raw" | "processed" | "provenance";
};

export const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: "raw-pages",
    label: "Raw PDF page rendered",
    description: "Confirm the source PDF page displays correctly for comparison.",
    category: "raw",
  },
  {
    id: "processed-rules",
    label: "Rules extracted correctly",
    description: "Verify the processed rule text matches the raw document.",
    category: "processed",
  },
  {
    id: "anchors-provenance",
    label: "Anchors & hashes verified",
    description: "Spot-check that anchor IDs resolve and the SHA-256 hash matches the raw section.",
    category: "provenance",
  },
];
