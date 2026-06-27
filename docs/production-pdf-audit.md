# Production PDF Path Audit

> Investigated every step from browser upload to PyMuPDF parsing in production.

---

## 1. How PDFs are uploaded today

The browser reads the file via `File.arrayBuffer()`, stores the bytes in **IndexedDB** (client-side), then sends the full bytes as `FormData` in a `POST` to `/api/quick-check/pdf-extract`.

**Source:** `src/lib/proofMap/attachments.ts:91-133` → `src/lib/chat/quickCheckPdfClient.ts:11-111`

The server receives the full binary, writes it to `/tmp/quick-check-pdfs/`, and returns a `pdfRef` token (a 10-min in-memory Map entry pointing to the temp file path).

**Source:** `src/app/api/quick-check/pdf-extract/route.ts:27-35,180-181`

---

## 2. Whether upload goes through a Vercel API request body

**Yes — the full PDF bytes travel through the Vercel API route body.**

The client calls `fetch("/api/quick-check/pdf-extract", { method: "POST", body: form })` where `form` is a `FormData` containing the file bytes. The server reads `request.formData()` and then `file.arrayBuffer()`.

**Source:** `quickCheckPdfClient.ts:18-26`, `route.ts:126-148`

There is **no S3/Blob step**. Bytes arrive inside the Vercel request body.

---

## 3. Whether large PDFs >4.5MB can reach the server

**No, not reliably. The app allows up to 20MB internally, but Vercel rejects PDFs above ~5MB before the handler runs.**

- `MAX_QUICK_CHECK_PDF_BYTES = 20 * 1024 * 1024` (20MB)
- Vercel's default body size limit is **5MB** for serverless functions (4.5MB is a common proxy limit, but Vercel's hard limit is ~5MB for hobby/pro plans)
- The server explicitly checks `bytes.byteLength > MAX_QUICK_CHECK_PDF_BYTES` and returns HTTP 413 if exceeded

**Risk:** Vercel's serverless function body limit is **~5MB** by default. PDFs between 5MB and 20MB will be **rejected by Vercel's infrastructure before reaching the app code**. The app's own 20MB check never fires for these — Vercel returns a 413 before the request hits the handler.

**Source:** `quickCheckPdfUpload.ts:1`, `route.ts:164`, Vercel docs (default 5MB serverless body limit).

---

## 4. Whether production Quick Check has a real pdfFilePath or only raw text

**This is the critical finding: the PDF-backed path works in production IF the PDF is small enough to get through Vercel's body limit, but the fallback path runs silently for most real-world PDDs.**

The flow is:

1. Upload → `/api/quick-check/pdf-extract` → returns `{ text, pdfRef }`
2. Browser stores `pdfRef` in React state via `evidenceAnalysis.pdfRef`
3. `resolveStructuredQueryContext(rawPddText, pdfRef)` is called
4. Inside: `pdfFilePath = resolvePdfRef(pdfRef)` resolves the in-memory Map entry
5. `parseDocumentText({ rawText, pdfFilePath })` is called with a real file path

**However**, if `pdfRef` is missing (e.g. from a cached/reloaded state, or the 10-min TTL expired), or if PyMuPDF fails, the fallback is silent:

```
parseDocumentText({ rawText })  // no pdfFilePath → currentExtractor
```

The **raw-text fallback path** (`getStructuredQueryContext`) is used at lines 263-264 of `quickCheckReviewQuestion.ts` when `structuredQueryContext` is not passed in. This calls `parseDocumentText({ rawText })` — **without pdfFilePath** — which goes straight to `currentExtractor` with no structured headings/tables.

**Source:** `quickCheckStructuredQuery.ts:14-20`, `quickCheckReviewQuestion.ts:263-264`, `components/chat/QuickCheckPanel.tsx:1498-1499,1823`

---

## 5. Whether PyMuPDF runs successfully in Vercel production

**Unknown without production logs, but the infrastructure exists:**

- A **PyInstaller-compiled binary** (`public/pymupdf-parse`) is built during `vercel installCommand` and deployed
- `vercel.json` has: `pip3 install pyinstaller pymupdf pdfplumber && pyinstaller --onefile --name pymupdf-parse scripts/pymupdf-parse.py`
- `pymupdfHelper.ts` checks for the compiled binary at `public/pymupdf-parse` (line 59-86) and runs it with `execFileSync`
- `next.config.ts` includes `./scripts/pymupdf-parse.py` in `outputFileTracingIncludes` for the semantic-evidence route

**Known issues:**
- The compiled binary is NOT in `outputFileTracingIncludes` for the `/api/quick-check/pdf-extract` route — only for the semantic-evidence route
- `execFileSync` runs with 120s timeout and 50MB buffer, which should handle large PDDs
- If the binary fails (missing, wrong arch, GLIBC version mismatch), it falls back silently via `fallbackToCurrentExtractor` with no production alerting

**Source:** `vercel.json:6`, `pymupdfHelper.ts:59-86,199-208`, `next.config.ts:14-18`

---

## 6. How often parserFallbackFrom: current-extractor happens

**Cannot quantify without production log metrics, but the conditions are common:**

1. **No pdfFilePath** — anytime `resolveStructuredQueryContext` is called without a valid `pdfRef` (TTL expired, cached state, reload from localStorage)
2. **PyMuPDF binary missing on Vercel** — the binary path isn't traced for the main PDF-extract route
3. **Binary incompatible** — GLIBC version mismatch on Vercel's runtime
4. **PDF too large** — 5MB Vercel limit means many real PDDs silently fail before PyMuPDF runs
5. **Helper returns error** — the Python script can fail on malformed PDFs
6. **Helper returns empty text** — scanned/image-only PDFs

**Each fallback logs a `console.warn` but only when `process.env.VERCEL` is truthy** (line 115-121 of `pymupdfAdapter.ts`). There's no structured observability, no Sentry, no count.

**Source:** `pymupdfAdapter.ts:108-127,301-358`, `pymupdfInit.ts:18-32`

---

## 7. Whether parsed structured output is cached or recomputed per request

**Not cached.** Every call to `resolveStructuredQueryContext` with a valid `pdfRef` re-runs the PyMuPDF subprocess via `lazyRunPymupdfHelperSync`. The temp file is on `/tmp` which is ephemeral per serverless instance.

The only caching is:
- `pymupdfHelper.checkPymupdfAvailability()` caches the availability check (per instance)
- The `pdfRef` → file path Map has a 10-min TTL but is in-memory (lost between cold starts)
- **Parsed structured output** (sections, headings, tables) is **never cached** — recomputed on every Quick Check run

**Source:** `pymupdfHelper.ts:53-54` (`_availabilityCache`), `quickCheckPdfStore.ts:6-34` (in-memory Map TTL)

---

## Summary of Risks

| # | Issue | Severity |
|---|-------|----------|
| 1 | Full PDF upload through Vercel API body (no S3/Blob) | High |
| 2 | Vercel 5MB body limit blocks PDFs >4.5MB before app code | High |
| 3 | pdfRef TTL is only 10 min, stored in ephemeral in-memory Map | Medium |
| 4 | Compiled PyMuPDF binary not traced for main pdf-extract route | Medium |
| 5 | No production logging/metrics for fallback rate | Medium |
| 6 | No caching of parsed structured output | Low |
| 7 | Silent fallback to currentExtractor with no user signal | Medium |

## Recommended flow

```
browser
→ direct upload PDF to Blob/S3 (not through Vercel body)
→ server receives only pdfRef/storage-key
→ parser downloads/opens file from storage
→ PyMuPDF returns structured JSON
→ Quick Check consumes cached structured JSON
→ raw-text parser is fallback only
```
