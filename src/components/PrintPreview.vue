<script setup lang="ts">
import { computed } from 'vue'
import type { Prescription } from '../types'
import { downloadFHIR } from '../utils/fhirExport'

interface Props {
  prescription: Prescription
}

const props = defineProps<Props>()
const emit = defineEmits<{ close: [] }>()

const formattedDate = computed(() => {
  if (!props.prescription.date) return ''
  return new Date(props.prescription.date + 'T00:00:00').toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})

function triggerPrint() {
  window.print()
}

function exportFHIR() {
  downloadFHIR(props.prescription)
}
</script>

<template>
  <!-- ── Toolbar (hidden during print) ──────────────────────────────────── -->
  <div class="no-print flex items-center gap-3 mb-4 flex-wrap">
    <button
      class="px-5 py-2 bg-rx-blue text-white rounded-xl text-sm font-medium hover:bg-blue-900 transition"
      @click="triggerPrint"
    >
      Print (5×7)
    </button>
    <button
      class="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition"
      @click="exportFHIR"
    >
      Export FHIR JSON
    </button>
    <button
      class="px-5 py-2 border border-gray-300 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
      @click="emit('close')"
    >
      ← Back
    </button>
  </div>

  <!-- ── 5×7 Prescription Card ───────────────────────────────────────────── -->
  <!--
    On screen: a scaled preview card.
    On print:  @media print rules take over — exact 5×7 inch output.
  -->
  <div class="rx-preview-wrapper no-print-scale">
    <div class="rx-card">

      <!-- Header -->
      <header class="rx-header">
        <div class="rx-clinic-name">
          {{ prescription.physician.clinicName || 'Medical Clinic' }}
        </div>
        <div class="rx-clinic-meta">
          <span v-if="prescription.physician.clinicAddress">
            {{ prescription.physician.clinicAddress }}
          </span>
          <span v-if="prescription.physician.clinicPhone">
            &nbsp;·&nbsp;{{ prescription.physician.clinicPhone }}
          </span>
        </div>
        <div class="rx-physician-line">
          <strong>{{ prescription.physician.name }}</strong>
          <span v-if="prescription.physician.specialty">
            , {{ prescription.physician.specialty }}
          </span>
        </div>
      </header>

      <hr class="rx-divider" />

      <!-- Patient bar -->
      <div class="rx-patient-bar">
        <div class="rx-patient-name">
          <span class="rx-label">Patient:</span>
          {{ prescription.patientName }}
        </div>
        <div class="rx-patient-meta">
          <span v-if="prescription.age">{{ prescription.age }}</span>
          <span v-if="prescription.sex">&nbsp;/&nbsp;{{ prescription.sex }}</span>
          <span class="ml-3">{{ formattedDate }}</span>
        </div>
      </div>

      <!-- ℞ Symbol + Medication Body -->
      <div class="rx-body">
        <div class="rx-symbol">℞</div>
        <div class="rx-meds">
          <div
            v-for="(med, idx) in prescription.medications"
            :key="idx"
            class="rx-med-entry"
          >
            <div class="rx-med-generic">
              {{ med.genericName }}
              <span v-if="med.snomedCode || med.rxnormCode" class="rx-code-badge">
                {{ med.snomedCode || med.rxnormCode }}
              </span>
            </div>
            <div v-if="med.brandName" class="rx-med-brand">
              ({{ med.brandName }})
            </div>
            <div class="rx-med-sig">
              <span v-if="med.dose">{{ med.dose }}</span>
              <span v-if="med.frequency">&nbsp;— {{ med.frequency }}</span>
              <span v-if="med.duration">&nbsp;× {{ med.duration }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Notes -->
      <div v-if="prescription.notes" class="rx-notes">
        <span class="rx-label">Notes:</span> {{ prescription.notes }}
      </div>

      <!-- Footer -->
      <footer class="rx-footer">
        <div class="rx-sig-block">
          <img
            v-if="prescription.signatureBase64"
            :src="prescription.signatureBase64"
            alt="Physician signature"
            class="rx-sig-img"
          />
          <div v-else class="rx-sig-placeholder" />
          <div class="rx-sig-line" />
          <div class="rx-sig-name">{{ prescription.physician.name }}</div>
        </div>

        <div class="rx-credentials">
          <div v-if="prescription.physician.prcNo">
            PRC No. {{ prescription.physician.prcNo }}
          </div>
          <div v-if="prescription.physician.ptrNo">
            PTR No. {{ prescription.physician.ptrNo }}
          </div>
          <div v-if="prescription.physician.s2No">
            S2 No. {{ prescription.physician.s2No }}
          </div>
        </div>
      </footer>

    </div><!-- /rx-card -->
  </div>
</template>

<style scoped>
/* ── Screen preview wrapper ─────────────────────────────────────────────── */
.rx-preview-wrapper {
  display: flex;
  justify-content: center;
  padding: 1rem 0;
}

/* The card is rendered at 96dpi equivalent of 5×7 inches */
.rx-card {
  width: 480px;     /* 5in × 96dpi */
  min-height: 672px; /* 7in × 96dpi */
  background: white;
  border: 1px solid #ccc;
  box-shadow: 0 4px 24px rgba(0,0,0,.12);
  padding: 24px;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 11px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

/* ── Header ─────────────────────────────────────────────────────────────── */
.rx-header { text-align: center; margin-bottom: 4px; }
.rx-clinic-name { font-size: 14px; font-weight: bold; color: #1a3a5c; letter-spacing: .5px; }
.rx-clinic-meta { font-size: 9px; color: #555; margin-top: 1px; }
.rx-physician-line { font-size: 11px; color: #333; margin-top: 3px; }

.rx-divider { border: none; border-top: 1.5px solid #1a3a5c; margin: 6px 0; }

/* ── Patient bar ─────────────────────────────────────────────────────────── */
.rx-patient-bar { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
.rx-patient-name { font-size: 12px; font-weight: bold; }
.rx-patient-meta { font-size: 9px; color: #555; }
.rx-label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: .5px; margin-right: 4px; }

/* ── Body ────────────────────────────────────────────────────────────────── */
.rx-body { display: flex; flex: 1; margin-top: 4px; }

.rx-symbol {
  font-size: 48px;
  color: #1a3a5c;
  line-height: 1;
  margin-right: 12px;
  margin-top: -4px;
  font-style: italic;
  font-weight: bold;
  flex-shrink: 0;
}

.rx-meds { flex: 1; }

.rx-med-entry { margin-bottom: 10px; }
.rx-med-generic { font-size: 12px; font-weight: bold; color: #1a1a1a; }
.rx-code-badge {
  display: inline-block;
  font-size: 8px;
  background: #e8f0fe;
  color: #1a3a5c;
  border-radius: 3px;
  padding: 0 3px;
  margin-left: 4px;
  font-family: monospace;
  font-weight: normal;
  vertical-align: middle;
}
.rx-med-brand { font-size: 10px; font-style: italic; color: #444; margin-top: 1px; }
.rx-med-sig { font-size: 10px; color: #333; margin-top: 2px; }

/* ── Notes ───────────────────────────────────────────────────────────────── */
.rx-notes { font-size: 9px; color: #555; border-top: 1px dashed #ccc; padding-top: 5px; margin-top: 4px; }

/* ── Footer ──────────────────────────────────────────────────────────────── */
.rx-footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  border-top: 1.5px solid #1a3a5c;
  margin-top: auto;
  padding-top: 8px;
}

.rx-sig-block { text-align: center; min-width: 130px; }
.rx-sig-img { max-width: 130px; max-height: 50px; display: block; margin: 0 auto; }
.rx-sig-placeholder { height: 50px; }
.rx-sig-line { border-top: 1px solid #333; margin-top: 2px; }
.rx-sig-name { font-size: 9px; margin-top: 1px; }

.rx-credentials { font-size: 9px; text-align: right; color: #333; line-height: 1.5; }
</style>

<!--
  ╔══════════════════════════════════════════════════════════════════════╗
  ║   PRINT STYLES — injected globally so they work outside <scoped>   ║
  ╚══════════════════════════════════════════════════════════════════════╝
-->
<style>
@media print {
  /* Hide everything except the Rx card */
  .no-print { display: none !important; }

  /* Reset page to 5×7 with tight margins */
  @page {
    size: 5in 7in;
    margin: 0.25in;
  }

  body {
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
  }

  /* Remove wrapper centering; card fills the page */
  .rx-preview-wrapper {
    display: block !important;
    padding: 0 !important;
  }

  .rx-card {
    width: 100% !important;
    min-height: 0 !important;
    height: auto !important;
    box-shadow: none !important;
    border: none !important;
    padding: 0 !important;
    font-size: 10pt !important;
  }

  .rx-symbol { font-size: 42pt !important; }
  .rx-clinic-name { font-size: 13pt !important; }
  .rx-med-generic { font-size: 11pt !important; }
}
</style>
