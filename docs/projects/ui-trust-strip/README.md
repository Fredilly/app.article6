# UI Trust Strip (MVP)

## Goal
Add an always-visible TrustStrip on method + version detail pages that surfaces provenance and enables one-click export of the JSON artifacts backing the current view.

## Acceptance Criteria
- TrustStrip renders on `/m/[code]` and `/m/[code]/v/[ver]` directly under the page header.
- TrustStrip shows compact chips for available provenance fields (pack / source / generated_at) and audit hashes when present.
- Chips provide copy-to-clipboard for their primary values.
- Export menu downloads JSON for:
  - provenance JSON
  - META.json (current method+version)
  - rules.json
  - sections.json
  - rich.json (only when present)
- Defensive behavior:
  - No scary warnings if provenance/META cannot load.
  - No "pack mismatch" logic in the TrustStrip.

## Manual Verification Steps
1. Run `npm run dev`.
2. Open a method page: `http://localhost:3000/m/AR-AM0014`
3. Confirm TrustStrip is visible under the page header.
4. Click chips (repo@sha, pack tag/sha, audit hashes) and paste to verify copied text matches the full underlying value.
5. Open the export menu and download:
   - provenance JSON
   - META.json
   - rules.json
   - sections.json
   - rich.json (if present)
6. Open the downloaded files and confirm they contain valid JSON.
7. Resize the window to mobile width and confirm the chips wrap without horizontal overflow.

## Visible UI Changes Checklist
- [ ] New always-visible strip under the Method/Version header
- [ ] Compact chips for pack, generated_at, source repo@sha
- [ ] Audit hash chips when present (rules/sections/source_pdf)
- [ ] Export menu for provenance/META/rules/sections/rich JSON

