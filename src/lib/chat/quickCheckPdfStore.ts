/** Server-side PDF file reference store.
 *
 * Stores temp file paths keyed by opaque tokens so the browser never
 * sees raw server filesystem paths. Tokens expire after TTL seconds.
 */
const store = new Map<string, { filePath: string; expiresAt: number }>();

const PDF_REF_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cleanExpired(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt < now) {
      store.delete(key);
    }
  }
}

export function storePdfRef(filePath: string): string {
  cleanExpired();
  const token = `pdf:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
  store.set(token, { filePath, expiresAt: Date.now() + PDF_REF_TTL_MS });
  return token;
}

export function resolvePdfRef(token: string): string | undefined {
  cleanExpired();
  const entry = store.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    store.delete(token);
    return undefined;
  }
  return entry.filePath;
}
