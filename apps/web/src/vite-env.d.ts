/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_DEV_JWT_SECRET: string
  readonly VITE_SEED_BRAND_ID: string
  readonly VITE_SEED_USER_ID: string
  readonly VITE_AUTO_DEV_SIGNIN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
