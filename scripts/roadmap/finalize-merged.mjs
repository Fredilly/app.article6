import { normalizePrId, normalizeRoadmapItemId, normalizeStatus } from "./roadmap-lib.mjs";

function normalizeItem(item) {
  const id = normalizeRoadmapItemId(item?.id) ?? item?.id ?? null;
  const status = normalizeStatus(item?.status) ?? item?.status ?? null;
  return { id, status };
}

export function finalizeMergedItems(items, prKey) {
  const normalizedPrKey = normalizePrId(prKey) ?? null;
  const out = [];

  for (const item of items ?? []) {
    const normalized = normalizeItem(item);
    if (!normalized.id) continue;
    let status = normalized.status;

    if (status === "in-progress") status = "done";
    if (normalizedPrKey && normalized.id === normalizedPrKey) status = "done";
    if (!status) continue;

    out.push({ id: normalized.id, status });
  }

  return { prKey: normalizedPrKey, items: out };
}
