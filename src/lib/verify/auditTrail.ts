export type AuditEvent = {
  ruleId: string;
  methodology: string;
  version: string;
  action: "status_change" | "evidence_added" | "evidence_removed" | "review_created";
  previousStatus?: string;
  newStatus?: string;
  evidenceId?: string;
  actor: string;
  timestamp: string;
  note?: string;
};

const STORAGE_PREFIX = "article6:audit";

function storageKey(methodology: string, version: string): string {
  return `${STORAGE_PREFIX}:${methodology}:${version}`;
}

export function logAuditEvent(event: Omit<AuditEvent, "timestamp">): void {
  const full: AuditEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };
  const key = storageKey(event.methodology, event.version);
  try {
    const raw = localStorage.getItem(key);
    const events: AuditEvent[] = raw ? JSON.parse(raw) : [];
    events.push(full);
    localStorage.setItem(key, JSON.stringify(events));
  } catch {
    // Storage full or unavailable
  }
}

export function getAuditTrail(
  methodology: string,
  version: string,
  ruleId?: string,
): AuditEvent[] {
  try {
    const raw = localStorage.getItem(storageKey(methodology, version));
    const events: AuditEvent[] = raw ? JSON.parse(raw) : [];
    if (ruleId) return events.filter((e) => e.ruleId === ruleId);
    return events;
  } catch {
    return [];
  }
}

export function getAuditTrailForRule(
  ruleId: string,
  methodology: string,
  version: string,
): AuditEvent[] {
  return getAuditTrail(methodology, version, ruleId);
}
