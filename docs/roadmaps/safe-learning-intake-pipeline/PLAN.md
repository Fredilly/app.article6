# Safe Learning Intake Pipeline

SSOT: `docs/roadmaps/safe-learning-intake-pipeline/phase-status.json`

## Purpose

Article6 should learn from Manual Review usage, public autopsies, and future user workflows without treating user-entered data as truth.

The pipeline must preserve this boundary:

```text
User workflow signal
  -> redacted local learning case
  -> central untrusted intake
  -> consent/value gate
  -> automated triage
  -> aggregate patterns
  -> reviewed promotion queue
  -> eval/product/rule-research task
  -> normal PR with validation
```

## Core rule

User-entered learning data is untrusted by default.

It may inform:

- readiness insights
- recurring gap detection
- benchmark comparisons
- extraction checks
- public-autopsy pattern analysis
- human-reviewed promotion decisions

It may not directly update:

- methodology rules
- models
- eval baselines
- scores
- prompts
- public claims

Automation may triage, cluster, reject, and route cases.
Automation may not promote cases to trusted status without an explicit reviewed promotion workflow.

## Recommended storage direction

The likely storage direction is Supabase/Postgres-ready central intake.

That intake must keep:

- untrusted intake records separate from reviewed/promoted records
- redacted metadata separate from raw source documents
- no uploaded files in central intake
- no raw extracted text in central intake
- no full evidence excerpts in central intake

## Incentive framing

Users should understand why redacted metadata sharing is worth doing.

The value exchange is:

- readiness insights from repeated project patterns
- recurring gap detection across reviews
- benchmark comparisons against similar cases
- improved extraction checks and redaction checks
- better public-autopsy coverage without exposing private source documents

## Roadmap boundary

This roadmap is about safe learning intake and downstream learning loops.

It does not claim:

- training data generation
- trusted knowledge base behavior
- methodology approval
- automatic rule updates
- automatic eval promotion
- public claims from private user data

## Phases

### Phase 0 — Local Untrusted Learning Case Foundation

Status: done

Summary:
PR #568 established the local learning-case layer for Manual Review. It records compact redacted metadata, explicit untrusted trust metadata, and non-training-eligible eval candidate signals in local project storage.

Acceptance:
- Manual Review lock/export records a redacted learning case.
- Learning cases are explicitly untrusted, non-promotable, and non-training-eligible.
- Raw source text, uploaded bytes, and full evidence excerpts are not retained.
- Repeated unchanged lock/export events deduplicate safely.

Non-goals:
- No server-side intake.
- No promotion workflow.
- No dashboard.

### Phase 1 — Server-Side Untrusted Intake

Status: next

Summary:
Add a central intake service and storage shape for redacted learning cases, with clear separation between local project artifacts and untrusted central intake records.

Acceptance:
- Central intake stores redacted metadata only.
- Central intake is not a trusted knowledge base.
- Reviewed/promoted records remain separate from raw intake records.
- No uploaded files, raw extracted text, or full evidence excerpts are stored centrally.

Non-goals:
- No promotion UI.
- No automatic training.
- No direct rule/model updates.

### Phase 2 — Consent And Value Gate

Status: planned

Summary:
Introduce explicit user consent and incentive framing before central intake is used. Sharing should be framed as a value exchange, not as hidden data collection.

Acceptance:
- Users can see what is shared and why.
- The gate explains readiness insights, recurring gap detection, benchmark comparisons, and extraction checks.
- The pipeline remains untrusted by default.

Non-goals:
- No automatic promotion.
- No dashboard.
- No training pipeline.

### Phase 3 — Automated Intake Triage

Status: planned

Summary:
Automate clustering, deduplication, rejection, and routing of untrusted intake records. Triage can improve signal quality but cannot create trust.

Acceptance:
- Intake records can be clustered and filtered.
- Obvious noise or malformed records can be rejected.
- Records can be routed to the right human review queue.
- Triage cannot promote data to trusted status.

Non-goals:
- No eval publishing.
- No model training.
- No methodology-rule edits.

### Phase 4 — Aggregate Learning Dashboard

Status: planned

Summary:
Create an aggregate dashboard for product and ops to review pattern-level signals from untrusted intake without exposing raw source documents.

Acceptance:
- Dashboard shows aggregate trends only.
- No raw PDFs, excerpts, or bytes are shown.
- Results are framed as diagnostic signals, not truth.

Non-goals:
- No public claims.
- No promotion workflow.
- No per-customer sensitive data leakage.

### Phase 5 — Public Autopsy Eval Bridge

Status: planned

Summary:
Connect public autopsy cases and eval candidates to the same untrusted-intake boundary so public examples can seed evaluation work without becoming trusted ground truth.

Acceptance:
- Public autopsy signals stay separate from trusted records.
- Eval candidates remain untrusted until reviewed.
- Public material can improve checks without rewriting core truth claims.

Non-goals:
- No direct model updates from public autopsy data.
- No automatic methodology claims.
- No hidden training loop.

### Phase 6 — Reviewed Promotion Queue

Status: planned

Summary:
Add a human-reviewed queue for cases that may be approved for eval design or other trusted downstream use.

Acceptance:
- Promotion requires explicit reviewed approval.
- Approved and rejected decisions are recorded.
- Trusted use is separated from local untrusted intake.

Non-goals:
- No automatic promotion.
- No automatic use in rules/models/scores.

### Phase 7 — Improvement Task Generator

Status: planned

Summary:
Convert reviewed cases into concrete improvement tasks for extraction, redaction, UX, prompt hygiene, and documentation.

Acceptance:
- Tasks are generated from reviewed cases, not raw intake.
- Tasks are actionable and scoped.
- Tasks do not leak private source content.

Non-goals:
- No self-modifying rules.
- No autonomous prompt updates.

### Phase 8 — Workspace Intelligence

Status: planned

Summary:
Surface safe workspace intelligence across learning, extraction, and quality signals to support internal product iteration and customer-facing value.

Acceptance:
- Intelligence is aggregate and permissioned.
- User-entered data is still not treated as truth.
- Trusted insights come only from reviewed promotion pathways.

Non-goals:
- No public claims based on unreviewed user data.
- No direct training or model updates.

## End state

The end state is a safe learning loop:

- local untrusted learning case
- central untrusted intake
- consent/value gate
- automated triage
- aggregate learning signals
- public autopsy and eval bridge
- reviewed promotion queue
- improvement tasks
- workspace intelligence

At no point does untrusted user data directly become rules, models, eval baselines, scores, prompts, or public claims.
