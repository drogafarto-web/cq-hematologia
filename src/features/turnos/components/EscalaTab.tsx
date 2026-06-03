import { useCallback, useMemo, useState } from 'react';
import { useEscalas } from '../hooks/useEscalas';
import { useEscalaPadrao } from '../hooks/useEscalaPadrao';
import { useActiveLabId } from '../../../store/useAuthStore';
import { callApplyEscalaPadrao } from '../services/turnosCallables';
import { toast } from '../../../shared/store/useToastStore';
import { EscalaCalendar } from './EscalaCalendar';
import { EscalaPadraoPanel } from './EscalaPadraoPanel';
import { EscalaFormModal } from './EscalaFormModal';
import type { EscalaDiaria } from '../types/Escala';

const DIAS_SEMANA_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function formatDateRange(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `${fmt(start)} — ${fmt(end)}`;
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function EscalaTab() {
  const labId = useActiveLabId();
  const { escalas, loading, rangeStart, rangeEnd, weekOffset, setWeekOffset, diasSemCobertura } =
    useEscalas();
  const { padrao, loading: padraoLoading } = useEscalaPadrao();
  const [showPadraoPanel, setShowPadraoPanel] = useState(false);
  const [applyingPadrao, setApplyingPadrao] = useState(false);
  const [modalDay, setModalDay] = useState<Date | null>(null);
  const [editingEscala, setEditingEscala] = useState<EscalaDiaria | null>(null);

  const weekDays = useMemo(() => {
    const days: Date[] = [];
    const current = new Date(rangeStart);
    for (let i = 0; i < 7; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  }, [rangeStart]);

  const escalasByDay = useMemo(() => {
    const map = new Map<string, EscalaDiaria[]>();
    for (const e of escalas) {
      const key = e.data.toDate().toDateString();
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return map;
  }, [escalas]);

  const handleApplyPadrao = useCallback(async () => {
    if (!labId || !padrao || padrao.turnos.length === 0) return;
    setApplyingPadrao(true);
    try {
      const result = await callApplyEscalaPadrao({
        labId,
        weekStartISO: toISODate(rangeStart),
      });
      toast.success(`Padrão aplicado: ${result.created} registro(s) criados.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao aplicar padrão.');
    } finally {
      setApplyingPadrao(false);
    }
  }, [labId, padrao, rangeStart]);

  const handleDayClick = useCallback((day: Date, existing?: EscalaDiaria) => {
    setModalDay(day);
    setEditingEscala(existing ?? null);
  }, []);

  const closeModal = useCallback(() => {
    setModalDay(null);
    setEditingEscala(null);
  }, []);

  if (!labId) {
    return (
      <div
        className="rounded-lg p-6"
        style={{
          background: 'var(--surface-card, #11161D)',
          border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
          fontSize: '13px',
          color: 'var(--text-muted, #94A3B8)',
        }}
      >
        Selecione um laboratório para gerenciar escalas.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Week navigation */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o - 1)}
            className="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
            style={{
              border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
              color: 'var(--text-muted, #94A3B8)',
            }}
            aria-label="Semana anterior"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span
            className="min-w-[120px] text-center font-medium"
            style={{ fontSize: '13px', color: 'var(--text-body, rgba(255,255,255,0.82))' }}
          >
            {formatDateRange(rangeStart, rangeEnd)}
          </span>
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o + 1)}
            className="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
            style={{
              border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
              color: 'var(--text-muted, #94A3B8)',
            }}
            aria-label="Próxima semana"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {weekOffset !== 0 && (
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="ml-1 rounded px-2 py-1 text-xs transition-colors"
              style={{ color: 'var(--accent-400, #60A5FA)' }}
            >
              Hoje
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {padrao && padrao.turnos.length > 0 && (
            <button
              type="button"
              onClick={() => void handleApplyPadrao()}
              disabled={applyingPadrao}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors disabled:opacity-50"
              style={{
                fontSize: '12px',
                background: 'var(--accent-600, #2563EB)',
                color: '#fff',
              }}
            >
              {applyingPadrao ? 'Aplicando...' : 'Aplicar padrão'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowPadraoPanel(!showPadraoPanel)}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors"
            style={{
              fontSize: '12px',
              border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
              color: 'var(--text-muted, #94A3B8)',
            }}
          >
            {showPadraoPanel ? 'Fechar config' : 'Configurar padrão'}
          </button>
        </div>
      </div>

      {/* Escala Padrão Panel */}
      {showPadraoPanel && <EscalaPadraoPanel onClose={() => setShowPadraoPanel(false)} />}

      {/* Calendar */}
      {loading ? (
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-lg"
              style={{ background: 'var(--surface-muted, #161B23)' }}
            />
          ))}
        </div>
      ) : (
        <EscalaCalendar
          weekDays={weekDays}
          escalasByDay={escalasByDay}
          diasSemCobertura={diasSemCobertura}
          onDayClick={handleDayClick}
        />
      )}

      {/* Modal */}
      {modalDay && <EscalaFormModal day={modalDay} existing={editingEscala} onClose={closeModal} />}
    </div>
  );
}
