/**
 * personnel/hooks/useEscalas.ts
 *
 * Real-time subscription to escalas within a date range.
 * Supports week or month view. Derives diasSemCobertura and alertas.
 */

import { useEffect, useMemo, useState, type SetStateAction } from 'react';
import { Timestamp } from '../../../shared/services/firebase';
import { useActiveLabId } from '../../../store/useAuthStore';
import { watchEscalas } from '../services/escalaService';
import type { EscalaDiaria } from '../types/Escala';
import type { LabId } from '../types';

export type EscalaViewMode = 'semana' | 'mes';

function getWeekRange(refDate: Date): { start: Date; end: Date } {
  const day = refDate.getDay(); // 0=Sun
  const diffToMon = day === 0 ? -6 : 1 - day;
  const start = new Date(refDate);
  start.setDate(refDate.getDate() + diffToMon);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getMonthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
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
  viewMode: EscalaViewMode;
  setViewMode: (mode: EscalaViewMode) => void;
  // Week navigation
  setWeekOffset: (value: SetStateAction<number>) => void;
  // Month navigation
  selectedMonth: number;
  selectedYear: number;
  setSelectedMonth: (m: number) => void;
  setSelectedYear: (y: number) => void;
}

export function useEscalas(): UseEscalasResult {
  const labId = useActiveLabId() as LabId | null;
  const [escalas, setEscalas] = useState<EscalaDiaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [viewMode, setViewMode] = useState<EscalaViewMode>('semana');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (viewMode === 'mes') {
      const { start, end } = getMonthRange(selectedYear, selectedMonth);
      return { rangeStart: start, rangeEnd: end };
    }
    const ref = new Date();
    ref.setDate(ref.getDate() + weekOffset * 7);
    const { start, end } = getWeekRange(ref);
    return { rangeStart: start, rangeEnd: end };
  }, [viewMode, weekOffset, selectedMonth, selectedYear]);

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

  const alertasCount = diasSemCobertura.length;

  return {
    escalas,
    loading,
    error,
    diasSemCobertura,
    alertasCount,
    rangeStart,
    rangeEnd,
    viewMode,
    setViewMode,
    setWeekOffset,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
  };
}
