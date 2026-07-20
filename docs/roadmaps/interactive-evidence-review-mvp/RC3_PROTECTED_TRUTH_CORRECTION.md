# RC3 protected-truth correction event

PR #1103 records an intentional reviewed-truth correction in the Marcondes VM0007 v1.8 Evidence Map. The final 58-rule release audit found ten rejected-evidence records whose provenance was not auditable: page provenance was undefined, span IDs were unresolved, and the record shape was nested rather than flat.

The corrected RC3 baseline acknowledges the resulting `gold.json` byte change. It preserves the rejection meaning and anchors all ten records to the exact page-18 passage in section 3.5.5. The shared span is intentional because the same passage supports the same rejection basis, while each rule retains its own rejection record and reviewer correction.

The correction changes only these ten rules: R-3-0004, R-3-0007, R-3-0008, R-4-0001, R-4-0002, R-5-0001, R-5-0002, R-5-0003, R-5-0004, and R-5-0005. Accepted evidence, reviewer outcomes, rejection reasons, machine proposal, raw extraction, raw evidence map, historical RC2/RC3 artifacts, Maya RC1-RC5 artifacts, the PR #1101 release-status work, and the methodology-version release blocker remain protected.

This is a protected-truth boundary update, not a release-status change. The existing v1.7/v1.8 methodology-version blocker remains active.
