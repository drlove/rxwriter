<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import RxWriter from './components/RxWriter.vue'
import PrintPreview from './components/PrintPreview.vue'
import RxHistory from './components/RxHistory.vue'
import { getPrescription } from './db'
import type { Prescription } from './types'

type Tab = 'write' | 'history'

const activeTab = ref<Tab>('write')
const editDraft = shallowRef<Prescription | undefined>(undefined)
const printRecord = shallowRef<Prescription | null>(null)

async function onSaved(_id: number) {
  // After save, reset the form draft
  editDraft.value = undefined
  activeTab.value = 'history'
}

async function onPrint(id: number) {
  const rx = await getPrescription(id)
  if (rx) printRecord.value = rx
}

function onEdit(rx: Prescription) {
  editDraft.value = { ...rx }
  activeTab.value = 'write'
}

function onView(rx: Prescription) {
  printRecord.value = rx
}

function closePrint() {
  printRecord.value = null
}

function newPrescription() {
  editDraft.value = undefined
  activeTab.value = 'write'
}
</script>

<template>
  <div class="min-h-screen bg-rx-light">

    <!-- ── App Shell (hidden during print) ────────────────────────────── -->
    <div class="no-print">
      <!-- Top bar -->
      <header class="bg-rx-blue text-white shadow-md">
        <div class="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-2xl font-bold font-serif italic">℞</span>
            <div>
              <div class="font-bold text-sm leading-tight">EloyRx</div>
              <div class="text-xs text-blue-200 leading-tight">Philippine Prescription Writer</div>
            </div>
          </div>
          <div class="flex items-center gap-1 text-xs">
            <span class="bg-green-500 rounded-full w-2 h-2 inline-block" title="Offline-ready" />
            <span class="text-blue-200">Offline-first · FHIR R4</span>
          </div>
        </div>
      </header>

      <!-- Tabs -->
      <nav class="bg-white border-b border-gray-200 shadow-sm">
        <div class="max-w-2xl mx-auto px-4 flex gap-0">
          <button
            class="px-5 py-3 text-sm font-medium border-b-2 transition"
            :class="activeTab === 'write'
              ? 'border-rx-blue text-rx-blue'
              : 'border-transparent text-gray-500 hover:text-gray-700'"
            @click="activeTab = 'write'"
          >
            Write Rx
          </button>
          <button
            class="px-5 py-3 text-sm font-medium border-b-2 transition"
            :class="activeTab === 'history'
              ? 'border-rx-blue text-rx-blue'
              : 'border-transparent text-gray-500 hover:text-gray-700'"
            @click="activeTab = 'history'"
          >
            History
          </button>
          <button
            v-if="editDraft"
            class="px-5 py-3 text-sm font-medium border-b-2 border-transparent text-rx-gold hover:text-yellow-700 transition"
            @click="newPrescription"
          >
            + New Rx
          </button>
        </div>
      </nav>
    </div>

    <!-- ── Print Preview overlay ───────────────────────────────────────── -->
    <div v-if="printRecord" class="max-w-2xl mx-auto px-4 py-6">
      <PrintPreview
        :prescription="printRecord"
        @close="closePrint"
      />
    </div>

    <!-- ── Main content ────────────────────────────────────────────────── -->
    <main v-else class="max-w-2xl mx-auto px-4 py-6 no-print">
      <RxWriter
        v-if="activeTab === 'write'"
        :key="editDraft?.id ?? 'new'"
        :draft="editDraft"
        @saved="onSaved"
        @print="onPrint"
      />

      <RxHistory
        v-else-if="activeTab === 'history'"
        @view="onView"
        @edit="onEdit"
      />
    </main>

  </div>
</template>
