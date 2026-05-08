/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_BOOTSTRAP_BO_EMAIL: string
  readonly VITE_BOOTSTRAP_BO_PASSWORD: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
