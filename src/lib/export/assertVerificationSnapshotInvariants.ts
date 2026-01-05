function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFeatureCollection(value: unknown): value is { type: "FeatureCollection"; features: unknown[] } {
  return isRecord(value) && value.type === "FeatureCollection" && Array.isArray(value.features);
}

function parseProvenanceText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of (text ?? "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = value;
  }
  return out;
}

function executedAtForRun(run: { ended_at?: string; created_at?: string }): string {
  const endedAt = typeof run.ended_at === "string" ? run.ended_at : "";
  const createdAt = typeof run.created_at === "string" ? run.created_at : "";
  return endedAt || createdAt || "none";
}

function idsFromStacLike(input: unknown): { count: number; ids: Set<string> } {
  const ids = new Set<string>();

  if (Array.isArray(input)) {
    for (const item of input) {
      if (!isRecord(item)) continue;
      const id =
        (typeof item.id === "string" && item.id) ||
        (isRecord(item["properties"]) && typeof item["properties"]["id"] === "string" && item["properties"]["id"]) ||
        "";
      if (id) ids.add(id);
    }
    return { count: input.length, ids };
  }

  if (isFeatureCollection(input)) {
    const features = input.features ?? [];
    for (const rawFeature of features) {
      if (!isRecord(rawFeature)) continue;
      const props = isRecord(rawFeature["properties"]) ? (rawFeature["properties"] as Record<string, unknown>) : {};
      const id =
        (typeof props["id"] === "string" && props["id"]) ||
        (typeof rawFeature["id"] === "string" && rawFeature["id"]) ||
        (typeof rawFeature["id"] === "number" && String(rawFeature["id"])) ||
        "";
      if (id) ids.add(id);
    }
    return { count: features.length, ids };
  }

  if (isRecord(input) && Array.isArray(input.items)) {
    const items = input.items as unknown[];
    for (const item of items) {
      if (!isRecord(item)) continue;
      const props = isRecord(item["properties"]) ? (item["properties"] as Record<string, unknown>) : {};
      const id =
        (typeof item["id"] === "string" && item["id"]) || (typeof props["id"] === "string" && props["id"]) || "";
      if (id) ids.add(id);
    }
    return { count: items.length, ids };
  }

  if (isRecord(input) && Array.isArray(input.features)) {
    const features = input.features as unknown[];
    for (const rawFeature of features) {
      if (!isRecord(rawFeature)) continue;
      const props = isRecord(rawFeature["properties"]) ? (rawFeature["properties"] as Record<string, unknown>) : {};
      const id =
        (typeof props["id"] === "string" && props["id"]) ||
        (typeof rawFeature["id"] === "string" && rawFeature["id"]) ||
        (typeof rawFeature["id"] === "number" && String(rawFeature["id"])) ||
        "";
      if (id) ids.add(id);
    }
    return { count: features.length, ids };
  }

  return { count: 0, ids };
}

function diffSets(expected: Set<string>, actual: Set<string>): { missing: string[]; extra: string[] } {
  const missing: string[] = [];
  const extra: string[] = [];
  for (const id of expected) if (!actual.has(id)) missing.push(id);
  for (const id of actual) if (!expected.has(id)) extra.push(id);
  missing.sort();
  extra.sort();
  return { missing, extra };
}

export function assertVerificationSnapshotInvariants(input: {
  selectedRun: { id: string; status: string; ended_at?: string; created_at?: string; result_json: unknown };
  provenanceText: string;
  stacItems: unknown[] | { features?: unknown[]; items?: unknown[] };
  evidence: { type: "FeatureCollection"; features: unknown[] };
}): void {
  const expected = idsFromStacLike(input.selectedRun.result_json);
  const stacItems = idsFromStacLike(input.stacItems);

  const evidenceFeatures = Array.isArray(input.evidence?.features) ? input.evidence.features : [];
  const evidenceIds = new Set<string>();
  for (let index = 0; index < evidenceFeatures.length; index++) {
    const feature = evidenceFeatures[index];
    const props = isRecord(feature) && isRecord(feature["properties"]) ? (feature["properties"] as Record<string, unknown>) : null;
    const id = props && typeof props.id === "string" ? props.id.trim() : "";
    if (!id) {
      throw new Error(`Invariant failed: evidence feature missing properties.id (index=${index}).`);
    }
    evidenceIds.add(id);
  }

  if (expected.count !== stacItems.count || expected.count !== evidenceFeatures.length) {
    throw new Error(
      `Invariant failed: item count mismatch (expected=${expected.count}, stacItems=${stacItems.count}, evidence=${evidenceFeatures.length}).`,
    );
  }

  const diffStac = diffSets(expected.ids, stacItems.ids);
  if (diffStac.missing.length || diffStac.extra.length) {
    throw new Error(
      `Invariant failed: STAC item id set mismatch vs stored run payload (missing=${JSON.stringify(
        diffStac.missing.slice(0, 20),
      )}, extra=${JSON.stringify(diffStac.extra.slice(0, 20))}).`,
    );
  }

  const diffEvidence = diffSets(expected.ids, evidenceIds);
  if (diffEvidence.missing.length || diffEvidence.extra.length) {
    throw new Error(
      `Invariant failed: evidence id set mismatch vs stored run payload (missing=${JSON.stringify(
        diffEvidence.missing.slice(0, 20),
      )}, extra=${JSON.stringify(diffEvidence.extra.slice(0, 20))}).`,
    );
  }

  const diffCross = diffSets(stacItems.ids, evidenceIds);
  if (diffCross.missing.length || diffCross.extra.length) {
    throw new Error(
      `Invariant failed: evidence and stac_items disagree on ids (missing_in_evidence=${JSON.stringify(
        diffCross.missing.slice(0, 20),
      )}, extra_in_evidence=${JSON.stringify(diffCross.extra.slice(0, 20))}).`,
    );
  }

  const provenance = parseProvenanceText(input.provenanceText);
  const expectedRunId = input.selectedRun.id || "none";
  const expectedStatus = input.selectedRun.status || "none";
  const expectedExecutedAt = executedAtForRun(input.selectedRun);

  if ((provenance.stac_run_id ?? "none") !== expectedRunId) {
    throw new Error(
      `Invariant failed: provenance stac_run_id mismatch (expected=${expectedRunId}, actual=${provenance.stac_run_id ?? "none"}).`,
    );
  }
  if ((provenance.stac_status ?? "none") !== expectedStatus) {
    throw new Error(
      `Invariant failed: provenance stac_status mismatch (expected=${expectedStatus}, actual=${provenance.stac_status ?? "none"}).`,
    );
  }
  if ((provenance.stac_executed_at ?? "none") !== expectedExecutedAt) {
    throw new Error(
      `Invariant failed: provenance stac_executed_at mismatch (expected=${expectedExecutedAt}, actual=${provenance.stac_executed_at ?? "none"}).`,
    );
  }
}
