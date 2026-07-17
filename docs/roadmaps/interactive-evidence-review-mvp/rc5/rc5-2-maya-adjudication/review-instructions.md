# RC5-2 Maya independent review instructions

This packet is for independent review of exactly ten sampled rows from the frozen Maya Forest Corridor REDD Project PDD. The machine proposal is evidence to inspect, not reviewed truth. Do not edit, replace, or reinterpret the frozen machine row.

For each sampled `stableRuleId`, inspect the exact cited evidence, the shared surrounding PDD context, the accepted and rejected candidates, and the relevant VM0007 v1.8 rule definition. Read the surrounding PDD context directly and look for corroboration, missing details, contradictions, and scope limitations.

Return one decision per sampled rule in `review-response-schema.json`. The decision must include:

- final evidence state: `FOUND`, `UNCLEAR`, `MISSING`, or `N/A`;
- final applicability: `APPLICABLE`, `NOT_APPLICABLE`, or `UNKNOWN`;
- reviewer outcome: `CONFORMS`, `ACTION_REQUIRED`, `NOT_APPLICABLE`, or `NOT_ASSESSED`;
- accepted and rejected evidence, with exact quotes and complete provenance;
- contradiction state;
- draft finding candidate: `NIR_CANDIDATE`, `NCR_CANDIDATE`, `OFI_CANDIDATE`, or `null`;
- corrected assessment reason, gap, client action, and correction reason;
- generic failure category and reviewer confidence.

Use exact evidence text. Every evidence reference must preserve the Maya document ID, PDF SHA, page, section heading, and span ID. If a proposed evidence item is rejected, retain it in `rejectedEvidence` and explain why in the evidence reference or correction reasoning.

Important boundaries:

- `FOUND` does not automatically mean `CONFORMS`.
- `UNCLEAR` does not automatically mean `ACTION_REQUIRED`.
- `MISSING` does not automatically mean `NCR`.
- `N/A` requires supported applicability reasoning.
- Do not trust the machine assessment merely because it exists.
- The machine proposal is not reviewed truth, and no reviewer outcome is prefilled.
- Do not change any rule outside this ten-rule sample.
- Classify generic failure modes such as retrieval, assessment, applicability, provenance, component coverage, rule mapping, or source contradiction. Do not propose Maya-specific product or production-code fixes.
- If the evidence does not support a firm conclusion, keep the decision `NOT_ASSESSED` or the evidence state `UNCLEAR` rather than overstating certainty.

Do not create or imply a corrected machine baseline. Your response is an independent review overlay keyed to the supplied stable rule IDs and machine row hashes.
