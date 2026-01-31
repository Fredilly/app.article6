import type { IntakeItem, IntakeItemInput, PilotCadence } from "@/lib/intake/types";

const REGISTRY_KEY = "a6:intake:registry";
const CADENCE_KEY = "a6:intake:cadence";

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  if (window.localStorage) return window.localStorage;
  return null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `intake_${nowIso()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeItems(raw: unknown): IntakeItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item) => item && typeof item === "object") as IntakeItem[];
}

export function loadIntakeRegistry(): IntakeItem[] {
  const storage = getStorage();
  if (!storage) return [];
  const raw = storage.getItem(REGISTRY_KEY);
  if (!raw) return [];
  try {
    return normalizeItems(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveIntakeRegistry(items: IntakeItem[]): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(REGISTRY_KEY, JSON.stringify(items));
}

export function addIntakeItem(input: IntakeItemInput): IntakeItem {
  const next: IntakeItem = {
    id: newId(),
    created_at: input.created_at ?? nowIso(),
    method: input.method,
    version: input.version,
    rule_id: input.rule_id ?? null,
    sectionId: input.sectionId ?? null,
    type: input.type,
    description: input.description,
    status: input.status ?? "new",
    owner: input.owner ?? null,
  };
  const items = loadIntakeRegistry();
  const updated = [next, ...items];
  saveIntakeRegistry(updated);
  return next;
}

export function updateIntakeItem(id: string, updates: Partial<IntakeItem>): IntakeItem[] {
  const items = loadIntakeRegistry();
  const next = items.map((item) => (item.id === id ? { ...item, ...updates } : item));
  saveIntakeRegistry(next);
  return next;
}

export function loadPilotCadence(): PilotCadence {
  const storage = getStorage();
  if (!storage) return {};
  const raw = storage.getItem(CADENCE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return {
      last_review_at: typeof parsed.last_review_at === "string" ? parsed.last_review_at : null,
      next_review_at: typeof parsed.next_review_at === "string" ? parsed.next_review_at : null,
    };
  } catch {
    return {};
  }
}

export function savePilotCadence(next: PilotCadence): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(CADENCE_KEY, JSON.stringify(next));
}
