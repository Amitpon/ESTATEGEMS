/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** נקודת הקצה של Appwrite, למשל https://cloud.appwrite.io/v1. חסר = Appwrite כבוי. */
  readonly VITE_APPWRITE_ENDPOINT?: string
  readonly VITE_APPWRITE_PROJECT_ID?: string
  readonly VITE_APPWRITE_DATABASE_ID?: string
  readonly VITE_APPWRITE_PROPERTIES_COLLECTION_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
