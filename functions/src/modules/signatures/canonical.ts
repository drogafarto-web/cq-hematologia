/**
 * Canonical payload builder — determinístico e independente da ordem de chaves.
 * Usado tanto pelo cliente quanto pelo servidor para chegar na mesma representação
 * antes de hashear/HMAC-ar.
 *
 * CONTRATO: se mudar aqui, mudar no frontend simultaneamente. Mudança invalida
 * todas as assinaturas existentes — tratar como versão de protocolo.
 */

export const SIGNATURE_PROTOCOL_VERSION = 'v1';

/**
 * Ordena chaves de objetos recursivamente e coage tipos simples (Timestamp →
 * ISO string). Arrays mantêm ordem natural — são semânticos.
 */
export function canonicalize(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null) {
    // Firestore Timestamp com toDate()
    const maybeTs = value as { toDate?: () => Date };
    if (typeof maybeTs.toDate === 'function') {
      return maybeTs.toDate().toISOString();
    }
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = canonicalize(obj[key]);
    }
    return out;
  }
  return value;
}

export function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

// ─── Extratores de payload canônico por tipo de documento ───────────────────
//
// Cada função retorna um objeto só com os campos que entram na assinatura.
// Mudar um extrator = mudar versão de protocolo = invalidar assinaturas antigas.

export function extractRunCanonicalFields(
  doc: Record<string, unknown>,
): Record<string, unknown> {
  return {
    __v: SIGNATURE_PROTOCOL_VERSION,
    labId: doc['labId'] ?? null,
    lotId: doc['lotId'] ?? null,
    moduleId: doc['moduleId'] ?? null,
    operatorUid: doc['operatorUid'] ?? null,
    status: doc['status'] ?? null,
    results: doc['results'] ?? null,
    resultadoEsperado: doc['resultadoEsperado'] ?? null,
    resultadoObtido: doc['resultadoObtido'] ?? null,
    westgardViolations: doc['westgardViolations'] ?? null,
    reagentesSnapshot: doc['reagentesSnapshot'] ?? null,
    confirmedAt: doc['confirmedAt'] ?? null,
    createdAt: doc['createdAt'] ?? null,
  };
}

export function extractMovimentacaoCanonicalFields(
  doc: Record<string, unknown>,
): Record<string, unknown> {
  return {
    __v: SIGNATURE_PROTOCOL_VERSION,
    insumoId: doc['insumoId'] ?? null,
    tipo: doc['tipo'] ?? null,
    operadorId: doc['operadorId'] ?? null,
    clientTimestamp: doc['clientTimestamp'] ?? null,
    motivo: doc['motivo'] ?? null,
  };
}
