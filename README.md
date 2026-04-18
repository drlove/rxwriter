# EloyRx — Philippine Prescription Writer

Offline-first Progressive Web App for generating Philippine-legal prescriptions in a **5×7 inch** format, with FHIR R4 terminology coding and export. Part of **Project Buklod** / PH Core Profile FHIR IG.

## Features

- **Offline-first** — all data stored locally in IndexedDB (Dexie.js); no backend required
- **FHIR-coded medications** — autocomplete against CSIRO Ontoserver (SNOMED CT / RxNorm) with silent offline fallback
- **5×7 print layout** — browser-native print produces a Philippine-legal prescription slip
- **FHIR R4 export** — `MedicationRequest` Bundle with PH Core Profile extensions (PRC, PTR, S2)
- **Physician credentials** — persisted in `localStorage` so they survive page reloads
- **Canvas signature pad** — draw and embed a signature on every prescription
- **PWA installable** — works standalone on Android, iOS, and desktop Chrome/Edge
- **Rx history** — searchable list of saved prescriptions with edit and reprint

## Tech Stack

| Layer | Library |
|---|---|
| Framework | Vite 5 + Vue 3 (Composition API) + TypeScript |
| Storage | Dexie.js (IndexedDB) — 100% offline |
| PWA | vite-plugin-pwa (Workbox `generateSW`) |
| Styling | Tailwind CSS + custom `@media print` CSS |
| Terminology | HL7 FHIR R4 — CSIRO Ontoserver |

## Getting Started

### Prerequisites

- Node.js 18+ (LTS)
- pnpm (`npm i -g pnpm`)

### Install & run

```bash
git clone <repo-url> rxwriter
cd rxwriter
pnpm install
pnpm dev          # http://localhost:5173
```

### Environment

Copy `.env.example` to `.env.local` before running:

```bash
cp .env.example .env.local
```

| Variable | Default | Description |
|---|---|---|
| `VITE_FHIR_BASE_URL` | `https://r4.ontoserver.csiro.au/fhir` | FHIR Terminology Service base URL. Override with your own PH Core Profile Ontoserver. |

The app works fully offline even if the endpoint is unreachable — autocomplete simply returns no results.

## Scripts

```bash
pnpm dev         # Dev server (http://localhost:5173)
pnpm build       # Production build → dist/
pnpm preview     # Serve the built PWA locally
pnpm typecheck   # vue-tsc type check
pnpm lint        # ESLint
```

## Source Layout

```
src/
  types.ts              — Domain types + FHIR R4 interfaces (start here)
  db.ts                 — Dexie RxDatabase + CRUD helpers
  TerminologyService.ts — FHIR ValueSet $expand + CodeSystem $lookup
  utils/
    fhirExport.ts       — Prescription → FHIR R4 MedicationRequest Bundle
  components/
    RxWriter.vue        — Main prescription form
    PrintPreview.vue    — 5×7 print layout
    RxHistory.vue       — Searchable history list
    SignaturePad.vue    — HTML5 canvas signature capture
  main.ts               — App bootstrap + SW registration
```

## Data Flow

1. **RxWriter** collects patient, medication lines, and physician credentials.
2. Each medication's generic name queries **TerminologyService** (debounced 300 ms) and the user picks a coded concept.
3. On save the record is written to **Dexie** (`RxDB` / `prescriptions` table).
4. **PrintPreview** renders the 5×7 slip; `window.print()` is called.
5. **fhirExport** serialises the record to a FHIR R4 Bundle and triggers a `.fhir.json` download.

## Deploying

The `dist/` output is a fully static site — no server required:

```bash
# Netlify
netlify deploy --prod --dir dist

# Vercel
vercel --prod

# Any static CDN / GitHub Pages
# Upload dist/ — HTTPS is required for PWA install prompts
```

## Philippine Compliance

Each prescription captures the fields required under DOH AO 2008-0009 and FDA guidelines:

| Field | Where |
|---|---|
| Generic name (mandatory) | Medication entry |
| Brand name (optional) | Medication entry |
| Dose, frequency, duration | Medication entry |
| Physician full name | Physician credentials |
| PRC License No. | Physician credentials |
| PTR No. | Physician credentials |
| S2 License No. | Physician credentials (optional, regulated drugs) |
| Clinic name, address, phone | Physician credentials |
| Physician signature | Canvas pad (Base64, embedded in print) |

---

## Key Integration Points (Project Buklod / PH Core Profile)

### 1. FHIR Terminology Service Endpoint

The app defaults to CSIRO's public Ontoserver for SNOMED CT drug lookups:

```
https://r4.ontoserver.csiro.au/fhir
```

**To point at your own PH Core Profile server**, create a `.env` file:

```bash
# .env
VITE_FHIR_BASE_URL=https://your-ph-ontoserver.example.com/fhir
```

This variable is consumed in `src/TerminologyService.ts`. The autocomplete uses `ValueSet/$expand` with a debounced 300 ms search. All FHIR calls degrade silently when offline — the form remains fully functional.

### 2. PH Core Profile Extension Base URL

`src/utils/fhirExport.ts` emits Philippine-specific extensions on every exported `MedicationRequest`:

```typescript
const PH_EXTENSION_BASE = 'https://fhir.health.gov.ph/StructureDefinition'
```

Extensions currently defined:

| Extension | Maps to |
|---|---|
| `.../physician-prc-number` | PRC License No. |
| `.../physician-ptr-number` | PTR No. |
| `.../physician-s2-number` | S2 Dangerous Drugs License |

Once your IG canonical URL is finalized, update `PH_EXTENSION_BASE` in `fhirExport.ts` to match.

### 3. ValueSet Binding

The autocomplete searches two ValueSets in `src/TerminologyService.ts`:

```typescript
// SNOMED CT — pharmaceutical substances (isa/373873005)
const SNOMED_DRUG_VALUESET = 'http://snomed.info/sct?fhir_vs=isa/373873005'

// RxNorm Clinical Drugs
const RXNORM_VALUESET = 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113762.1.4.1010.4'
```

Replace these with your PH Core Profile ValueSet URLs (e.g. a Philippine National Drug Formulary ValueSet) once they are hosted on your Ontoserver.

### 4. FHIR Export

Every prescription can be exported as a FHIR R4 **Bundle (collection)** of `MedicationRequest` resources — one per drug line. The `coding` block is populated from whatever Ontoserver returned during autocomplete:

```json
{
  "resourceType": "MedicationRequest",
  "medicationCodeableConcept": {
    "coding": [{ "system": "http://snomed.info/sct", "code": "372687004", "display": "Amoxicillin" }],
    "text": "Amoxicillin (Amoxil)"
  },
  ...
}
```

Use the **Export FHIR JSON** button in Print Preview, or call `downloadFHIR(rx)` programmatically from `src/utils/fhirExport.ts`.

---

## Print Engine

The 5×7 prescription card is driven by a single CSS rule:

```css
@page {
  size: 5in 7in;
  margin: 0.25in;
}
```

All app chrome is hidden with `.no-print { display: none !important; }` so only the card prints. Compatible with standard thermal receipt printers set to 5×7 card stock.

## Database Schema

Dexie database name: `RxDB`  
Table: `prescriptions`  
Indexes: `++id, patientName, date, createdAt`

Physician credentials (name, PRC, PTR, S2, clinic) persist separately in `localStorage` so they survive form resets without re-entry.
