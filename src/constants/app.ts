// ─── Application Branding ─────────────────────────────────────────────────────
// Single source of truth for all display strings.
// Update here; every component picks up the change automatically.

export const APP_NAME            = 'CQ Quality';
export const APP_SUBTITLE        = 'by Labclin';
export const APP_TAGLINE         = 'Plataforma de controle de qualidade laboratorial';
export const APP_MODULES_PREVIEW = 'Hematologia · Bioquímica · Microbiologia';
export const APP_COPYRIGHT_ENTITY = 'Labclin';

// ─── Module identifiers ───────────────────────────────────────────────────────
// Mirror of the custom-claim keys set by setModulesClaims Cloud Function.
// NEVER use raw strings — reference these constants everywhere.

export const MODULE_HEMATOLOGIA  = 'hematologia'  as const;
export const MODULE_BIOQUIMICA   = 'bioquimica'   as const;
export const MODULE_MICROBIOLOGIA = 'microbiologia' as const;

export type ModuleKey =
  | typeof MODULE_HEMATOLOGIA
  | typeof MODULE_BIOQUIMICA
  | typeof MODULE_MICROBIOLOGIA;

// Human-readable labels for each module (used in UI tiles and claims UI)
export const MODULE_LABELS: Record<ModuleKey, string> = {
  hematologia:  'Hematologia',
  bioquimica:   'Bioquímica',
  microbiologia: 'Microbiologia',
};
