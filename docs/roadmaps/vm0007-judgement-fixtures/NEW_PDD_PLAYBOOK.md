# New PDD Playbook

Governing contract: [SYSTEM_PROMPT.md](./SYSTEM_PROMPT.md)

Use this exact operator sequence for every new PDD.

## 1. Collect PDF, ID, title, optional registry ID

- Input: PDF path, stable project ID, project title, optional registry ID
- Action: capture the intake payload unchanged
- Artifact produced: intake record
- Failure condition: missing required input or conflicting identity data
- Done condition: all required inputs are present and recorded

## 2. Confirm source exists and record hash

- Input: PDF path
- Action: verify the file exists and compute a file hash
- Artifact produced: source identity and hash
- Failure condition: file missing, unreadable, or hash cannot be captured
- Done condition: source existence and hash are recorded

## 3. Derive project folder from ID

- Input: stable project ID
- Action: derive the project intake folder from the ID
- Artifact produced: project intake folder path
- Failure condition: folder cannot be derived or conflicts with the ID
- Done condition: the intake folder is deterministically derived

## 4. Run Quick Check and extraction

- Input: source PDF and intake folder
- Action: run Quick Check and document extraction
- Artifact produced: raw Quick Check output
- Failure condition: extraction or Quick Check fails
- Done condition: raw extraction artifacts are available

## 5. Verify identity, methodology, and version

- Input: extracted text and PDF evidence
- Action: verify project identity, methodology, and version from the PDD
- Artifact produced: verified identity and version record
- Failure condition: identity mismatch, methodology ambiguity, or version conflict
- Done condition: identity, methodology, and version are explicitly resolved or flagged

## 6. Create untouched 58-row machine proposal

- Input: verified extraction results
- Action: generate the 58-row machine-proposed Evidence Map without reviewer edits
- Artifact produced: raw 58-row machine Evidence Map
- Failure condition: fewer than 58 rows, missing evidence, or non-grounded synthesis
- Done condition: the untouched machine proposal is preserved

## 7. Preserve raw artifacts

- Input: raw Quick Check output and machine proposal
- Action: store raw artifacts with source identity, hash, and metadata
- Artifact produced: `metadata.json`, raw artifacts, and preserved machine output
- Failure condition: any raw artifact is overwritten or normalized away
- Done condition: the raw evidence trail is intact

## 8. Open PR1 truth intake

- Input: preserved machine proposal
- Action: open PR1 for truth intake review
- Artifact produced: PR1 review workspace
- Failure condition: PR1 mixes in generic system changes
- Done condition: PR1 is limited to reviewed truth

## 9. Review priority and uncertain rows

- Input: machine proposal rows
- Action: review high-value, UNCLEAR, MISSING, contradictory, and weak-provenance rows first
- Artifact produced: reviewed rows, `reviewedRuleIds` or equivalent, accepted and rejected evidence
- Failure condition: review skips the uncertain or high-value rows without justification
- Done condition: priority rows are reviewed and recorded

## 10. Record truth, rejected evidence, corrections, and REVIEW.md

- Input: reviewed rows
- Action: record final truth, rejected evidence and reason, corrections, and `REVIEW.md`
- Artifact produced: `gold.draft.json`, `corrections.json`, `REVIEW.md`, reviewed truth records
- Failure condition: exact quote, page, section, or provenance is missing
- Done condition: reviewer-owned truth is persisted with full provenance

## 11. Open PR2 generic improvement

- Input: reviewed truth from PR1
- Action: open PR2 for reusable system improvements only
- Artifact produced: PR2 improvement workspace
- Failure condition: PR2 includes project-specific hardcoding
- Done condition: PR2 is scoped to shared logic only

## 12. Classify reusable failures

- Input: machine proposal versus reviewed truth
- Action: classify reusable failures in parsing, retrieval, routing, selection, applicability, version, provenance, contradiction, assessment, or presentation logic
- Artifact produced: failure taxonomy notes
- Failure condition: failure is not reusable or is specific to one project
- Done condition: reusable edge cases are identified

## 13. Rerun regressions

- Input: updated shared logic
- Action: rerun all previous fixtures and regressions
- Artifact produced: regression results
- Failure condition: any regression is unresolved
- Done condition: all prior regressions pass or are explicitly explained

## 14. Complete remaining row reviews

- Input: any unreviewed rows
- Action: finish all intended row reviews
- Artifact produced: complete review coverage record
- Failure condition: intended rows remain unreviewed
- Done condition: every intended row is reviewed

## 15. Finalize Evidence Map

- Input: complete reviewed truth
- Action: finalize the Evidence Map
- Artifact produced: `gold.json` and final truth
- Failure condition: unresolved conflict remains open
- Done condition: finalized Evidence Map is version-qualified or blocked explicitly

## 16. Generate UI, HTML, and PDF from the same model

- Input: finalized Evidence Map
- Action: generate UI, HTML, and PDF from the same finalized model
- Artifact produced: synchronized presentation outputs
- Failure condition: outputs diverge in rows, evidence, outcomes, findings, actions, counts, provenance, or release state
- Done condition: all presentation surfaces match the same model

## 17. Run the client-release gate

- Input: finalized and synchronized outputs
- Action: run the client-release gate
- Artifact produced: release-state check
- Failure condition: version, applicability, provenance, contradiction, or conclusion requirements are unmet
- Done condition: output is labeled `Pre-Validation Readiness Report` and release gates pass

## 18. Run the same workflow on an unseen PDD

- Input: a second unseen eligible VM0007 v1.8 PDD
- Action: repeat the same intake and review workflow
- Artifact produced: second-case evidence trail and regression proof
- Failure condition: the process only works for Marcondes or requires project-specific fixes
- Done condition: the workflow generalizes to the unseen case

## 19. Promote the workflow to standard only after both cases succeed

- Input: the Marcondes case and the unseen case
- Action: confirm both succeeded under the same contract
- Artifact produced: standard-workflow confirmation
- Failure condition: either case fails, diverges, or depends on project-specific production changes
- Done condition: the workflow is documented as standard only after both successes

## Marcondes Intake Example

PDF:

`~/Desktop/vm0007_v18_pdds copy/5953-Marcondes-Brazil-pdd.pdf`

ID:

`marcondes-redd-brazil-5953`

Title:

`Marcondes REDD+`

Registry ID:

`5953`

Explicit version note:

- page 61 references VM0007 v1.7
- Tables 30-31 declare VM0007 v1.8
- the conflict must be reviewed and reconciled before gold promotion
