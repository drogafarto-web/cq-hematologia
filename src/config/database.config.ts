/**
 * database.config.ts
 *
 * Controls which DatabaseService implementation is active.
 *
 * Switch via the VITE_DATABASE_PROVIDER env var:
 *   VITE_DATABASE_PROVIDER=firebase   → FirebaseService (production)
 *   VITE_DATABASE_PROVIDER=local      → LocalStorageService (offline dev/demo)
 *
 * Defaults to 'firebase' when the variable is absent.
 */

export enum DatabaseProvider {
  Firebase     = 'firebase',
  LocalStorage = 'local',
}

const raw = import.meta.env.VITE_DATABASE_PROVIDER ?? DatabaseProvider.Firebase;

const VALID_PROVIDERS = Object.values(DatabaseProvider) as string[];

if (!VALID_PROVIDERS.includes(raw)) {
  throw new Error(
    `[database.config] Invalid VITE_DATABASE_PROVIDER: "${raw}". ` +
    `Valid values: ${VALID_PROVIDERS.join(', ')}.`
  );
}

export const ACTIVE_DATABASE_PROVIDER = raw as DatabaseProvider;

export const isFirebase     = ACTIVE_DATABASE_PROVIDER === DatabaseProvider.Firebase;
export const isLocalStorage = ACTIVE_DATABASE_PROVIDER === DatabaseProvider.LocalStorage;
