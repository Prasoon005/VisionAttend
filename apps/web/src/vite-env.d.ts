/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin. Empty in development, where Vite proxies /api. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
