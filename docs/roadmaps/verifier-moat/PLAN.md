# Verifier Moat (Shrink-first)

## Promise (locked)
Method/version + AOI + evidence -> deterministic audit artifact + evidence->rule deep-links.

## Pillars (only scope)
- Determinism
- Traceability
- Shareability

## Stop line
We stop adding features when:
- Same inputs -> same artifact hashes (within pinned runtime)
- Evidence -> exact rule in 1 click
- Trail captures inputs, selections, rule jumps, exports
- `npm run ci` mirrors CI; 10 PRs green

## PR18 - Shrink Method UI to Read | Verify + demote tools

## PR19 - CI hardening (align with PR16)

## PR20 - Trail inside audit pack + strict verify

## PR21 - Share link (optional)
