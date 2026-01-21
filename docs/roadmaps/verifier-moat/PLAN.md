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

## PR1 - Shrink Method UI to Read | Verify + demote tools

## PR2 - CI hardening (align with PR16)

## PR3 - Trail inside audit pack + strict verify

## PR4 - Share link (optional)
