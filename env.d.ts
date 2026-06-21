/**
 * Environment variable type declarations for Vite.
 * These variables are injected by Vite at build time.
 * @see https://vitejs.dev/guide/env-and-mode.html#intellisense-for-typescript
 */

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;

  /** Optional: set to 'true' to force Firestore long-polling (proxy environments) */
  readonly VITE_FIRESTORE_USE_LONG_POLLING?: string;

  /** Optional: Google OAuth client ID for Drive integrations */
  readonly VITE_GOOGLE_OAUTH_CLIENT_ID?: string;

  /** Optional: Sentry DSN for error reporting */
  readonly VITE_SENTRY_DSN?: string;

  /** Optional: environment name ('development', 'staging', 'production') */
  readonly VITE_ENV?: string;

  /** Index signature for dynamic key access (e.g., iterating REQUIRED_KEYS) */
  readonly [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
