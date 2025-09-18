import type { JsonValue } from "./schema";

export function formatJsonValue(value: JsonValue): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    return value.map(formatJsonValue).join(", ");
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return "[object]";
    }
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toString() : "NaN";
  }
  return String(value);
}
