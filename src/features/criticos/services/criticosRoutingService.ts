/**
 * Críticos Routing Service — Escalation rule resolution
 *
 * Path: /labs/{labId}/criticos-routing/
 * Convention: labId is mandatory parameter for multi-tenant isolation
 * RN-06: Always use soft-delete (never deleteDoc)
 *
 * Implements RDC 978 Art. 127 (escalação de críticos)
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  Timestamp,
  firestoreErrorMessage,
} from '../../../shared/services/firebase';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../../constants';
import type { CriticoRouteRule, NotificationChannel, CriticoSeverity } from '../types';
import { db } from '../../../shared/services/firebase';
import { z } from 'zod';

// ─── In-memory cache ────────────────────────────────────────────────────────

const routingCache = new Map<string, { rules: CriticoRouteRule[]; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 1000; // 30s cache

// ─── Default routing rules ──────────────────────────────────────────────────

/**
 * Hard-coded fallback routing rules when lab has no custom rules.
 * Follows RDC 978 Art. 127 escalation to RT.
 *
 * Panic → SMS + email to RT
 * High → email to RT
 * Medium → in-app to RT
 * Low → in-app to RT (no external escalation)
 */
function getDefaultRouting(): CriticoRouteRule[] {
  return [
    {
      id: 'default-panic',
      labId: 'system',
      analitoId: undefined,
      severity: 'panic',
      channels: [
        { type: 'sms', target: '', fallbackOrder: 0 },
        { type: 'email', target: '', fallbackOrder: 1 },
      ],
      responsavelEscalacaoUserId: 'system-rt',
      slaMinutes: 5,
      ativo: true,
    },
    {
      id: 'default-high',
      labId: 'system',
      analitoId: undefined,
      severity: 'high',
      channels: [{ type: 'email', target: '', fallbackOrder: 0 }],
      responsavelEscalacaoUserId: 'system-rt',
      slaMinutes: 15,
      ativo: true,
    },
    {
      id: 'default-medium',
      labId: 'system',
      analitoId: undefined,
      severity: 'medium',
      channels: [{ type: 'in-app', target: '', fallbackOrder: 0 }],
      responsavelEscalacaoUserId: 'system-rt',
      slaMinutes: 30,
      ativo: true,
    },
    {
      id: 'default-low',
      labId: 'system',
      analitoId: undefined,
      severity: 'low',
      channels: [{ type: 'in-app', target: '', fallbackOrder: 0 }],
      responsavelEscalacaoUserId: 'system-rt',
      slaMinutes: 60,
      ativo: true,
    },
  ];
}

// ─── Path helpers ────────────────────────────────────────────────────────────

function routingCollection(labId: string) {
  return collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.CRITICOS_ROUTING);
}

function routingRef(labId: string, ruleId: string) {
  return doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.CRITICOS_ROUTING, ruleId);
}

// ─── Zod validation ─────────────────────────────────────────────────────────

const NotificationChannelSchema = z.object({
  type: z.enum(['sms', 'email', 'in-app']),
  target: z.string().min(1),
  fallbackOrder: z.number().int().min(0),
});

const CriticoRouteRuleInputSchema = z.object({
  analitoId: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'panic']),
  channels: z.array(NotificationChannelSchema).min(1),
  responsavelEscalacaoUserId: z.string().min(1),
  slaMinutes: z.number().int().min(1),
  ativo: z.boolean(),
});

type RuleInput = z.infer<typeof CriticoRouteRuleInputSchema>;

// ─── Service API ────────────────────────────────────────────────────────────

/**
 * Get routing rules for a lab with in-memory caching.
 * Returns only active, non-deleted rules.
 *
 * @param labId Lab identifier
 * @returns Array of routing rules (may be empty; fallback to defaults)
 */
export async function getRoutingForLab(labId: string): Promise<CriticoRouteRule[]> {
  try {
    // Check cache
    const cached = routingCache.get(labId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.rules;
    }

    // Query from Firestore
    const q = query(
      routingCollection(labId),
      where('deletadoEm', '==', null),
      where('ativo', '==', true),
    );
    const snap = await getDocs(q);
    const rules = snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<CriticoRouteRule, 'id'>) }) as CriticoRouteRule,
    );

    // Cache for 30s
    routingCache.set(labId, {
      rules,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return rules;
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Resolve notification channels for a critical alert.
 * Matches by (analitoId + severity) first, then falls back to severity-only.
 * If no match, returns channels from default routing.
 *
 * @param labId Lab identifier
 * @param analitoId Analyte ID of the alert
 * @param severity Severity level of the alert
 * @returns Array of notification channels ordered by fallbackOrder
 */
export async function resolveChannelsForAlert(
  labId: string,
  analitoId: string,
  severity: CriticoSeverity,
): Promise<NotificationChannel[]> {
  try {
    const labRules = await getRoutingForLab(labId);
    const defaults = getDefaultRouting();

    // Try most-specific rule first: analitoId + severity match
    const specificRule = labRules.find((r) => r.analitoId === analitoId && r.severity === severity);
    if (specificRule) {
      return specificRule.channels.sort((a, b) => a.fallbackOrder - b.fallbackOrder);
    }

    // Fall back to severity-only rule (analitoId is undefined/null)
    const severityRule = labRules.find((r) => !r.analitoId && r.severity === severity);
    if (severityRule) {
      return severityRule.channels.sort((a, b) => a.fallbackOrder - b.fallbackOrder);
    }

    // Fall back to default routing
    const defaultRule = defaults.find((r) => r.severity === severity);
    if (defaultRule) {
      return defaultRule.channels.sort((a, b) => a.fallbackOrder - b.fallbackOrder);
    }

    // Last resort: return empty (should not happen with proper defaults)
    return [];
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Create or update a routing rule (upsert).
 *
 * @param labId Lab identifier
 * @param rule Rule data (excluding id and labId)
 * @returns Document ID of the created/updated rule
 */
export async function upsertRouteRule(
  labId: string,
  rule: Omit<CriticoRouteRule, 'id' | 'labId'>,
): Promise<string> {
  try {
    // Validate input
    const validated = CriticoRouteRuleInputSchema.parse(rule);

    const id = crypto.randomUUID();
    const docData: CriticoRouteRule = {
      id,
      labId,
      ...validated,
    };

    await setDoc(routingRef(labId, id), docData);

    // Invalidate cache
    routingCache.delete(labId);

    return id;
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new Error(`Validation error: ${err.errors.map((e) => e.message).join('; ')}`);
    }
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Soft-delete a routing rule (mark as deleted without removing).
 *
 * @param labId Lab identifier
 * @param ruleId Rule document ID
 */
export async function softDeleteRouteRule(labId: string, ruleId: string): Promise<void> {
  try {
    const ref = routingRef(labId, ruleId);
    const existing = await getDoc(ref);

    if (!existing.exists()) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    const data = existing.data() as CriticoRouteRule;
    if (data.labId !== labId) {
      throw new Error('Cross-tenant write attempted');
    }

    await updateDoc(ref, {
      deletadoEm: Timestamp.now(),
    });

    // Invalidate cache
    routingCache.delete(labId);
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) throw err;
    if (err instanceof Error && err.message.includes('Cross-tenant')) throw err;
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}
