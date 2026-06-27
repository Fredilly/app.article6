# Quick Check cold-start gap: research findings

## The problem

`pdfRef` is an in-memory token (10-min TTL, `Map` in `quickCheckPdfStore.ts`). It's created during upload and consumed by `resolveStructuredQueryContext` for PyMuPDF parsing. The second call (`runEvidenceChecks`) can happen minutes later — if the serverless function cold-started, the token is gone, and PyMuPDF section hierarchy is unavailable.

## Why NOT Vercel Blob (previous approach)

Adding durable blob storage solves the cold-start problem but introduces:
- Data retention/privacy obligations for uploaded PDFs
- Blob cleanup policy as a permanent operational concern
- Extra network hop on every analysis call
- Another dependency (`@vercel/blob`) in the critical path

## Most robust approach: pass bytes through React state

The browser already has the PDF bytes in `resolvePdfText` (`input.bytes`). Instead of relying on a server-side token:

1. Keep the bytes in a React ref after upload
2. When `resolveStructuredQueryContext` is called from `runEvidenceChecks`, POST the bytes to a minimal `/api/quick-check/temp-store` endpoint
3. That endpoint writes to `/tmp`, returns the path immediately — no in-memory store, no TTL

This eliminates:
- The in-memory `pdfRef` expiry race
- Vercel Blob dependency
- Data retention concerns (no durable storage)
- Extra network calls to fetch blob on each analysis

## What you lose (acceptable)

Without any storage, a page reload mid-session requires re-uploading the PDF. This is standard web app behavior — users expect to re-upload on refresh. The cold-start gap only affects PyMuPDF section indexing; text-based analysis works either way.
