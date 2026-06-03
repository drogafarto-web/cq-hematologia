/**
 * ManagementReviewMeeting.tsx — SA-35
 *
 * Annual management review meeting form (DICQ 4.15).
 * 15 entries: 13 auto-aggregated, 2 manual.
 * Save draft and generate PDF.
 */

import { useState, useCallback, useMemo } from 'react';
import { useManagementReview } from '../hooks/useManagementReview';

interface ManagementReviewMeetingProps {
  onSave?: (meetingId: string) => void;
}

type AggregationState = 'idle' | 'aggregating' | 'success' | 'error';

const ENTRY_TITLES = [
  'Tendências de não-conformidades',
  'Status de CAPAs',
  'Horas de treinamento',
  'Resultados de CEQ',
  'Achados de auditoria',
  'Tendências de KPIs',
  'Reclamações de clientes',
  'Fornecedores ativos',
  'Melhorias sugeridas',
  'Mudanças de pessoal',
  'Calibração de equipamentos',
  'Incidentes registrados',
  'Gestão de riscos',
  'PGRSS (manual)',
  'Lacunas de conformidade (manual)',
];

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 150ms ease-out',
      }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36M20.49 15a9 9 0 0 1-14.85 3.36" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

interface EntryData {
  entryNumber: number;
  title: string;
  source: 'auto-aggregated' | 'manual';
  data?: Record<string, any>;
  error?: string;
  notes?: string;
}

function EntryAccordion({
  entry,
  onNotesChange,
}: {
  entry: EntryData;
  onNotesChange: (notes: string) => void;
}) {
  const [open, setOpen] = useState(entry.source === 'manual');
  const isManual = entry.source === 'manual';

  return (
    <div className="border border-white/10 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between bg-white/3 hover:bg-white/5 transition-colors text-left"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <ChevronIcon open={open} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {entry.entryNumber}. {entry.title}
            </p>
            {isManual && <p className="text-xs text-slate-400 mt-0.5">Entrada manual</p>}
          </div>
        </div>
        <span
          className={`text-xs font-medium px-2 py-1 rounded whitespace-nowrap ${
            entry.error
              ? 'bg-red-500/20 text-red-300'
              : entry.source === 'manual'
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-emerald-500/20 text-emerald-300'
          }`}
        >
          {entry.error ? 'Erro' : isManual ? 'Manual' : 'Auto'}
        </span>
      </button>

      {open && (
        <div className="px-4 py-3 border-t border-white/10 space-y-3">
          {isManual ? (
            <textarea
              value={entry.notes || ''}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Informe dados para esta entrada..."
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 resize-none"
              rows={3}
            />
          ) : (
            <>
              {entry.error ? (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-300">
                  {entry.error}
                </div>
              ) : entry.data ? (
                <div className="text-xs text-slate-300 space-y-1">
                  {Object.entries(entry.data).map(([key, val]) => (
                    <div key={key} className="flex items-start gap-2">
                      <span className="text-slate-400 min-w-[120px]">{key}:</span>
                      <span className="text-white font-mono">
                        {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">Aguardando agregação...</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function ManagementReviewMeeting({ onSave }: ManagementReviewMeetingProps) {
  const { reviews, loading } = useManagementReview();
  const [aggregationState, setAggregationState] = useState<AggregationState>('idle');
  const [year, setYear] = useState(new Date().getFullYear());
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [participants, setParticipants] = useState<Record<string, boolean>>({
    RT: true,
    'quality-manager': false,
    director: false,
    supervisors: false,
  });
  const [entries, setEntries] = useState<EntryData[]>(
    ENTRY_TITLES.map((title, i) => ({
      entryNumber: i + 1,
      title,
      source: i >= 13 ? 'manual' : 'auto-aggregated',
    })),
  );
  const [decisions, setDecisions] = useState('');
  const [actions, setActions] = useState('');

  const handleAggregate = useCallback(async () => {
    setAggregationState('aggregating');
    try {
      // Placeholder: In a real implementation, call aggregateData callable
      // For now, just mark entries as awaiting data
      setAggregationState('success');
      setTimeout(() => setAggregationState('idle'), 1500);
    } catch (err) {
      setAggregationState('error');
      console.error('Aggregation error:', err);
    }
  }, []);

  const handleSave = async () => {
    // Placeholder for save logic
    const meetingId = `meeting-${Date.now()}`;
    onSave?.(meetingId);
  };

  const participantCount = Object.values(participants).filter(Boolean).length;
  const autoEntries = entries.filter((e) => e.source === 'auto-aggregated');
  const manualEntries = entries.filter((e) => e.source === 'manual');

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white">Reunião de Revisão pela Gestão</h1>

        <div className="grid grid-cols-2 gap-4">
          {/* Year */}
          <div>
            <label htmlFor="year" className="block text-xs font-medium text-slate-300 mb-2">
              Ano
            </label>
            <input
              id="year"
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              min={2020}
              max={2099}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500/50"
            />
          </div>

          {/* Date */}
          <div>
            <label htmlFor="date" className="block text-xs font-medium text-slate-300 mb-2">
              Data da reunião
            </label>
            <input
              id="date"
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500/50"
            />
          </div>
        </div>
      </div>

      {/* Participants */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Participantes</h2>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(participants).map(([role, checked]) => (
            <label key={role} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) =>
                  setParticipants((prev) => ({
                    ...prev,
                    [role]: e.target.checked,
                  }))
                }
                className="w-4 h-4 rounded border border-white/20 bg-white/5 accent-violet-500"
              />
              <span className="text-sm text-slate-300 capitalize">
                {role === 'RT'
                  ? 'Responsável Técnico'
                  : role === 'quality-manager'
                    ? 'Gerente QA'
                    : role === 'director'
                      ? 'Diretor'
                      : 'Supervisores'}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-400">{participantCount} de 4 participantes selecionados</p>
      </div>

      {/* Aggregation Button */}
      <button
        onClick={handleAggregate}
        disabled={aggregationState === 'aggregating'}
        className="inline-flex items-center justify-center gap-2 px-4 h-9 rounded-lg text-sm font-medium bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 transition-colors self-start"
      >
        <RefreshIcon />
        {aggregationState === 'aggregating' ? 'Agregando...' : 'Agregar dados'}
      </button>

      {/* Entries */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Entradas de dados ({entries.length})</h2>

        {/* Auto-Aggregated */}
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-slate-400">
            Auto-agregadas ({autoEntries.length})
          </h3>
          <div className="space-y-2">
            {autoEntries.map((entry) => (
              <EntryAccordion key={entry.entryNumber} entry={entry} onNotesChange={() => {}} />
            ))}
          </div>
        </div>

        {/* Manual */}
        <div className="space-y-2 pt-4 border-t border-white/10">
          <h3 className="text-xs font-medium text-slate-400">Manual ({manualEntries.length})</h3>
          <div className="space-y-2">
            {manualEntries.map((entry) => (
              <EntryAccordion
                key={entry.entryNumber}
                entry={entry}
                onNotesChange={(notes) => {
                  const idx = entries.findIndex((e) => e.entryNumber === entry.entryNumber);
                  if (idx >= 0) {
                    const updated = [...entries];
                    updated[idx] = { ...updated[idx], notes };
                    setEntries(updated);
                  }
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Decisions & Actions */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="decisions" className="block text-xs font-medium text-slate-300 mb-2">
            Decisões tomadas
          </label>
          <textarea
            id="decisions"
            value={decisions}
            onChange={(e) => setDecisions(e.target.value)}
            placeholder="Ex: Aprovação de novo procedimento de amostras..."
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 resize-none"
            rows={4}
          />
        </div>
        <div>
          <label htmlFor="actions" className="block text-xs font-medium text-slate-300 mb-2">
            Ações para próximo período
          </label>
          <textarea
            id="actions"
            value={actions}
            onChange={(e) => setActions(e.target.value)}
            placeholder="Ex: Implementar sistema de rastreamento de lotes..."
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 resize-none"
            rows={4}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-white/10">
        <button
          onClick={handleSave}
          className="inline-flex items-center justify-center gap-2 px-4 h-9 rounded-lg text-sm font-medium bg-white/10 border border-white/20 text-slate-300 hover:bg-white/15 transition-colors"
        >
          <SaveIcon />
          Salvar rascunho
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center justify-center gap-2 px-4 h-9 rounded-lg text-sm font-medium bg-white/10 border border-white/20 text-slate-300 hover:bg-white/15 transition-colors"
        >
          <PrintIcon />
          Gerar PDF
        </button>
      </div>
    </div>
  );
}
