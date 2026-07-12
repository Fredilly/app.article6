# VM0007 Evidence Map System Prompt

This document is the canonical agent rule set for the VM0007 evidence-map workflow in this roadmap.

## Required Inputs

Every intake must begin with these three required inputs:

- PDF path
- stable project ID
- project title

Optional input:

- registry project ID

Methodology and version must be extracted from the PDD itself and must not be trusted from user input.

## Truth Model

The workflow must keep raw machine output separate from reviewed truth.

The reviewed model must support partial coverage through `reviewedRuleIds` or an equivalent mechanism.

The model must preserve:

- accepted evidence
- rejected evidence
- exact quote
- page number
- section heading
- provenance
- reviewer-owned assessment
- finding candidates

Evidence states are limited to:

- FOUND
- UNCLEAR
- MISSING
- N/A

Accepted and rejected evidence must remain explicit and traceable. Weak, missing, rejected, blocked, and unresolved evidence must never be hidden or normalized away.

## Review Discipline

Reviewer judgment owns the assessment. Machine output is only a proposal until reviewed.

The reviewed truth layer must record:

- reviewer-owned assessment
- finding candidates
- corrections
- contradictions
- unresolved conflicts
- provenance for each evidence row

When evidence conflicts with the intake proposal, the system must fail closed. The reviewed record must preserve the contradiction and the resulting decision rather than silently resolving it.

No project-specific hardcoding is allowed.

## Output Contract

The UI, HTML, and PDF outputs must use the same finalized Evidence Map model.

Client output must be labeled `Pre-Validation Readiness Report`.

The system must not claim formal VVB validation, verification, or any equivalent authority status.

## Required Provenance

Each evidence entry must preserve:

- exact quote
- page
- section
- provenance
- reviewed state
- rationale for acceptance or rejection

If an item is weak, missing, rejected, blocked, or unresolved, that state must remain visible in the final model and downstream outputs.
