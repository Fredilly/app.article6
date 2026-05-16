# Gold Standard Method Wiring

## How Gold Standard Methods Are Discovered

Gold Standard methods are **discovered from the same upstream pack** as Verra and UNFCCC methods. The pipeline is:

```
article6-methodologies/           # Upstream pack (GitHub release)
└── methodologies/
    └── GoldStandard/             # Provider directory
        └── LUF/                  # Domain/category (Land Use & Forestry)
            └── GS-VER1/          # Method code
                └── v2-0/         # Version
                    ├── META.json   # Method metadata (method, domain, standard)
                    ├── rules.json  # Rules for verification
                    ├── rules.rich.json
                    ├── sections.json  # Canonical sections
                    └── sections.rich.json
```

The manifest at `public/manifest/index.json` is **regenerated** from this pack via:

```bash
node scripts/generate-manifest-from-pack.mjs
```

This script walks `public/methodologies/GoldStandard/`, finds all method+version directories with `rules.json` + `META.json`, and builds manifest entries with `provider: "Gold Standard"`.

## How Gold Standard Methods Get Wired End-to-End

### 1. Manifest → Methods API

The `/api/projects/methods` endpoint reads `public/manifest/index.json` and constructs a `program` field from `provider/category`. For a Gold Standard entry:

| manifest field | value |
|---|---|
| `provider` | `"Gold Standard"` |
| `category` | `"LUF"` |
| `program` | `"Gold Standard/LUF"` |

### 2. Methods API → Picker

The `NewProjectForm` component fetches from `/api/projects/methods`, groups methods by `program` prefix, and renders them in `<optgroup>` tags:

```tsx
<optgroup key={group.registry} label={group.registry}>
```

A Gold Standard method's program starts with `"Gold Standard"`, so it appears under a **"Gold Standard"** group header.

### 3. Selection → Project Creation

When a user selects a GS method:

```ts
// NewProjectForm.tsx
registry: projectRegistryFromMethodProgram(selectedMethodRecord?.program),
```

`projectRegistryFromMethodProgram` splits the program by `/`, takes the first segment, and runs it through `normalizeRegistry`:

| program | first segment | result |
|---|---|---|
| `"Gold Standard/LUF"` | `"Gold Standard"` | `"Gold Standard"` ✅ |
| `"GS/Energy"` | `"GS"` | `"Gold Standard"` ✅ |

The project is created with `registry: "Gold Standard"`.

### 4. Project → UI

The `RegistryBadge` component renders the registry value:

- **Gold Standard**: amber background (`bg-amber-100`)

Method library filter tabs also include **"Gold Standard"** as a filter option (defined in `STANDARDS` constant in `MethodLibraryPanel.tsx`).

### 5. Export → Composer Dispatch

The export pipeline uses `composeReport.ts` to select the correct composer:

```ts
if (registry === 'Gold Standard') {
  const { composeGoldStandardVerificationReport } = await import(
    '@/lib/composers/composeGoldStandardVerificationReport'
  );
  return composeGoldStandardVerificationReport(project, coverage, exportTime);
}
```

### 6. Composer → GS-Specific Output

The Gold Standard composer produces:

| Field | Value |
|---|---|
| `title` | `"GOLD STANDARD READINESS REPORT"` |
| `subtitle` | `"Gold Standard readiness review composed from canonical methodology metadata."` |
| Sections | REPORT STATUS, METHODOLOGY SOURCE SECTIONS, PROJECT DESIGN, BASELINE SCENARIO, ADDITIONALITY, MONITORING, SAFEGUARDS, EVIDENCE REVIEWED, REQUIREMENT FINDINGS, LIMITATIONS, PROVENANCE |
| Disclaimer | *"It is not a formal Gold Standard validation, verification, or certification opinion..."* |

If metadata is unavailable (e.g. unknown method), it falls back gracefully with placeholder section text and the standard GS disclaimer.

### 7. QuickCheck Detection

QuickCheck detects Gold Standard in uploaded documents via two patterns:

- **Standard-name qualified**: Matches text like `"Gold Standard GS-VER1 v2.0"`
- **Standalone mentions**: Matches bare `"Gold Standard"` in PDD cover pages

Detection is used for routing/context hints, not authoritative registry assignment.

## Adding a New Gold Standard Method

1. Add the method data to the `article6-methodologies` pack under `methodologies/GoldStandard/<CATEGORY>/<METHOD>/<VERSION>/`
2. Regenerate the manifest:
   ```bash
   node scripts/generate-manifest-from-pack.mjs
   ```
3. The method will automatically appear in:
   - The methodology picker
   - Project detail UI
   - Export/PDF pipeline
4. No app code changes needed — the wiring is already in place.

## Verification Checklist

When a Gold Standard method is added to the manifest:

- [ ] Method appears in the methodology picker under the "Gold Standard" group
- [ ] Selecting the method sets `registry: "Gold Standard"` on the project
- [ ] Project detail page shows a "Gold Standard" badge
- [ ] Export PDF produces a "GOLD STANDARD READINESS REPORT"
- [ ] PDF includes GS-specific sections (PROJECT DESIGN, SAFEGUARDS, etc.)
- [ ] PDF does NOT contain fallback/stub wording
- [ ] QuickCheck detects "Gold Standard" in uploaded documents
- [ ] Method library/filter shows the method under the Gold Standard tab

## Test Coverage

| Test File | What It Tests |
|---|---|
| `tests/lib/projects/registryResolution.test.ts` | `normalizeRegistry`, `resolveProjectRegistry`, `projectRegistryFromMethodProgram` for GS inputs |
| `tests/lib/methodBadge.test.ts` | `deriveStandard` for "GS", "Gold Standard" → "Gold Standard" |
| `tests/components/projects/RegistryBadge.test.tsx` | RegistryBadge renders "Gold Standard" with correct styling |
| `tests/lib/composers/composeGoldStandardVerificationReport.test.ts` | GS composer: section order, disclaimer, fallback, determinism |
| `tests/lib/projects/verificationReport.test.ts` | GS report routing, registry label, export timestamp |
| `tests/api/project.export-pdf.route.test.ts` | Full PDF export for GS projects (section rendering, forbidden wording) |
