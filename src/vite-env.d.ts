/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_API_VERSION?: string
  readonly VITE_BACKEND_TYPE?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_BRAND_NAME?: string
  readonly VITE_BRAND_SHORT_NAME?: string
  readonly VITE_BRAND_TAGLINE?: string
  readonly VITE_BRAND_DESCRIPTION?: string
  readonly VITE_BRAND_LOGO?: string
  readonly VITE_BRAND_COLOR?: string
  readonly VITE_BRAND_FOOTER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
