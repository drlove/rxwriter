import type { OntoResult } from './types'

const RXNORM_SYSTEM = 'http://www.nlm.nih.gov/research/umls/rxnorm'
const RXNAV_BASE = 'https://rxnav.nlm.nih.gov/REST'

// TTY classes to surface: ingredients (IN) and clinical drug components (SCDC)
const ALLOWED_TTY = new Set(['IN', 'PIN', 'SCDC', 'SCD'])

interface RxNavDrugResponse {
  drugGroup?: {
    conceptGroup?: Array<{
      tty?: string
      conceptProperties?: Array<{
        rxcui?: string
        name?: string
        tty?: string
      }>
    }>
  }
}

/**
 * Search RxNorm for drug concepts matching the given term.
 * Uses the NLM RxNav REST API — free, no API key required.
 * Falls back to empty array when offline or on error.
 */
export async function searchDrug(term: string, count = 10): Promise<OntoResult[]> {
  if (!term.trim()) return []

  const url = new URL(`${RXNAV_BASE}/drugs.json`)
  url.searchParams.set('name', term.trim())

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) return []

    const data: RxNavDrugResponse = await res.json()
    const groups = data.drugGroup?.conceptGroup ?? []

    const results: OntoResult[] = []
    for (const group of groups) {
      if (!group.tty || !ALLOWED_TTY.has(group.tty)) continue
      for (const c of group.conceptProperties ?? []) {
        if (!c.rxcui || !c.name) continue
        results.push({ code: c.rxcui, display: c.name, system: RXNORM_SYSTEM })
        if (results.length >= count) break
      }
      if (results.length >= count) break
    }

    return results
  } catch {
    return []
  }
}

/**
 * Look up a single RxNorm concept by RXCUI.
 */
export async function lookupCode(code: string): Promise<OntoResult | null> {
  const url = new URL(`${RXNAV_BASE}/rxcui/${encodeURIComponent(code)}/property.json`)
  url.searchParams.set('propName', 'RxNorm Name')

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null

    const data: { propConceptGroup?: { propConcept?: Array<{ propValue?: string }> } } =
      await res.json()
    const name = data.propConceptGroup?.propConcept?.[0]?.propValue
    return name ? { code, display: name, system: RXNORM_SYSTEM } : null
  } catch {
    return null
  }
}
