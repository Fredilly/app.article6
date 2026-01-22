# PR21 — Share link (stable URL restores view)

## Scope
- Add a Share action on method/version pages.
- Encode tab + optional rule/section selection in the URL.
- Opening the shared URL restores the same view.

## URL contract
- Query params:
  - tab: overview | sections | rules | verify
  - rule: <ruleId> (optional)
  - section: <sectionId> (optional)
- Hash (optional, for scroll):
  - #r-<ruleId>
  - #s-<sectionId>

## Acceptance
- Share copies an absolute URL and shows a Copied toast.
- Shared link restores tab + selection.
- Rule/section selection is mutually exclusive (rule wins).
