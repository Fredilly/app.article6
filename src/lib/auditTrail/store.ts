"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { canonicalJsonStringify } from "@/lib/auditTrail/canonicalJson";
import { sha256Hex } from "@/lib/auditTrail/hash";
import type { AuditTrailEvent, AuditTrailEventInput, AuditTrailExport } from "@/lib/auditTrail/types";

const STORAGE_KEY = "a6_audit_trail_v1";

function normalizeEvents(value: unknown): AuditTrailEvent[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const kind = typeof record.kind === "string" ? record.kind : "";
      const ts_iso = typeof record.ts_iso === "string" ? record.ts_iso : "";
      const payload = record.payload && typeof record.payload === "object" ? (record.payload as Record<string, unknown>) : {};
      if (!kind || !ts_iso) return null;
      return { schema_version: "audittrail.v1", kind, ts_iso, payload } as AuditTrailEvent;
    })
    .filter((item): item is AuditTrailEvent => item !== null);
}

function loadEventsFromSession(): AuditTrailEvent[] {
  if (typeof window === "undefined") return [];
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return normalizeEvents(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function useAuditTrail() {
  const [events, setEvents] = useState<AuditTrailEvent[]>(() => loadEventsFromSession());
  const [exportSha256, setExportSha256] = useState("");

  const appendEvent = useCallback((input: AuditTrailEventInput) => {
    const next: AuditTrailEvent = {
      schema_version: "audittrail.v1",
      ts_iso: input.ts_iso ?? new Date().toISOString(),
      kind: input.kind,
      payload: input.payload ?? {},
    };
    setEvents((prev) => [...prev, next]);
  }, []);

  const clearTrail = useCallback(() => setEvents([]), []);

  const exportTrail = useCallback<() => AuditTrailExport>(
    () => ({
      schema_version: "audittrail.v1",
      events,
    }),
    [events],
  );

  const exportJson = useMemo(() => canonicalJsonStringify(exportTrail()), [exportTrail]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const hash = await sha256Hex(exportJson);
      if (active) setExportSha256(hash);
    })();
    return () => {
      active = false;
    };
  }, [exportJson]);

  return {
    events,
    appendEvent,
    clearTrail,
    exportTrail,
    exportJson,
    exportSha256,
  };
}

export type { AuditTrailEventInput } from "@/lib/auditTrail/types";
