/**
 * EscalaTab — Point 6
 *
 * Weekly calendar view for work schedules with RT coverage alerts.
 * 7 columns (Mon-Sun), each showing turno, colaboradores, RT badge.
 * RDC 978 Art. 122 compliance.
 *
 * Includes "Escala Padrão" (template) — define once, apply to any week.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Timestamp } from '../../../shared/services/firebase';
import { useActiveLabId } from '../../../store/useAuthStore';
import { toast } from '../../../shared/store/useToastStore';
import { useEscalas } from '../hooks/useEscalas';
import { createEscala, updateEscala, softDeleteEscala } from '../services/escalaService';
import {
  TURNO_LABEL,
  type EscalaColaborador,
  type EscalaDiaria,
  type Turno,
} from '../types/Escala';

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

// ─── Escala Padrão (template persistido em localStorage) ────────────────────

interface TurnoTemplate {
  turno: Turno;
  colaboradores: EscalaColaborador[];
  rtPresente: boolean;
  rtSubstitutoPresente: boolean;
}

interface EscalaPadrao {
  /** Dias da semana ativos (0=Seg, 1=Ter, ..., 6=Dom) */
  diasAtivos: number[];
  turnos: TurnoTemplate[];
}

const STORAGE_KEY = 'personnel_escala_padrao';

function loadEscalaPadrao(labId: string): EscalaPadrao | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${labId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveEscalaPadrao(labId: string, padrao: EscalaPadrao) {
  localStorage.setItem(`${STORAGE_KEY}_${labId}`, JSON.stringify(padrao));
}

interface EscalaFormState {
  turno: Turno;
  colaboradores: EscalaColaborador[];
  rtPresente: boolean;
  rtSubstitutoPresente: boolean;
  observacoes: string;
  novoNome: string;
  novoCargo: string;
}

const emptyForm: EscalaFormState = {
  turno: 'integral',
  colaboradores: [],
  rtPresente: false,
  rtSubstitutoPresente: false,
  observacoes: '',
  novoNome: '',
  novoCargo: '',
};

export function EscalaTab(): React.ReactElement {
  const labId = useActiveLabId();
  const {
    escalas,
    loading,
    error,
    diasSemCobertura,
    alertasCount,
    rangeStart,
    rangeEnd,
    setWeekOffset,
  } = useEscalas();
  const [modalDay, setModalDay] = useState<Date | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EscalaFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Build week days array
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    const current = new Date(rangeStart);
    for (let i = 0; i < 7; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  }, [rangeStart]);

  // Group escalas by day
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

  const openModal = useCallback((day: Date, existing?: EscalaDiaria) => {
    setModalDay(day);
    if (existing) {
      setEditingId(existing.id);
      setForm({
        turno: existing.turno,
        colaboradores: [...existing.colaboradores],
        rtPresente: existing.rtPresente,
        rtSubstitutoPresente: existing.rtSubstitutoPresente,
        observacoes: existing.observacoes ?? '',
        novoNome: '',
        novoCargo: '',
      });
    } else {
      setEditingId(null);
      setForm(emptyForm);
    }
  }, []);

  const closeModal = useCallback(() => {
    setModalDay(null);
    setEditingId(null);
    setForm(emptyForm);
  }, []);

  const addColaborador = useCallback(() => {
    if (!form.novoNome.trim()) return;
    setForm((f) => ({
      ...f,
      colaboradores: [
        ...f.colaboradores,
        {
          id: crypto.randomUUID(),
          nome: f.novoNome.trim(),
          cargo: f.novoCargo.trim() || 'Técnico',
        },
      ],
      novoNome: '',
      novoCargo: '',
    }));
  }, [form.novoNome, form.novoCargo]);

  const removeColaborador = useCallback((id: string) => {
    setForm((f) => ({ ...f, colaboradores: f.colaboradores.filter((c) => c.id !== id) }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!labId || !modalDay) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateEscala(labId, editingId, {
          turno: form.turno,
          colaboradores: form.colaboradores,
          rtPresente: form.rtPresente,
          rtSubstitutoPresente: form.rtSubstitutoPresente,
          observacoes: form.observacoes || undefined,
        });
        toast.success('Escala atualizada.');
      } else {
        const dayTs = Timestamp.fromDate(modalDay);
        await createEscala(labId, {
          data: dayTs,
          turno: form.turno,
          colaboradores: form.colaboradores,
          rtPresente: form.rtPresente,
          rtSubstitutoPresente: form.rtSubstitutoPresente,
          observacoes: form.observacoes || undefined,
        });
        toast.success('Escala criada.');
      }
      closeModal();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar escala.');
    } finally {
      setSaving(false);
    }
  }, [labId, modalDay, editingId, form, closeModal]);

  const handleDelete = useCallback(
    async (escalaId: string) => {
      if (!labId) return;
      try {
        await softDeleteEscala(labId, escalaId);
        toast.success('Escala removida.');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erro ao remover.');
      }
    },
    [labId],
  );

  // ─── Escala Padrão ──────────────────────────────────────────────────────────

  const [showPadraoConfig, setShowPadraoConfig] = useState(false);
  const [padrao, setPadrao] = useState<EscalaPadrao | null>(() =>
    labId ? loadEscalaPadrao(labId) : null,
  );
  const [applyingPadrao, setApplyingPadrao] = useState(false);

  // Template form state
  const [padraoForm, setPadraoForm] = useState<EscalaPadrao>(
    padrao || { diasAtivos: [0, 1, 2, 3, 4], turnos: [] },
  );
  const [newTurnoForm, setNewTurnoForm] = useState<{
    turno: Turno;
    nomes: string;
    rtPresente: boolean;
    rtSub: boolean;
  }>({
    turno: 'manha',
    nomes: '',
    rtPresente: true,
    rtSub: false,
  });

  const savePadraoConfig = useCallback(() => {
    if (!labId) return;
    saveEscalaPadrao(labId, padraoForm);
    setPadrao(padraoForm);
    setShowPadraoConfig(false);
    toast.success('Escala padrão salva. Use "Aplicar padrão" para preencher a semana.');
  }, [labId, padraoForm]);

  const addTurnoToTemplate = useCallback(() => {
    if (!newTurnoForm.nomes.trim()) return;
    const colaboradores: EscalaColaborador[] = newTurnoForm.nomes
      .split(',')
      .map((n) => ({
        id: crypto.randomUUID(),
        nome: n.trim(),
        cargo: 'Técnico',
      }))
      .filter((c) => c.nome);

    setPadraoForm((p) => ({
      ...p,
      turnos: [
        ...p.turnos,
        {
          turno: newTurnoForm.turno,
          colaboradores,
          rtPresente: newTurnoForm.rtPresente,
          rtSubstitutoPresente: newTurnoForm.rtSub,
        },
      ],
    }));
    setNewTurnoForm({ turno: 'manha', nomes: '', rtPresente: true, rtSub: false });
  }, [newTurnoForm]);

  const removeTurnoFromTemplate = useCallback((idx: number) => {
    setPadraoForm((p) => ({ ...p, turnos: p.turnos.filter((_, i) => i !== idx) }));
  }, []);

  const applyPadraoToWeek = useCallback(async () => {
    if (!labId || !padrao) return;
    setApplyingPadrao(true);
    try {
      let created = 0;
      for (let i = 0; i < 7; i++) {
        if (!padrao.diasAtivos.includes(i)) continue;
        const day = new Date(rangeStart);
        day.setDate(day.getDate() + i);

        // Skip days that already have escalas
        const existing = escalasByDay.get(day.toDateString());
        if (existing && existing.length > 0) continue;

        for (const turnoTemplate of padrao.turnos) {
          await createEscala(labId, {
            data: Timestamp.fromDate(day),
            turno: turnoTemplate.turno,
            colaboradores: turnoTemplate.colaboradores,
            rtPresente: turnoTemplate.rtPresente,
            rtSubstitutoPresente: turnoTemplate.rtSubstitutoPresente,
          });
          created++;
        }
      }
      toast.success(`Escala padrão aplicada: ${created} registro(s) criados.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao aplicar padrão.');
    } finally {
      setApplyingPadrao(false);
    }
  }, [labId, padrao, rangeStart, escalasByDay]);

  if (!labId) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6 text-sm text-white/60">
        Selecione um laboratório para gerenciar escalas.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alert banner */}
      {alertasCount > 0 && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
          <p className="text-sm text-red-200">
            <span className="font-medium">
              {alertasCount} dia{alertasCount !== 1 ? 's' : ''}
            </span>{' '}
            sem cobertura RT nesta semana. RDC 978 Art. 122 exige presença de RT ou substituto.
          </p>
        </div>
      )}

      {/* Escala Padrão actions */}
      <div className="flex flex-wrap items-center gap-3">
        {padrao && padrao.turnos.length > 0 && (
          <button
            type="button"
            onClick={() => void applyPadraoToWeek()}
            disabled={applyingPadrao}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {applyingPadrao ? 'Aplicando...' : 'Aplicar padrao na semana'}
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowPadraoConfig(!showPadraoConfig)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white hover:border-white/20 transition-colors"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          {showPadraoConfig ? 'Fechar config' : 'Configurar escala padrao'}
        </button>
        {padrao && padrao.turnos.length > 0 && (
          <span className="text-[10px] text-white/30">
            Padrao: {padrao.turnos.map((t) => TURNO_LABEL[t.turno]).join(' + ')} ·{' '}
            {padrao.diasAtivos.length} dias/semana
          </span>
        )}
      </div>

      {/* Escala Padrão config panel */}
      {showPadraoConfig && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-4">
          <div>
            <h4 className="text-sm font-medium text-white/80 mb-1">Escala Padrao Semanal</h4>
            <p className="text-xs text-white/40">
              Configure uma vez. Aplique em qualquer semana com um clique.
            </p>
          </div>

          {/* Dias ativos */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-2">
              Dias de funcionamento
            </label>
            <div className="flex gap-2">
              {DIAS_SEMANA.map((dia, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() =>
                    setPadraoForm((p) => ({
                      ...p,
                      diasAtivos: p.diasAtivos.includes(idx)
                        ? p.diasAtivos.filter((d) => d !== idx)
                        : [...p.diasAtivos, idx].sort(),
                    }))
                  }
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    padraoForm.diasAtivos.includes(idx)
                      ? 'bg-violet-600 text-white'
                      : 'bg-white/5 text-white/40 hover:text-white/60'
                  }`}
                >
                  {dia}
                </button>
              ))}
            </div>
          </div>

          {/* Turnos cadastrados */}
          {padraoForm.turnos.length > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-white/50">Turnos configurados</label>
              {padraoForm.turnos.map((t, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2"
                >
                  <div>
                    <span className="text-xs font-medium text-violet-400">
                      {TURNO_LABEL[t.turno]}
                    </span>
                    <span className="text-xs text-white/40 ml-2">
                      {t.colaboradores.map((c) => c.nome).join(', ')}
                    </span>
                    {t.rtPresente && <span className="ml-2 text-[10px] text-emerald-400">RT</span>}
                    {t.rtSubstitutoPresente && (
                      <span className="ml-1 text-[10px] text-emerald-400">Sub</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTurnoFromTemplate(idx)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Adicionar turno */}
          <div className="border-t border-white/[0.06] pt-3 space-y-2">
            <label className="block text-xs font-medium text-white/50">
              Adicionar turno ao padrao
            </label>
            <div className="grid grid-cols-4 gap-2">
              <select
                value={newTurnoForm.turno}
                onChange={(e) => setNewTurnoForm((f) => ({ ...f, turno: e.target.value as Turno }))}
                className="rounded-lg border border-white/10 bg-[#141417] px-2 py-1.5 text-xs text-white"
              >
                <option value="manha">Manha</option>
                <option value="tarde">Tarde</option>
                <option value="noite">Noite</option>
                <option value="integral">Integral</option>
              </select>
              <input
                type="text"
                value={newTurnoForm.nomes}
                onChange={(e) => setNewTurnoForm((f) => ({ ...f, nomes: e.target.value }))}
                placeholder="Nomes separados por virgula"
                className="col-span-2 rounded-lg border border-white/10 bg-[#141417] px-2 py-1.5 text-xs text-white placeholder-white/20"
              />
              <button
                type="button"
                onClick={addTurnoToTemplate}
                disabled={!newTurnoForm.nomes.trim()}
                className="rounded-lg bg-violet-600 px-2 py-1.5 text-xs text-white hover:bg-violet-500 disabled:opacity-40"
              >
                + Turno
              </button>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-xs text-white/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newTurnoForm.rtPresente}
                  onChange={(e) => setNewTurnoForm((f) => ({ ...f, rtPresente: e.target.checked }))}
                  className="h-3.5 w-3.5 rounded border-white/20 bg-[#141417] text-violet-500"
                />
                RT presente
              </label>
              <label className="flex items-center gap-1.5 text-xs text-white/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newTurnoForm.rtSub}
                  onChange={(e) => setNewTurnoForm((f) => ({ ...f, rtSub: e.target.checked }))}
                  className="h-3.5 w-3.5 rounded border-white/20 bg-[#141417] text-violet-500"
                />
                RT substituto
              </label>
            </div>
          </div>

          {/* Salvar */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowPadraoConfig(false)}
              className="px-3 py-1.5 text-xs text-white/50 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={savePadraoConfig}
              disabled={padraoForm.turnos.length === 0}
              className="px-4 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-lg disabled:opacity-40"
            >
              Salvar escala padrao
            </button>
          </div>
        </div>
      )}

      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setWeekOffset((o) => o - 1)}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/5"
          aria-label="Semana anterior"
        >
          ← Anterior
        </button>
        <span className="text-sm font-medium text-white">
          {formatDate(rangeStart)} — {formatDate(rangeEnd)}
        </span>
        <button
          type="button"
          onClick={() => setWeekOffset((o) => o + 1)}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/5"
          aria-label="Próxima semana"
        >
          Próxima →
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 p-4 text-sm text-red-200">
          Erro: {error.message}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-7 gap-2">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg bg-white/5" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day, idx) => {
            const dayEscalas = escalasByDay.get(day.toDateString()) ?? [];
            const hasRT = dayEscalas.some((e) => e.rtPresente || e.rtSubstitutoPresente);
            const isToday = day.toDateString() === new Date().toDateString();

            return (
              <div
                key={idx}
                className={`rounded-lg border p-3 min-h-[160px] flex flex-col ${
                  isToday
                    ? 'border-violet-500/50 bg-violet-500/5'
                    : 'border-white/10 bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-white/60">{DIAS_SEMANA[idx]}</span>
                  <span
                    className={`text-xs ${isToday ? 'text-violet-400 font-semibold' : 'text-white/40'}`}
                  >
                    {formatDate(day)}
                  </span>
                </div>

                {/* RT badge */}
                <div className="mb-2">
                  {dayEscalas.length > 0 ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        hasRT ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${hasRT ? 'bg-emerald-500' : 'bg-red-500'}`}
                      />
                      {hasRT ? 'RT' : 'Sem RT'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/30">
                      Vazio
                    </span>
                  )}
                </div>

                {/* Escalas for this day */}
                <div className="flex-1 space-y-1 overflow-y-auto">
                  {dayEscalas.map((e) => (
                    <div
                      key={e.id}
                      className="rounded bg-white/5 px-2 py-1 cursor-pointer hover:bg-white/10 transition-colors"
                      onClick={() => openModal(day, e)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(ev) => ev.key === 'Enter' && openModal(day, e)}
                    >
                      <span className="text-[10px] text-violet-400 font-medium">
                        {TURNO_LABEL[e.turno]}
                      </span>
                      <div className="text-[10px] text-white/50 truncate">
                        {e.colaboradores.map((c) => c.nome).join(', ') || '—'}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add button */}
                <button
                  type="button"
                  onClick={() => openModal(day)}
                  className="mt-2 w-full rounded border border-dashed border-white/10 py-1 text-[10px] text-white/40 transition-colors hover:border-violet-500/50 hover:text-violet-400"
                >
                  + Adicionar
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalDay && (
        <EscalaModal
          day={modalDay}
          form={form}
          setForm={setForm}
          editing={!!editingId}
          saving={saving}
          onSave={handleSave}
          onClose={closeModal}
          onDelete={editingId ? () => void handleDelete(editingId) : undefined}
          onAddColaborador={addColaborador}
          onRemoveColaborador={removeColaborador}
        />
      )}
    </div>
  );
}

// ─── Modal ──────────────────────────────────────────────────────────────────

interface EscalaModalProps {
  day: Date;
  form: EscalaFormState;
  setForm: React.Dispatch<React.SetStateAction<EscalaFormState>>;
  editing: boolean;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
  onDelete?: () => void;
  onAddColaborador: () => void;
  onRemoveColaborador: (id: string) => void;
}

function EscalaModal({
  day,
  form,
  setForm,
  editing,
  saving,
  onSave,
  onClose,
  onDelete,
  onAddColaborador,
  onRemoveColaborador,
}: EscalaModalProps): React.ReactElement {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-white/10 bg-[#1a1a1f] p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Escala para ${formatDate(day)}`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            {editing ? 'Editar' : 'Nova'} Escala —{' '}
            {day.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-white/40 hover:text-white"
            aria-label="Fechar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Turno */}
        <div>
          <label className="mb-1 block text-xs font-medium text-white/50">Turno</label>
          <select
            value={form.turno}
            onChange={(e) => setForm((f) => ({ ...f, turno: e.target.value as Turno }))}
            className="w-full rounded-lg border border-white/10 bg-[#141417] px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
          >
            {(Object.entries(TURNO_LABEL) as [Turno, string][]).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {/* RT flags */}
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
            <input
              type="checkbox"
              checked={form.rtPresente}
              onChange={(e) => setForm((f) => ({ ...f, rtPresente: e.target.checked }))}
              className="h-4 w-4 rounded border-white/20 bg-[#141417] text-violet-500 focus:ring-violet-500"
            />
            RT presente
          </label>
          <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
            <input
              type="checkbox"
              checked={form.rtSubstitutoPresente}
              onChange={(e) => setForm((f) => ({ ...f, rtSubstitutoPresente: e.target.checked }))}
              className="h-4 w-4 rounded border-white/20 bg-[#141417] text-violet-500 focus:ring-violet-500"
            />
            RT substituto
          </label>
        </div>

        {/* Colaboradores */}
        <div>
          <label className="mb-1 block text-xs font-medium text-white/50">Colaboradores</label>
          {form.colaboradores.length > 0 && (
            <div className="mb-2 space-y-1">
              {form.colaboradores.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded bg-white/5 px-2 py-1"
                >
                  <span className="text-sm text-white/80">
                    {c.nome} <span className="text-white/40">({c.cargo})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveColaborador(c.id)}
                    className="text-red-400 hover:text-red-300 text-xs"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Nome"
              value={form.novoNome}
              onChange={(e) => setForm((f) => ({ ...f, novoNome: e.target.value }))}
              className="flex-1 rounded-lg border border-white/10 bg-[#141417] px-3 py-1.5 text-sm text-white outline-none focus:border-violet-500"
            />
            <input
              type="text"
              placeholder="Cargo"
              value={form.novoCargo}
              onChange={(e) => setForm((f) => ({ ...f, novoCargo: e.target.value }))}
              className="w-28 rounded-lg border border-white/10 bg-[#141417] px-3 py-1.5 text-sm text-white outline-none focus:border-violet-500"
            />
            <button
              type="button"
              onClick={onAddColaborador}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm text-white hover:bg-violet-500"
            >
              +
            </button>
          </div>
        </div>

        {/* Observações */}
        <div>
          <label className="mb-1 block text-xs font-medium text-white/50">Observações</label>
          <textarea
            value={form.observacoes}
            onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
            rows={2}
            className="w-full rounded-lg border border-white/10 bg-[#141417] px-3 py-2 text-sm text-white outline-none resize-y focus:border-violet-500"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="text-sm text-red-400 hover:text-red-300"
            >
              Excluir
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
