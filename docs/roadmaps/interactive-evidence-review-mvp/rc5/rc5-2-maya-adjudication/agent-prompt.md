# Paste-ready independent review prompt

You are an independent reviewer preparing the RC5-2 Maya adjudication response. Do not perform machine-generation work and do not modify machine truth.

Review the Maya Forest Corridor REDD Project PDD:

- document: `12-maya-forest-corridor-redd-belize.pdf`
- document SHA-256: `407caaa782e9d9e07b250999539fc809c2c41888b0f20a628a9e49dbeb977a5b`
- methodology: VM0007 v1.8
- scope: evaluate only the ten sampled VM0007 rules in `review-packet.json`;
- packet: read `review-packet.json`, including its shared PDD context references;
- output contract: `review-response-schema.json`;
- empty response shape: `review-template.json`.

The packet contains the frozen machine proposal, exact accepted and rejected evidence, rule definitions, provenance, and surrounding PDD text. Inspect the quoted evidence and surrounding PDD context independently. Verify that evidence actually supports the VM0007 v1.8 requirement and applicability, and identify contradictions or missing components.

Return exactly one decision for each of these ten stable rule IDs:

1. `Verra.AFOLU.VM0007.v1-8.R-1-0001`
2. `Verra.AFOLU.VM0007.v1-8.R-2-0001`
3. `Verra.AFOLU.VM0007.v1-8.R-3-0005`
4. `Verra.AFOLU.VM0007.v1-8.R-5-0008`
5. `Verra.AFOLU.VM0007.v1-8.R-5-0009`
6. `Verra.AFOLU.VM0007.v1-8.R-6-0006`
7. `Verra.AFOLU.VM0007.v1-8.R-1-0015`
8. `Verra.AFOLU.VM0007.v1-8.R-4-0001`
9. `Verra.AFOLU.VM0007.v1-8.R-5-0001`
10. `Verra.AFOLU.VM0007.v1-8.R-6-0008`

For every rule, provide the final evidence state, final applicability, reviewer outcome, accepted and rejected evidence, contradiction state, draft finding candidate, assessment reason, gap, client action, correction reason, generic failure category, and reviewer confidence required by the schema. Cite every accepted or rejected evidence item exactly using quote, page, section heading, span ID, document ID, and the document SHA.

Do not overwrite or edit the machine row. Do not use the machine proposal as proof merely because it has a status, confidence, gap, or action. `FOUND` is not automatically `CONFORMS`; `UNCLEAR` is not automatically `ACTION_REQUIRED`; `MISSING` is not automatically `NCR`; and `N/A` requires supported applicability reasoning. Do not infer reviewer outcomes from machine statuses. If the PDD does not support a firm conclusion, use `UNCLEAR` or `NOT_ASSESSED`. Classify generic failure modes rather than prescribing Maya-specific fixes. Do not assess any rule outside the ten listed above.

Return JSON only, matching `review-response-schema.json`.
