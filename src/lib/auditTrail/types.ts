export type AuditTrailEventKind =
  | "method.select"
  | "evidence.input"
  | "rule.jump"
  | "evidence.feature.select"
  | "export.audit_trail";

export type AuditTrailEvent = {
  schema_version: "audittrail.v1";
  ts_iso: string;
  kind: AuditTrailEventKind;
  payload: Record<string, unknown>;
};

export type AuditTrailEventInput = {
  kind: AuditTrailEventKind;
  payload?: Record<string, unknown>;
  ts_iso?: string;
};

export type AuditTrailExport = {
  schema_version: "audittrail.v1";
  events: AuditTrailEvent[];
};
