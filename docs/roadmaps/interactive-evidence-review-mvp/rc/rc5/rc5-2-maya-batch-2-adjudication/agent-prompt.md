# Agent prompt

Perform an independent adjudication of the ten selected Maya rules in `review-packet.json`. The reviewed response must be based on the PDD excerpts and provenance in the packet, not on current app output or assumptions. Return one decision for each selected `stableRuleId` and preserve the machine proposal reference and row hash.

Never rewrite, normalize, strengthen, correct, or otherwise edit machine truth. Do not infer reviewed truth from the proposed state. Explain uncertainty explicitly, retain rejected evidence when it is relevant, and provide provenance for every accepted or rejected evidence reference.
