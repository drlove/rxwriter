/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_FHIR_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
