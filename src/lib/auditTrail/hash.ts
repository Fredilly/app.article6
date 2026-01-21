function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  if (globalThis.crypto?.subtle?.digest) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return toHex(digest);
  }
  const { createHash } = await import("crypto");
  return createHash("sha256").update(bytes).digest("hex");
}
