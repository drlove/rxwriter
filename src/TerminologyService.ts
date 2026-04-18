import type { OntoResult } from './types'

/**
 * TerminologyService
 *
 * Wraps the HL7 FHIR Terminology Service API against CSIRO's public Ontoserver.
 * All calls are best-effort: when offline or on error, an empty array is returned
 * so the form remains fully usable without network access.
 *
 * Default endpoint: https://r4.ontoserver.csiro.au/fhir
 * Override via VITE_FHIR_BASE_URL env var (e.g. your PH Core Profile server).
 */

const FHIR_BASE = (import.meta.env.VITE_FHIR_BASE_URL as string | undefined)
  ?? 'https://r4.ontoserver.csiro.au/fhir'

// SNOMED CT drug concepts ValueSet URL (Clinical Finding / Pharmaceutical subset)
const SNOMED_DRUG_VALUESET = 'http://snomed.info/sct?fhir_vs=isa/373873005'

// RxNorm Clinical Drug ValueSet — VSAC / NLM hosted
const RXNORM_VALUESET = 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113762.1.4.1010.4'

type SearchSystem = 'snomed' | 'rxnorm'

interface FHIRBundle {
  resourceType: string
  expansion?: {
    contains?: Array<{
      system?: string
      code?: string
      display?: string
    }>
  }
}

/**
 * Expand a ValueSet and return matching drug concepts.
 *
 * @param term   The drug name fragment to search for (e.g. "amox")
 * @param system Which coding system to search ('snomed' | 'rxnorm')
 * @param count  Maximum results to return (default 10)
 */
export async function searchDrug(
  term: string,
  system: SearchSystem = 'snomed',
  count = 10,
): Promise<OntoResult[]> {
  if (!term.trim()) return []

  const valueSetUrl = system === 'snomed' ? SNOMED_DRUG_VALUESET : RXNORM_VALUESET
  const url = new URL(`${FHIR_BASE}/ValueSet/$expand`)
  url.searchParams.set('url', valueSetUrl)
  url.searchParams.set('filter', term.trim())
  url.searchParams.set('count', String(count))
  url.searchParams.set('includeDesignations', 'false')

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/fhir+json' },
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) return []

    const bundle: FHIRBundle = await res.json()
    const contains = bundle.expansion?.contains ?? []

    return contains
      .filter((c) => c.code && c.display && c.system)
      .map((c) => ({
        code: c.code!,
        display: c.display!,
        system: c.system!,
      }))
  } catch {
    // Offline or timeout — degrade silently
    return []
  }
}

/**
 * Look up a single concept by code to get its canonical display name.
 * Used to verify / refresh a stored code after coming back online.
 */
export async function lookupCode(
  code: string,
  system: string,
): Promise<OntoResult | null> {
  const url = new URL(`${FHIR_BASE}/CodeSystem/$lookup`)
  url.searchParams.set('system', system)
  url.searchParams.set('code', code)

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/fhir+json' },
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) return null

    // Parameters resource — extract display name
    const params: { parameter?: Array<{ name: string; valueString?: string }> } =
      await res.json()
    const display = params.parameter?.find((p) => p.name === 'display')?.valueString ?? ''

    return display ? { code, display, system } : null
  } catch {
    return null
  }
}
