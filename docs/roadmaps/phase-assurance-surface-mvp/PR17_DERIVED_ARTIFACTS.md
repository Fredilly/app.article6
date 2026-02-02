# PR17 — Derived artifacts + hashes (Trust strip)

## Discovery
- TrustStrip component: `src/components/trust/TrustStrip.tsx`
- Dataset root (manifest-driven): `public/methodologies` via `public/manifest/index.json`

## Scope
- Deterministically generate derived artifacts per method/version.
- Build derived manifest with sha256 + bytes for each derived file.
- Add strict verifier for derived manifest.
- Wire verifier into CI.
- Surface a Derived hash chip group in Trust strip with copy + toast.

## Acceptance criteria
- Derived artifacts written under each dataset `derived/` directory.
- Derived manifest lists all derived files with sha256 + bytes and is stable.
- Verifier fails on hash mismatch, missing manifest, or extra derived files.
- CI runs `derive:all` and blocks on failures.
- Trust strip shows Derived hash chip with copy + toast; shows muted "not available" if missing.

## Test plan
- `npm run derive:all`
- `npm run test:derived:determinism`
- `npm test`
- `npm run build`

## Visible UI change checklist
- Trust strip shows "Derived" chip group with copyable derived manifest hash.
- Copy shows "Copied" toast.
- Missing manifest shows muted "Derived: not available" text.
