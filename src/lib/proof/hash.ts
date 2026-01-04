function hexFromBytes(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256ArrayBuffer(buf: ArrayBuffer): Promise<string> {
  if (globalThis.crypto?.subtle?.digest) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", buf);
    return hexFromBytes(new Uint8Array(digest));
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require("crypto") as typeof import("crypto");
  return nodeCrypto.createHash("sha256").update(Buffer.from(buf)).digest("hex");
}

export async function sha256Text(input: string): Promise<string> {
  const bytes =
    typeof globalThis.TextEncoder !== "undefined"
      ? new globalThis.TextEncoder().encode(input)
      : // Node/Jest fallback (Buffer exists server-side).
        new Uint8Array(Buffer.from(input, "utf8"));
  return sha256ArrayBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

