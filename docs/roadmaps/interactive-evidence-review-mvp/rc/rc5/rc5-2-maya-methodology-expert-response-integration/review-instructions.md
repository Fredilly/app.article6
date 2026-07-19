# Maya RC5-2 independent expert response integration

This directory records the completed independent methodology-expert response as provisional metadata only. It does not finalize any rule or modify reviewed truth.

The response is validated against the strict completed-response schema from the merged methodology-expert packet. Methodology and project evidence are accepted only when their quoted text and provenance fields match the frozen packet exactly.

All three selected rules remain `PROVISIONAL`. Finalization conditions remain unmet, including the missing official VM0007 v1.8 source verification and the rule-specific evidence gaps recorded in `integration-manifest.json`.

Regenerate the deterministic manifest with:

```sh
npx tsx scripts/preverif/generate-rc5-maya-methodology-expert-response-integration.ts
```

No `reviewed-truth.json` is created by this integration.
