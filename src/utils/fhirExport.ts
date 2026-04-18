import type {
  Prescription,
  FHIRMedicationRequest,
  FHIRCoding,
  FHIRDosageInstruction,
} from '../types'

const PH_EXTENSION_BASE = 'https://fhir.health.gov.ph/StructureDefinition'

/**
 * Transform a local Dexie prescription record into a valid FHIR R4 MedicationRequest.
 *
 * One MedicationRequest is produced per medication line. When a prescription has
 * multiple drugs, call this function for each entry index.
 *
 * @param rx         Full prescription record from Dexie
 * @param medIndex   Index into rx.medications (default 0)
 */
export function exportToFHIR(
  rx: Prescription,
  medIndex = 0,
): FHIRMedicationRequest {
  const med = rx.medications[medIndex]
  if (!med) {
    throw new Error(`Medication at index ${medIndex} does not exist on this prescription.`)
  }

  // ── Build coding array ────────────────────────────────────────────────────
  const codings: FHIRCoding[] = []

  if (med.snomedCode) {
    codings.push({
      system: 'http://snomed.info/sct',
      code: med.snomedCode,
      display: med.codingDisplay || med.genericName,
    })
  }

  if (med.rxnormCode) {
    codings.push({
      system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
      code: med.rxnormCode,
      display: med.codingDisplay || med.genericName,
    })
  }

  // Fallback: use whatever system was stored from Ontoserver
  if (codings.length === 0 && med.codingSystem && med.codingDisplay) {
    codings.push({
      system: med.codingSystem,
      code: med.snomedCode || med.rxnormCode || 'unknown',
      display: med.codingDisplay,
    })
  }

  // ── Dosage instruction ────────────────────────────────────────────────────
  const sigText = [
    med.dose,
    med.frequency,
    med.duration ? `for ${med.duration}` : '',
  ]
    .filter(Boolean)
    .join(', ')

  const dosageInstruction: FHIRDosageInstruction = {
    text: sigText || 'As directed',
  }

  // ── Philippine-specific extensions ────────────────────────────────────────
  const extensions = [
    {
      url: `${PH_EXTENSION_BASE}/physician-prc-number`,
      valueString: rx.physician.prcNo,
    },
    {
      url: `${PH_EXTENSION_BASE}/physician-ptr-number`,
      valueString: rx.physician.ptrNo,
    },
  ]

  if (rx.physician.s2No) {
    extensions.push({
      url: `${PH_EXTENSION_BASE}/physician-s2-number`,
      valueString: rx.physician.s2No,
    })
  }

  // ── Assemble resource ─────────────────────────────────────────────────────
  const resource: FHIRMedicationRequest = {
    resourceType: 'MedicationRequest',
    id: rx.id ? `rx-${rx.id}-${medIndex}` : `rx-local-${Date.now()}-${medIndex}`,
    status: 'active',
    intent: 'order',
    medicationCodeableConcept: {
      coding: codings,
      text: med.brandName
        ? `${med.genericName} (${med.brandName})`
        : med.genericName,
    },
    subject: {
      display: rx.patientName,
    },
    authoredOn: rx.date,
    requester: {
      display: `${rx.physician.name}${rx.physician.specialty ? ', ' + rx.physician.specialty : ''}`,
    },
    dosageInstruction: [dosageInstruction],
    extension: extensions,
  }

  if (rx.notes) {
    resource.note = [{ text: rx.notes }]
  }

  return resource
}

/**
 * Export all medications in a prescription as a FHIR Bundle (collection).
 */
export function exportBundleToFHIR(rx: Prescription): object {
  const entries = rx.medications.map((_, i) => ({
    resource: exportToFHIR(rx, i),
  }))

  return {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: new Date().toISOString(),
    entry: entries,
  }
}

/**
 * Download a FHIR resource as a .json file.
 */
export function downloadFHIR(rx: Prescription): void {
  const bundle = exportBundleToFHIR(rx)
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: 'application/fhir+json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `rx-${rx.id ?? 'new'}-${rx.patientName.replace(/\s+/g, '_')}.fhir.json`
  a.click()
  URL.revokeObjectURL(url)
}
