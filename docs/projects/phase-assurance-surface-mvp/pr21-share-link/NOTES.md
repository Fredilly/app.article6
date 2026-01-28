# PR21 Notes

## Paths touched
- src/app/m/_components/MethodDetailPane.tsx
- src/components/actions/ShareLinkButton.tsx
- src/lib/shareLink.ts
- src/lib/shareLink.test.ts

## Tradeoffs
- Sections are restored via the section preview modal (no separate sections tab in current UI).
- Hash anchors are included for rules/sections to support stable scrolling where available.
