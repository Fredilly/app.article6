# Agent prompt

Perform an independent adjudication of the ten selected Maya rules in `review-packet.json`. Base the response on the supplied PDD excerpts and provenance, not on current app output, prior human decisions, or assumptions. Return exactly one decision for each selected `stableRuleId` using `review-response-schema.json` and preserve every machine row hash.

Never rewrite, normalize, strengthen, correct, or otherwise edit machine truth. Explain uncertainty explicitly and provide provenance for every accepted or rejected evidence reference.
