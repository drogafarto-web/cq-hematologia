import { z } from 'zod';
import type {
  Lab,
  LabContact,
  LabAddress,
  LabQCSettings,
  LabCompliance,
  LabSubscription,
  LabBackupConfig,
} from '../../../types';

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const LabContactSchema = z.object({
  email: z.string().email({ message: 'E-mail inválido' }).or(z.literal('')),
  phone: z.string().max(20),
});

const LabAddressSchema = z.object({
  street:       z.string().max(200),
  number:       z.string().max(20),
  complement:   z.string().max(100).optional(),
  neighborhood: z.string().max(100),
  city:         z.string().max(100),
  state:        z.string().length(2, { message: 'UF deve ter 2 caracteres' }),
  zipCode:      z.string().regex(/^\d{5}-?\d{3}$/, { message: 'CEP inválido' }).or(z.literal('')),
});

const LabQCSettingsSchema = z.object({
  westgardRules: z.object({
    '1-2s': z.boolean(),
    '1-3s': z.boolean(),
    '2-2s': z.boolean(),
    'R-4s': z.boolean(),
    '4-1s': z.boolean(),
    '10x':  z.boolean(),
  }),
  minRunsForInternalStats: z.number().int().min(5).max(100),
});

const LabComplianceSchema = z.object({
  cnesCode:          z.string().max(20).optional(),
  anvisaLicense:     z.string().max(50).optional(),
  iso15189:          z.boolean(),
  accreditationBody: z.string().max(100).optional(),
});

const LabSubscriptionSchema = z.object({
  plan:                z.enum(['free', 'basic', 'professional', 'enterprise']),
  status:              z.enum(['active', 'trialing', 'past_due', 'canceled']),
  trialEndsAt:         z.date().optional(),
  currentPeriodEndsAt: z.date().optional(),
});

const EmailListSchema = z
  .array(z.string().email({ message: 'E-mail inválido' }))
  .max(10, { message: 'No máximo 10 destinatários' })
  .default([]);

const LabBackupConfigSchema = z.object({
  emails:                 EmailListSchema,
  cqiEmails:              EmailListSchema,
  enabled:                z.boolean(),
  cqiEnabled:             z.boolean(),
  stalenessThresholdDays: z.number().int().min(1).max(30),
  // Campos legacy — aceitos como input para retrocompatibilidade, migrados pra arrays pelo normalizeLab.
  email:                  z.string().email({ message: 'E-mail inválido' }).nullable().optional(),
  cqiEmail:               z.string().email({ message: 'E-mail inválido' }).nullable().optional(),
});

// ─── Full create/update payload schema ───────────────────────────────────────
// Does NOT include id / createdAt / createdBy / updatedAt — those are
// system-managed fields, never accepted from user input.

export const LabSchema = z.object({
  name:         z.string().min(2, { message: 'Nome deve ter no mínimo 2 caracteres' }).max(100).trim(),
  legalName:    z.string().max(200).trim().optional(),
  cnpj:         z
    .string()
    .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, { message: 'CNPJ inválido' })
    .or(z.literal(''))
    .optional(),
  contact:      LabContactSchema,
  address:      LabAddressSchema,
  qcSettings:   LabQCSettingsSchema,
  compliance:   LabComplianceSchema,
  subscription: LabSubscriptionSchema,
  backup:       LabBackupConfigSchema,
});

export type LabFormValues = z.infer<typeof LabSchema>;

// ─── Safe defaults ────────────────────────────────────────────────────────────
// Used by normalizeLab() — any absent field on an existing Firestore document
// is replaced with a sensible default instead of crashing the app.

const DEFAULT_CONTACT: LabContact = {
  email: '',
  phone: '',
};

const DEFAULT_ADDRESS: LabAddress = {
  street:       '',
  number:       '',
  neighborhood: '',
  city:         '',
  state:        '',
  zipCode:      '',
};

const DEFAULT_QC_SETTINGS: LabQCSettings = {
  westgardRules: {
    '1-2s': true,
    '1-3s': true,
    '2-2s': true,
    'R-4s': true,
    '4-1s': true,
    '10x':  true,
  },
  minRunsForInternalStats: 20,
};

const DEFAULT_COMPLIANCE: LabCompliance = {
  iso15189: false,
};

const DEFAULT_SUBSCRIPTION: LabSubscription = {
  plan:   'free',
  status: 'active',
};

const DEFAULT_BACKUP: LabBackupConfig = {
  emails:                 [],
  cqiEmails:              [],
  enabled:                false,
  cqiEnabled:             false,
  stalenessThresholdDays: 3,
};

/**
 * Migra doc de backup do schema legacy (email/cqiEmail singulares) pro novo
 * (emails[] / cqiEmails[]). Idempotente — se já estiver no novo formato,
 * passa direto. Chamado no `normalizeLab`, então toda leitura vê arrays.
 */
function normalizeBackup(raw: Partial<LabBackupConfig>): LabBackupConfig {
  const dedupe = (list: string[]): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of list) {
      const k = e.trim().toLowerCase();
      if (k && !seen.has(k)) { seen.add(k); out.push(e.trim()); }
    }
    return out;
  };

  const emails: string[] = Array.isArray(raw.emails)
    ? dedupe(raw.emails as string[])
    : raw.email
      ? [raw.email]
      : [];

  const cqiEmails: string[] = Array.isArray(raw.cqiEmails)
    ? dedupe(raw.cqiEmails as string[])
    : raw.cqiEmail
      ? [raw.cqiEmail]
      // Fallback antigo: UI usava backup.email como padrão de CQI quando cqiEmail não existia
      : raw.email
        ? [raw.email]
        : [];

  return {
    emails,
    cqiEmails,
    enabled:                raw.enabled    ?? DEFAULT_BACKUP.enabled,
    cqiEnabled:             raw.cqiEnabled ?? raw.enabled ?? DEFAULT_BACKUP.cqiEnabled,
    stalenessThresholdDays: raw.stalenessThresholdDays ?? DEFAULT_BACKUP.stalenessThresholdDays,
  };
}

// ─── normalizeLab ─────────────────────────────────────────────────────────────
/**
 * Converts raw Firestore data (where new fields may be absent) into a fully
 * populated `Lab` object. Call this on every Firestore → domain mapping.
 *
 * Safe to call on both legacy documents (without contact/address/etc.) and
 * new documents that already have all fields — it never overwrites a real value.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeLab(raw: Record<string, any> & { id: string }): Lab {
  // Timestamps can come in as Firestore Timestamp objects or plain Dates.
  const toDate = (v: unknown): Date | undefined => {
    if (!v) return undefined;
    if (v instanceof Date) return v;
    if (typeof (v as { toDate?: unknown }).toDate === 'function') {
      return (v as { toDate: () => Date }).toDate();
    }
    return undefined;
  };

  return {
    id:        raw.id,
    name:      raw.name as string,
    legalName: raw.legalName as string | undefined,
    logoUrl:   raw.logoUrl as string | undefined,
    cnpj:      raw.cnpj as string | undefined,

    contact: raw.contact
      ? { ...DEFAULT_CONTACT, ...(raw.contact as Partial<LabContact>) }
      : DEFAULT_CONTACT,

    address: raw.address
      ? { ...DEFAULT_ADDRESS, ...(raw.address as Partial<LabAddress>) }
      : DEFAULT_ADDRESS,

    qcSettings: raw.qcSettings
      ? {
          ...DEFAULT_QC_SETTINGS,
          ...(raw.qcSettings as Partial<LabQCSettings>),
          westgardRules: {
            ...DEFAULT_QC_SETTINGS.westgardRules,
            ...((raw.qcSettings as Partial<LabQCSettings>).westgardRules ?? {}),
          },
        }
      : DEFAULT_QC_SETTINGS,

    compliance: raw.compliance
      ? { ...DEFAULT_COMPLIANCE, ...(raw.compliance as Partial<LabCompliance>) }
      : DEFAULT_COMPLIANCE,

    subscription: raw.subscription
      ? { ...DEFAULT_SUBSCRIPTION, ...(raw.subscription as Partial<LabSubscription>) }
      : DEFAULT_SUBSCRIPTION,

    backup: raw.backup
      ? normalizeBackup(raw.backup as Partial<LabBackupConfig>)
      : DEFAULT_BACKUP,

    createdAt: toDate(raw.createdAt) ?? new Date(),
    createdBy: (raw.createdBy as string | undefined) ?? '',
    updatedAt: toDate(raw.updatedAt),
  };
}
