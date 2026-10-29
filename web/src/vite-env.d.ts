/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_BASE_PATH?: string;
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_REPOSITORY_URL?: string;
  readonly VITE_CONTACT_EMAIL?: string;
}
