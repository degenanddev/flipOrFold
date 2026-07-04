/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SILPHCO_API_KEY?: string
  readonly VITE_RENAISS_API_BASE?: string
  readonly VITE_RENAISS_INDEX_URL?: string
  readonly VITE_RENAISS_API_KEY?: string
  readonly VITE_RENAISS_API_SECRET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.txt?raw' {
  const content: string
  export default content
}
