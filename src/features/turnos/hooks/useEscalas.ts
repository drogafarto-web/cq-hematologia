import { useEffect, useMemo, useState, type SetStateAction } from 'react';
import { Timestamp } from '../../../shared/services/firebase';
import { useActiveLabId } from '../../../store/useAuthStore';
import { watchEscalas } from '../services/escalaService';
import type { EscalaDiaria } from '../types/Escala';
import type { LabId } from '../types/shared_refs';

export type EscalaViewMode = 'semana' | 'mes';

function getWeekRange(refDate: Date): { start: Date; end: Date } {
  const day = refDate.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const start = new Date(refDate);
  start.setDate(refDate.getDate() + diffToMon);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

interface UseEscalasResult {
  escalas: EscalaDiaria[];
  loading: boolean;
  error: Error | null;
  diasSemCobertura: Date[];
  alertasCount: number;
  rangeStart: Date;
  rangeEnd: Date;
  weekOffset: number;
  setWeekOffset: (value: SetStateAction<number>) => void;
}

export function useEscalas(): UseEscalasResult {
  const labId = useActiveLabId() as LabId | null;
  const [escalas, setEscalas] = useState<EscalaDiaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  const { rangeStart, rangeEnd } = useMemo(() => {
    const ref = new Date();
    ref.setDate(ref.getDate() + weekOffset * 7);
    const { start, end } = getWeekRange(ref);
    return { rangeStart: start, rangeEnd: end };
  }, [weekOffset]);

  useEffect(() => {
    if (!labId) {
      setEscalas([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const startTs = Timestamp.fromDate(rangeStart);
    const endTs = Timestamp.fromDate(rangeEnd);

    const unsub = watchEscalas(
      labId,
      startTs,
      endTs,
      (data) => {
        setEscalas(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [labId, rangeStart, rangeEnd]);

  const diasSemCobertura = useMemo(() => {
    const days: Date[] = [];
    const current = new Date(rangeStart);
    while (current <= rangeEnd) {
      const dayStart = new Date(current);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(current);
      dayEnd.setHours(23, 59, 59, 999);

      const dayEscalas = escalas.filter((e) => {
        const eDate = e.data.toDate();
        return eDate >= dayStart && eDate <= dayEnd;
      });

      const hasRT = dayEscalas.some((e) => e.rtPresente || e.rtSubstitutoPresente);
      if (!hasRT) {
        days.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }
    return days;
  }, [escalas, rangeStart, rangeEnd]);

  return {
    escalas,
    loading,
    error,
    diasSemCobertura,
    alertasCount: diasSemCobertura.length,
    rangeStart,
    rangeEnd,
    weekOffset,
    setWeekOffset,
  };
}
