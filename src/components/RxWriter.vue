<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import SignaturePad from './SignaturePad.vue'
import { searchDrug } from '../TerminologyService'
import { savePrescription, updatePrescription } from '../db'
import {
  blankMedication,
  blankPhysician,
  type MedicationEntry,
  type OntoResult,
  type Prescription,
} from '../types'

interface Props {
  draft?: Prescription   // pre-fill form when editing an existing record
}

const props = defineProps<Props>()

const emit = defineEmits<{
  saved: [id: number]
  print: [id: number]
}>()

// ── Form state ────────────────────────────────────────────────────────────────

const patientName = ref(props.draft?.patientName ?? '')
const age = ref(props.draft?.age ?? '')
const sex = ref<'M' | 'F' | 'Other'>(props.draft?.sex ?? 'M')
const date = ref(props.draft?.date ?? new Date().toISOString().slice(0, 10))
const notes = ref(props.draft?.notes ?? '')
const signatureBase64 = ref(props.draft?.signatureBase64 ?? '')

const medications = reactive<MedicationEntry[]>(
  props.draft?.medications.map((m) => ({ ...m })) ?? [blankMedication()],
)

const physician = reactive({ ...blankPhysician(), ...(props.draft?.physician ?? {}) })

// Persist physician metadata in localStorage so it survives refreshes
const PHYSICIAN_KEY = 'eloyrx_physician'
try {
  const stored = localStorage.getItem(PHYSICIAN_KEY)
  if (stored && !props.draft) {
    Object.assign(physician, JSON.parse(stored))
  }
} catch { /* ignore */ }

watch(
  () => ({ ...physician }),
  (val) => {
    try { localStorage.setItem(PHYSICIAN_KEY, JSON.stringify(val)) } catch { /* ignore */ }
  },
  { deep: true },
)

// ── Autocomplete state (per medication row) ───────────────────────────────────

interface AutocompleteState {
  results: OntoResult[]
  loading: boolean
  open: boolean
  timer: ReturnType<typeof setTimeout> | null
  highlighted: number
}

function makeAC(): AutocompleteState {
  return { results: [], loading: false, open: false, timer: null, highlighted: -1 }
}

const autocomplete = reactive<AutocompleteState[]>(medications.map(() => makeAC()))

function onGenericInput(idx: number, value: string) {
  medications[idx].genericName = value
  const ac = autocomplete[idx]

  // Clear previous FHIR codes when user types a new name
  medications[idx].snomedCode = ''
  medications[idx].rxnormCode = ''
  medications[idx].codingSystem = ''
  medications[idx].codingDisplay = ''

  if (ac.timer) clearTimeout(ac.timer)
  if (value.length < 2) {
    ac.open = false
    ac.results = []
    return
  }

  ac.timer = setTimeout(async () => {
    ac.loading = true
    ac.results = await searchDrug(value)
    ac.loading = false
    ac.open = ac.results.length > 0
    ac.highlighted = -1
  }, 300)
}

function selectSuggestion(idx: number, result: OntoResult) {
  medications[idx].genericName = result.display
  medications[idx].codingDisplay = result.display
  medications[idx].codingSystem = result.system

  if (result.system === 'http://snomed.info/sct') {
    medications[idx].snomedCode = result.code
  } else if (result.system.includes('rxnorm')) {
    medications[idx].rxnormCode = result.code
  } else {
    medications[idx].snomedCode = result.code
  }

  autocomplete[idx].open = false
}

function onACKeydown(idx: number, e: KeyboardEvent) {
  const ac = autocomplete[idx]
  if (!ac.open) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    ac.highlighted = Math.min(ac.highlighted + 1, ac.results.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    ac.highlighted = Math.max(ac.highlighted - 1, -1)
  } else if (e.key === 'Enter' && ac.highlighted >= 0) {
    e.preventDefault()
    selectSuggestion(idx, ac.results[ac.highlighted])
  } else if (e.key === 'Escape') {
    ac.open = false
  }
}

// ── Add / remove medication rows ──────────────────────────────────────────────

function addMedication() {
  medications.push(blankMedication())
  autocomplete.push(makeAC())
}

function removeMedication(idx: number) {
  if (medications.length === 1) return
  medications.splice(idx, 1)
  autocomplete.splice(idx, 1)
}

// ── Save ──────────────────────────────────────────────────────────────────────

const saving = ref(false)
const saveError = ref('')

async function save(andPrint = false) {
  saveError.value = ''
  if (!patientName.value.trim()) {
    saveError.value = 'Patient name is required.'
    return
  }
  if (!physician.name.trim()) {
    saveError.value = 'Physician name is required.'
    return
  }

  saving.value = true
  try {
    const payload = {
      patientName: patientName.value.trim(),
      age: age.value,
      sex: sex.value,
      date: date.value,
      medications: [...medications],
      physician: { ...physician },
      signatureBase64: signatureBase64.value,
      notes: notes.value,
      createdAt: Date.now(),
    }

    let id: number
    if (props.draft?.id) {
      await updatePrescription(props.draft.id, payload)
      id = props.draft.id
    } else {
      id = await savePrescription(payload)
    }

    emit('saved', id)
    if (andPrint) emit('print', id)
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : 'Save failed.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="space-y-6" @submit.prevent>

    <!-- ── Patient Info ─────────────────────────────────────────────────── -->
    <section class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h2 class="text-rx-blue font-semibold text-sm uppercase tracking-widest mb-4">
        Patient Information
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="sm:col-span-1">
          <label class="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
          <input
            v-model="patientName"
            type="text"
            placeholder="Juan dela Cruz"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rx-blue"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Age</label>
          <input
            v-model="age"
            type="text"
            placeholder="32 y/o"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rx-blue"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Sex</label>
          <select
            v-model="sex"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rx-blue"
          >
            <option value="M">Male</option>
            <option value="F">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Date</label>
          <input
            v-model="date"
            type="date"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rx-blue"
          />
        </div>
      </div>
    </section>

    <!-- ── Medications ──────────────────────────────────────────────────── -->
    <section class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-rx-blue font-semibold text-sm uppercase tracking-widest">
          Medications
        </h2>
        <button
          type="button"
          class="text-xs bg-rx-blue text-white px-3 py-1 rounded-full hover:bg-blue-900 transition"
          @click="addMedication"
        >
          + Add Drug
        </button>
      </div>

      <div
        v-for="(med, idx) in medications"
        :key="idx"
        class="mb-6 pb-6 border-b border-gray-100 last:border-0 last:pb-0 last:mb-0"
      >
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-semibold text-gray-400">Drug #{{ idx + 1 }}</span>
          <button
            v-if="medications.length > 1"
            type="button"
            class="text-xs text-red-400 hover:text-red-600"
            @click="removeMedication(idx)"
          >
            Remove
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <!-- Generic Name with autocomplete -->
          <div class="relative">
            <label class="block text-xs font-medium text-gray-600 mb-1">
              Generic Name
              <span
                v-if="med.snomedCode"
                class="ml-1 text-green-600 font-normal"
                :title="`SNOMED CT: ${med.snomedCode}`"
              >
                ✓ SNOMED
              </span>
              <span
                v-else-if="med.rxnormCode"
                class="ml-1 text-blue-600 font-normal"
                :title="`RxNorm: ${med.rxnormCode}`"
              >
                ✓ RxNorm
              </span>
            </label>
            <input
              :value="med.genericName"
              type="text"
              placeholder="e.g. Amoxicillin"
              autocomplete="off"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rx-blue"
              @input="onGenericInput(idx, ($event.target as HTMLInputElement).value)"
              @keydown="onACKeydown(idx, $event)"
              @blur="() => setTimeout(() => { autocomplete[idx].open = false }, 150)"
            />

            <!-- Autocomplete dropdown -->
            <div
              v-if="autocomplete[idx].open"
              class="absolute z-50 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto"
            >
              <div
                v-if="autocomplete[idx].loading"
                class="px-3 py-2 text-xs text-gray-400 italic"
              >
                Searching Ontoserver…
              </div>
              <button
                v-for="(result, ri) in autocomplete[idx].results"
                :key="result.code"
                type="button"
                class="w-full text-left px-3 py-2 text-sm hover:bg-rx-light"
                :class="{ 'bg-rx-light': autocomplete[idx].highlighted === ri }"
                @mousedown.prevent="selectSuggestion(idx, result)"
              >
                <span class="font-medium">{{ result.display }}</span>
                <span class="ml-2 text-xs text-gray-400">{{ result.code }}</span>
                <span class="ml-1 text-xs text-gray-300">
                  {{ result.system.includes('snomed') ? 'SNOMED' : 'RxNorm' }}
                </span>
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Brand Name</label>
            <input
              v-model="med.brandName"
              type="text"
              placeholder="e.g. Amoxil"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rx-blue"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Dose</label>
            <input
              v-model="med.dose"
              type="text"
              placeholder="e.g. 500mg"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rx-blue"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
            <input
              v-model="med.frequency"
              type="text"
              placeholder="e.g. 3x daily"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rx-blue"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Duration</label>
            <input
              v-model="med.duration"
              type="text"
              placeholder="e.g. 7 days"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rx-blue"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- ── Notes ────────────────────────────────────────────────────────── -->
    <section class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h2 class="text-rx-blue font-semibold text-sm uppercase tracking-widest mb-3">
        Instructions / Notes
      </h2>
      <textarea
        v-model="notes"
        rows="2"
        placeholder="Additional instructions for the patient…"
        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rx-blue resize-none"
      />
    </section>

    <!-- ── Physician Credentials ─────────────────────────────────────────── -->
    <section class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h2 class="text-rx-blue font-semibold text-sm uppercase tracking-widest mb-4">
        Physician Credentials
        <span class="ml-2 text-gray-400 font-normal normal-case text-xs">(saved locally)</span>
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
          <input
            v-model="physician.name"
            type="text"
            placeholder="Dr. Maria Santos"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rx-blue"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Specialty</label>
          <input
            v-model="physician.specialty"
            type="text"
            placeholder="Internal Medicine"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rx-blue"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Clinic Name</label>
          <input
            v-model="physician.clinicName"
            type="text"
            placeholder="Santos Medical Clinic"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rx-blue"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Clinic Address</label>
          <input
            v-model="physician.clinicAddress"
            type="text"
            placeholder="123 Rizal St., Manila"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rx-blue"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Clinic Phone</label>
          <input
            v-model="physician.clinicPhone"
            type="text"
            placeholder="+63 2 8XXX XXXX"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rx-blue"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">PRC No.</label>
          <input
            v-model="physician.prcNo"
            type="text"
            placeholder="0012345"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rx-blue"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">PTR No.</label>
          <input
            v-model="physician.ptrNo"
            type="text"
            placeholder="1234567"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rx-blue"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">S2 License No.</label>
          <input
            v-model="physician.s2No"
            type="text"
            placeholder="SS-12345 (if applicable)"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rx-blue"
          />
        </div>
      </div>

      <!-- Signature -->
      <div class="mt-4">
        <label class="block text-xs font-medium text-gray-600 mb-2">Signature</label>
        <SignaturePad v-model="signatureBase64" :width="320" :height="100" />
      </div>
    </section>

    <!-- ── Error & Actions ───────────────────────────────────────────────── -->
    <div v-if="saveError" class="text-red-600 text-sm px-1">{{ saveError }}</div>

    <div class="flex flex-wrap gap-3">
      <button
        type="button"
        :disabled="saving"
        class="px-6 py-2.5 bg-rx-blue text-white rounded-xl text-sm font-medium hover:bg-blue-900 disabled:opacity-50 transition"
        @click="save(false)"
      >
        {{ saving ? 'Saving…' : 'Save' }}
      </button>
      <button
        type="button"
        :disabled="saving"
        class="px-6 py-2.5 bg-rx-gold text-white rounded-xl text-sm font-medium hover:bg-yellow-700 disabled:opacity-50 transition"
        @click="save(true)"
      >
        Save &amp; Print
      </button>
    </div>

  </form>
</template>
