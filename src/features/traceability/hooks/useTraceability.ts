import { useState, useEffect, useCallback, useMemo } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { useUser } from '../../../store/useAuthStore';
import {
  subscribeEvents,
  addEvent,
  resolveTraceability,
  type AddEventInput,
} from '../services/traceabilityService';
import type { TraceabilityEvent, TraceabilitySnapshot } from '../../../types';

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useTraceability — assina em tempo real os eventos de rastreabilidade do
 * lab ativo e expõe utilitários de consulta + registro.
 *
 * Volume baixo (~50-100 eventos/mês) permite carregamento integral em memória.
 * Quando passar de ~10k eventos por lab, migrar para query server-side com
 * índice composto (unidadeCode, equipmentId, examCodeNum).
 */
export function useTraceability() {
  const labId = useActiveLabId();
  const user = useUser();

  const [events, setEvents] = useState<TraceabilityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!labId) {
      setEvents([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsub = subscribeEvents(labId, (incoming) => {
      setEvents(incoming);
      setIsLoading(false);
    });

    return unsub;
  }, [labId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ── Register helpers ──────────────────────────────────────────────────────

  const registerEvent = useCallback(
    async (input: Omit<AddEventInput, 'tenantId' | 'registeredBy'>): Promise<string> => {
      if (!labId) throw new Error('Lab ativo não definido.');
      if (!user) throw new Error('Usuário não autenticado.');
      return addEvent(labId, {
        ...input,
        tenantId: labId,
        registeredBy: user.uid,
      });
    },
    [labId, user],
  );

  // ── Query helpers ─────────────────────────────────────────────────────────

  const lastExamCodeNumByUnidade = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events) {
      const key = `${e.unidadeCode}::${e.equipmentId}`;
      const cur = map.get(key) ?? 0;
      if (e.examCodeNum > cur) map.set(key, e.examCodeNum);
    }
    return map;
  }, [events]);

  /**
   * Sugere o próximo código de atendimento baseado no último evento
   * registrado para a (unidade, equipamento). Útil pra pré-preencher
   * inputs (último + 1).
   */
  const suggestNextExamCode = useCallback(
    (unidadeCode: string, equipmentId: string): string => {
      const key = `${unidadeCode.toUpperCase().trim()}::${equipmentId}`;
      const last = lastExamCodeNumByUnidade.get(key);
      if (!last) return '';
      // Preserva zero-padding mais comum (7 dígitos no LIS Worklab observado).
      return String(last + 1).padStart(7, '0');
    },
    [lastExamCodeNumByUnidade],
  );

  const resolve = useCallback(
    (unidadeCode: string, equipmentId: string, examCode: string): TraceabilitySnapshot =>
      resolveTraceability(events, unidadeCode, equipmentId, examCode),
    [events],
  );

  return {
    events,
    isLoading,
    error,
    registerEvent,
    suggestNextExamCode,
    resolve,
  };
}
