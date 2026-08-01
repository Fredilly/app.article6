# Quick Check direct R2 uploads

Configure `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and
`R2_BUCKET_NAME` independently in Preview and Production. Set
`R2_ALLOWED_UPLOAD_ORIGINS` to the exact browser origins allowed to presign
uploads. This is the single source of truth in both Preview and Production.
Production origins must use HTTPS. Preview deployment origins must be added
explicitly when they change; no Vercel wildcard is supported.

The application presign-origin policy and Cloudflare R2 bucket CORS are
separate controls. R2 CORS must also permit each browser origin that the
application authorizes for `PUT` with the `Content-Type` request header
exposed. If the current R2 CORS configuration only supports exact origins,
each new Preview hostname still requires an operational CORS update; do not
replace this with `*`.

The upload API issues a five-minute, PDF-only presigned `PutObject` URL for a
server-generated opaque reference. The browser uploads directly to R2, then
the server confirms object existence, size, and content type with `HeadObject`.
The confirmation response contains only the opaque upload reference and size;
it does not return the bucket, object key, or a public URL.

After confirmation, Quick Check sends the signed reference and non-authoritative
display metadata to the server.
The server verifies its signature and environment, resolves the opaque key,
validates the private object metadata, and passes the retrieved bytes into the
existing PDF extraction pipeline. The browser never receives or resends the
PDF bytes for extraction.

## Follow-up before rollout

Add retention cleanup for abandoned Quick Check objects, remove duplicate
Preview objects created during testing, and define the Production retention
policy before rollout. This upload-only PR does not add a cleanup worker.
