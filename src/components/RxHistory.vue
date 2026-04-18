<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Prescription } from '../types'
import { listPrescriptions, searchPrescriptions, deletePrescription } from '../db'
import { downloadFHIR } from '../utils/fhirExport'

const emit = defineEmits<{
  view: [rx: Prescription]
  edit: [rx: Prescription]
}>()

const records = ref<Prescription[]>([])
const query = ref('')
const loading = ref(false)
const deleteConfirm = ref<number | null>(null)

async function load() {
  loading.value = true
  records.value = query.value.trim()
    ? await searchPrescriptions(query.value)
    : await listPrescriptions(50)
  loading.value = false
}

onMounted(load)

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(load, 250)
}

async function confirmDelete(id: number) {
  await deletePrescription(id)
  deleteConfirm.value = null
  await load()
}

function formatDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}
</script>

<template>
  <div class="space-y-4">
    <!-- Search bar -->
    <div class="flex gap-3">
      <input
        v-model="query"
        type="search"
        placeholder="Search by patient name…"
        class="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rx-blue"
        @input="onSearch"
      />
      <button
        class="px-4 py-2 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
        @click="load"
      >
        Refresh
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-gray-400 text-sm py-8 text-center">Loading…</div>

    <!-- Empty -->
    <div
      v-else-if="records.length === 0"
      class="text-gray-400 text-sm py-8 text-center"
    >
      No prescriptions found.
    </div>

    <!-- Table -->
    <div v-else class="space-y-2">
      <div
        v-for="rx in records"
        :key="rx.id"
        class="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4"
      >
        <div class="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <div class="font-semibold text-gray-800 text-sm">{{ rx.patientName }}</div>
            <div class="text-xs text-gray-500 mt-0.5">
              {{ formatDate(rx.date) }}
              &nbsp;·&nbsp;
              {{ rx.medications.length }} drug{{ rx.medications.length !== 1 ? 's' : '' }}
              &nbsp;·&nbsp;
              {{ rx.physician.name || 'Unknown physician' }}
            </div>
            <div class="text-xs text-gray-400 mt-0.5 truncate max-w-xs">
              {{ rx.medications.map(m => m.genericName).filter(Boolean).join(', ') }}
            </div>
          </div>

          <div class="flex gap-2 flex-shrink-0 flex-wrap">
            <button
              class="text-xs px-3 py-1.5 bg-rx-blue text-white rounded-lg hover:bg-blue-900 transition"
              @click="emit('view', rx)"
            >
              Print
            </button>
            <button
              class="text-xs px-3 py-1.5 border border-rx-blue text-rx-blue rounded-lg hover:bg-rx-light transition"
              @click="emit('edit', rx)"
            >
              Edit
            </button>
            <button
              class="text-xs px-3 py-1.5 border border-emerald-600 text-emerald-600 rounded-lg hover:bg-emerald-50 transition"
              @click="downloadFHIR(rx)"
            >
              FHIR
            </button>
            <button
              v-if="deleteConfirm !== rx.id"
              class="text-xs px-3 py-1.5 border border-red-300 text-red-400 rounded-lg hover:bg-red-50 transition"
              @click="deleteConfirm = rx.id ?? null"
            >
              Delete
            </button>
            <template v-else>
              <button
                class="text-xs px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                @click="confirmDelete(rx.id!)"
              >
                Confirm
              </button>
              <button
                class="text-xs px-3 py-1.5 border border-gray-300 text-gray-500 rounded-lg"
                @click="deleteConfirm = null"
              >
                Cancel
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
