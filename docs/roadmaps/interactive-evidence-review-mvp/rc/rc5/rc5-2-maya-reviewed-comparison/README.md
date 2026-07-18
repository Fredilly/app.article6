# RC5-2 Maya reviewed comparison

This directory contains a reviewed comparison overlay for the frozen ten-rule
RC5-2 Maya machine proposal. It does not replace or edit the machine proposal.

`machine-vs-review-comparison.json` is derived from the response file, the
existing ten-rule sample, and the frozen row hashes. Correctness fields are
machine evidence state, applicability, and accepted evidence. Rejected
candidates are reported as diagnostic field comparisons because independent
review may reclassify a machine-rejected candidate without changing whether the
machine state and applicability were correct.

The comparison records one fully correct row (`R-6-0008`) and nine rows with at
least one disagreement. `R-6-0006` matches the machine applicability field but
is not fully correct because its evidence state and accepted evidence differ.
`R-4-0001` and `R-5-0001` remain provisional.

The response-derived generic failure taxonomy is:

- `RETRIEVAL`: 6 rows — relevant evidence was missed or irrelevant evidence
  was selected or retained.
- `APPLICABILITY`: 3 rows — project classification or module applicability
  was not resolved correctly.
- `NONE`: 1 row — the machine state and applicability are defensible.

These are generic failure categories for review analysis, not Maya-specific
production behavior or correction logic.
