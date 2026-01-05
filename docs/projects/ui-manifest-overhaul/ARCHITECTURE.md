# Architecture

## Routes
- /manifest (methods inventory)
- /m/[code] (method detail; optional)
- /m/[code]/v/[version] (version detail; optional)

## Data sources
- /api/registry
- /api/methods/:code
- /api/methods/:code/v/:version

## Entity links
- Rule: /r/:ruleId
- Section: /s/:sectionId

## UI layout
- Desktop: two-panel (list left, detail right)
- Mobile: list + bottom sheet detail

## Trust strip fields
- dataset source: repo + short SHA
- generated_at
- audit hashes with copy buttons
- export actions
