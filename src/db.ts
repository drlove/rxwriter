import Dexie, { type Table } from 'dexie'
import type { Prescription } from './types'

/**
 * RxDB — IndexedDB database via Dexie.js
 *
 * All prescription data is stored 100% offline in the browser.
 * No server is required for CRUD operations.
 */
class RxDatabase extends Dexie {
  prescriptions!: Table<Prescription, number>

  constructor() {
    super('RxDB')

    this.version(1).stores(
      // Indexed fields: id (auto-increment PK), patientName, date, createdAt
      // Non-indexed fields (medications[], physician, etc.) are stored but not indexed
      {
        prescriptions: '++id, patientName, date, createdAt',
      },
    )
  }
}

export const db = new RxDatabase()

// ─── Convenience helpers ──────────────────────────────────────────────────────

export async function savePrescription(rx: Omit<Prescription, 'id'>): Promise<number> {
  return db.prescriptions.add({ ...rx, createdAt: Date.now() })
}

export async function updatePrescription(id: number, rx: Partial<Prescription>): Promise<number> {
  return db.prescriptions.update(id, rx)
}

export async function deletePrescription(id: number): Promise<void> {
  return db.prescriptions.delete(id)
}

export async function getPrescription(id: number): Promise<Prescription | undefined> {
  return db.prescriptions.get(id)
}

export async function listPrescriptions(limit = 50, offset = 0): Promise<Prescription[]> {
  return db.prescriptions
    .orderBy('createdAt')
    .reverse()
    .offset(offset)
    .limit(limit)
    .toArray()
}

export async function searchPrescriptions(query: string): Promise<Prescription[]> {
  const q = query.toLowerCase()
  return db.prescriptions
    .filter((rx) => rx.patientName.toLowerCase().includes(q))
    .reverse()
    .toArray()
}
