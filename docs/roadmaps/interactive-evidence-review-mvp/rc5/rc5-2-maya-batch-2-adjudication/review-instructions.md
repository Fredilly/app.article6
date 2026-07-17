# RC5-2 Maya Batch 2 independent adjudication

Review exactly the ten rules listed in `review-packet.json`, in canonical order. Use the PDD evidence and surrounding context supplied for each row, and independently decide the evidence state, applicability, accepted/rejected evidence, contradictions, finding candidate, gap, action, and confidence.

`FOUND` requires direct project evidence. Use `UNCLEAR` when evidence is related but incomplete, generic, contradictory, or insufficient. Use `MISSING` when no usable project evidence exists. Use `N/A` only when the rule truly does not apply and record the specific reason. Boilerplate, tables of contents, methodology instructions, URLs, registry links, generic headings, and references to absent supporting documents are not evidence.

The response template is intentionally unadjudicated. Complete it independently: use `expertReviewRequired: false` for completed decisions that do not require expert review, `expertReviewRequired: true` when expert review is still required, and `reviewStatus: PROVISIONAL` when uncertainty remains. Every supplied evidence reference must preserve its exact quote, page, section heading, span ID, document ID, and document SHA.

Do not edit `exactFrozenMachineRow`, `frozenMachineRowHash`, the frozen proposal, the prior response, the reviewed comparison, or any machine-proposed value. This packet contains machine truth only; it does not contain reviewed truth.
