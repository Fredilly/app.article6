# Deployment Triage (Vercel) — PR Green / Deployment Red

This repo uses Vercel previews per PR. It’s possible to see:
- GitHub checks ✅ (latest commit passes)
- Vercel “Deployment: Error” 🔴 (an earlier deployment attempt failed)

## What “PR green / deployment red” usually means
Most often: **stale failure**.
- A previous commit failed to build on Vercel.
- A later commit fixed it and deployed successfully.
- Vercel’s UI still shows the older failed deployment in history.

## Fast decision tree (2 minutes)

### A) Is the latest deployment healthy?
1) In the PR, open the latest Vercel check and click **View deployment**
2) If the preview URL loads and the page works → **ignore older red entries**

### B) If the latest deployment is failing
1) In Vercel build logs, confirm the **Commit SHA**
2) If it’s not the PR HEAD → **stale**
3) If it matches PR HEAD → **real failure**; fix and push

## Common real failures + canonical fixes

### 1) Node engines mismatch on Vercel
Symptom (logs):
- Warning: engines.node uses major.minor.patch
- npm warn EBADENGINE (required node 20.11.1, current 20.x.y)

Cause:
- Vercel can only select **major** Node versions (e.g. 20), not 20.11.1.

Fix:
- In package.json set:
  - "engines": { "node": "20", "npm": ">=10" }

Optional (local exact pin without affecting Vercel):
- Add Volta pin:
  - "volta": { "node": "20.11.1", "npm": "10.8.2" }

### 2) Type error: BlobPart with Uint8Array<ArrayBufferLike>
Symptom:
- Type error: Uint8Array<ArrayBufferLike> is not assignable to BlobPart

Fix (type-safe):
- Convert Uint8Array to a real ArrayBuffer slice before creating Blob:

```ts
function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export function downloadBytes(bytes: Uint8Array, filename: string, mime: string) {
  const blob = new Blob([toArrayBuffer(bytes)], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

