import { ManifestRule } from "../_types";

export function getRulePdfUrl(rule: ManifestRule) {
  if (rule.pdfId) {
    const anchor = rule.anchor ?? "";
    return `/pdf/${rule.pdfId}${anchor}`;
  }
  if (rule.anchor) return rule.anchor;
  const href = (rule as { pdfHref?: string }).pdfHref;
  if (typeof href === "string") return href;
  return "";
}

export function getRulePdfPage(rule: ManifestRule) {
  if (typeof rule.pdfPage === "number") return rule.pdfPage;
  const anchor = rule.anchor ?? "";
  const match = anchor.match(/page=(\d+)/i);
  if (match) return Number.parseInt(match[1] ?? "", 10);
  return undefined;
}
