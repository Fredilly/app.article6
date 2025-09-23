# Preview protection bypass & API auth

Many Vercel preview deployments ship with Deployment Protection enabled. This guide documents how to mint the bypass cookie once, reuse it across UI/API calls, and validate authenticated access to `/api/query`.

## 1. Locate the bypass secret

1. In the Vercel dashboard, open the project → **Settings → Environment Variables**.
2. Copy the `VERCEL_PROTECTION_BYPASS` value for the environment you are testing (Preview/Production). If you are using the newer automation secret, note `VERCEL_AUTOMATION_BYPASS_SECRET` instead.

## 2. Exchange the header for a cookie

```bash
DOMAIN=https://<your-deployment>.vercel.app
BYPASS_SECRET=<vercel-protection-bypass-secret>

# Issue the bypass cookie and save it to bypass.cookies
curl -sS -D - -o /dev/null \
  -H "x-vercel-protection-bypass: ${BYPASS_SECRET}" \
  -c bypass.cookies \
  "${DOMAIN}/api/health"
```

A successful response sets `__Secure-vercel-bypass`. Confirm with `cat bypass.cookies` if needed.

### Automation secret variant

If your project uses `VERCEL_AUTOMATION_BYPASS_SECRET`, send `x-vercel-automation-bypass` instead of `x-vercel-protection-bypass`. The rest of the flow is identical.

## 3. Reuse the cookie for APIs and UI

```bash
# Call the protected API without the header
curl -sS -b bypass.cookies \
  -H "Content-Type: application/json" \
  -d '{"query":"hello world"}' \
  "${DOMAIN}/api/query"

# Load the UI
curl -sS -b bypass.cookies "${DOMAIN}/" > /dev/null
```

Both calls should now return `200`.

## 4. Troubleshooting

- **401 Authentication Required** – the secret is wrong or expired. Re-fetch the secret from Vercel and mint a new cookie.
- **Preview health still blocked** – include the `?x-vercel-set-bypass-cookie=true` query param when hitting `/api/health` to force cookie issuance.
- **Automation secret in use** – verify `VERCEL_AUTOMATION_BYPASS_SECRET` is set for the environment and send `x-vercel-automation-bypass`.

## 5. Verify metrics

With the bypass cookie stored, hit `/api/health` and `/api/query`, then fetch Vercel logs:

```bash
vercel logs ${DOMAIN} --token <VERCEL_TOKEN> --json | jq '.message' | grep "[metrics]"
```

You should see lines such as:

```
[metrics] route=api/query:POST count=3 p95=70.27ms latest=70.27ms status=200
```

This confirms both protection bypass and metrics logging are working end-to-end.
