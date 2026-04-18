// ─── Terminology ────────────────────────────────────────────────────────────

export interface OntoResult {
  code: string
  display: string
  system: 'http://snomed.info/sct' | 'http://www.nlm.nih.gov/research/umls/rxnorm' | string
}

// ─── Prescription Domain ─────────────────────────────────────────────────────

export interface MedicationEntry {
  genericName: string
  brandName: string
  dose: string
  frequency: string
  duration: string
  // FHIR coding captured from Ontoserver autocomplete
  snomedCode: string
  rxnormCode: string
  codingSystem: string
  codingDisplay: string
}

export interface PhysicianMetadata {
  name: string
  specialty: string
  clinicName: string
  clinicAddress: string
  clinicPhone: string
  prcNo: string
  ptrNo: string
  s2No: string
}

export interface Prescription {
  id?: number
  // Patient
  patientName: string
  age: string
  sex: 'M' | 'F' | 'Other'
  date: string
  // Medications (one or more lines on the Rx)
  medications: MedicationEntry[]
  // Physician
  physician: PhysicianMetadata
  // Signature stored as Base64 data-URL or path
  signatureBase64: string
  // Optional notes / instructions
  notes: string
  createdAt: number
}

// ─── FHIR R4 MedicationRequest ────────────────────────────────────────────────

export interface FHIRCoding {
  system: string
  code: string
  display: string
}

export interface FHIRCodeableConcept {
  coding: FHIRCoding[]
  text: string
}

export interface FHIRDosageInstruction {
  text: string
  timing?: {
    repeat?: {
      frequency?: number
      period?: number
      periodUnit?: string
    }
  }
  doseAndRate?: Array<{
    doseQuantity?: {
      value?: number
      unit?: string
    }
  }>
}

export interface FHIRMedicationRequest {
  resourceType: 'MedicationRequest'
  id: string
  status: 'active' | 'completed' | 'cancelled'
  intent: 'order'
  medicationCodeableConcept: FHIRCodeableConcept
  subject: { display: string }
  authoredOn: string
  requester: { display: string }
  dosageInstruction: FHIRDosageInstruction[]
  note?: Array<{ text: string }>
  // Philippine-specific extensions
  extension?: Array<{
    url: string
    valueString?: string
    valueIdentifier?: { system: string; value: string }
  }>
}

// ─── Blank / default factories ───────────────────────────────────────────────

export function blankMedication(): MedicationEntry {
  return {
    genericName: '',
    brandName: '',
    dose: '',
    frequency: '',
    duration: '',
    snomedCode: '',
    rxnormCode: '',
    codingSystem: '',
    codingDisplay: '',
  }
}

export function blankPhysician(): PhysicianMetadata {
  return {
    name: '',
    specialty: '',
    clinicName: '',
    clinicAddress: '',
    clinicPhone: '',
    prcNo: '',
    ptrNo: '',
    s2No: '',
  }
}

export function blankPrescription(): Omit<Prescription, 'id'> {
  return {
    patientName: '',
    age: '',
    sex: 'M',
    date: new Date().toISOString().slice(0, 10),
    medications: [blankMedication()],
    physician: blankPhysician(),
    signatureBase64: '',
    notes: '',
    createdAt: Date.now(),
  }
}
