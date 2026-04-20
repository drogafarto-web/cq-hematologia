import { z } from 'zod';

// ─── Phone ────────────────────────────────────────────────────────────────────

const PhoneE164 = z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, 'Telefone deve estar no formato E.164 (ex: +5511999999999)')
  .optional();

// ─── Create user ──────────────────────────────────────────────────────────────

export const CreateUserSchema = z.object({
  displayName: z.string().min(1, 'Nome obrigatório').max(100),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha mínima de 8 caracteres'),
  labId: z.string().optional(),
  role: z.enum(['admin', 'member']).optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

// ─── Role change ──────────────────────────────────────────────────────────────

export const RoleChangeSchema = z.object({
  targetUid: z.string().min(1),
  labId: z.string().min(1),
  role: z.enum(['admin', 'member']),
});

export type RoleChangeInput = z.infer<typeof RoleChangeSchema>;

// ─── Contact info ─────────────────────────────────────────────────────────────

export const ContactSchema = z.object({
  phone: PhoneE164,
  whatsapp: PhoneE164,
  notes: z.string().max(500).optional(),
});

export type ContactInfo = z.infer<typeof ContactSchema>;
