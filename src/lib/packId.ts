const PACK_TAG_PREFIX = "methodologies-pack-";

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeHex(value: string): string | null {
  const normalized = normalizeText(value);
  if (!/^[0-9a-f]+$/i.test(normalized)) return null;
  return normalized;
}

export function extractPackId(input: string): string | null {
  const normalized = normalizeText(input);
  if (!normalized) return null;

  if (normalized.startsWith(PACK_TAG_PREFIX)) {
    const suffix = normalized.slice(PACK_TAG_PREFIX.length);
    return normalizeHex(suffix);
  }

  return normalizeHex(normalized);
}

export function equalsPack(a: string | null, b: string | null): boolean {
  if (a == null || b == null) return false;

  const extractedA = extractPackId(a);
  const extractedB = extractPackId(b);
  if (extractedA && extractedB) return extractedA === extractedB;

  return normalizeText(a) === normalizeText(b);
}

