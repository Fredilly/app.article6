# Quick Check direct R2 uploads

Configure `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and
`R2_BUCKET_NAME` independently in Preview and Production. Set
`R2_ALLOWED_UPLOAD_ORIGINS` to the matching browser origin(s), and configure
the same values in the R2 bucket CORS policy for `PUT` with the
`Content-Type` request header exposed. Never commit these values.

The upload API issues a five-minute, PDF-only presigned `PutObject` URL for a
server-generated opaque reference. The browser uploads directly to R2, then
the server confirms object existence, size, and content type with `HeadObject`.
The confirmation response contains only the opaque upload reference and size;
it does not return the bucket, object key, or a public URL.

## Follow-up before rollout

Add retention cleanup for abandoned Quick Check objects, remove duplicate
Preview objects created during testing, and define the Production retention
policy before rollout. This upload-only PR does not add a cleanup worker.
