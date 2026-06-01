import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { useInsumosList } from '../hooks/useInsumosList';
import { useEquipamentosList } from '../hooks/useEquipamentosList';
import {
  createControlOperacional,
  listControlOperacionals,
  updateControlOperacional,
} from '../services/controlOperacionalService';
import type { ControlOperacional, ControlOperacionalInput } from '../types/ControlOperacional';
import { COAG_ANALYTES, COAG_ANALYTE_IDS } from '../../coagulacao/CoagAnalyteConfig';
import type { CoagAnalyteId } from '../../coagulacao/types/_shared_refs';

interface ControlHubProps {
  labId: string;
}

const EMPTY_MEAN: Record<CoagAnalyteId, number> = {
  atividadeProtrombinica: 0,
  rni: 0,
  ttpa: 0,
};

const EMPTY_SD: Record<CoagAnalyteId, number> = {
  atividadeProtrombinica: 0,
  rni: 0,
  ttpa: 0,
};

const EMPTY_LOW: Record<CoagAnalyteId, number> = {
  atividadeProtrombinica: 0,
  rni: 0,
  ttpa: 0,
};

const EMPTY_HIGH: Record<CoagAnalyteId, number> = {
  atividadeProtrombinica: 0,
  rni: 0,
  ttpa: 0,
};

function defaultsForLevel(nivel: 'I' | 'II') {
  const mean = { ...EMPTY_MEAN };
  const sd = { ...EMPTY_SD };
  const low = { ...EMPTY_LOW };
  const high = { ...EMPTY_HIGH };
  for (const id of COAG_ANALYTE_IDS) {
    const lv = COAG_ANALYTES[id].levels[nivel];
    mean[id] = lv.mean;
    sd[id] = lv.sd;
    low[id] = lv.low;
    high[id] = lv.high;
  }
  return { mean, sd, low, high };
}

const STATUS_BADGE: Record<ControlOperacional['status'], string> = {
  ativo: 'bg-[var(--cl-success-bg)] text-[var(--cl-success)] border-[var(--cl-success)]/30',
  pausado: 'bg-[var(--cl-accent-muted)] text-[var(--cl-accent)] border-[var(--cl-accent)]/30',
  aposentado: 'bg-[var(--cl-card-elevated)] text-[var(--cl-text-faint)] border-[var(--cl-border)]',
};

const STATUS_LABEL: Record<ControlOperacional['status'], string> = {
  ativo: 'Ativo',
  pausado: 'Pausado',
  aposentado: 'Aposentado',
};

export function ControlHub({ labId }: ControlHubProps) {
  const setCurrentView = useAppStore((s) => s.setCurrentView);
  const { insumos, loading: insumosLoading } = useInsumosList(labId);
  const { equipamentos, loading: equipamentosLoading } = useEquipamentosList(labId);

  const [controls, setControls] = useState<ControlOperacional[]>([]);
  const [loadingControls, setLoadingControls] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const fetchControls = useCallback(async () => {
    try {
      setLoadingControls(true);
      const data = await listControlOperacionals(labId);
      setControls(data);
    } catch {
      setActionMsg({ type: 'error', text: 'Erro ao carregar controles.' });
    } finally {
      setLoadingControls(false);
    }
  }, [labId]);

  useEffect(() => {
    fetchControls();
  }, [fetchControls]);

  const [nome, setNome] = useState('');
  const [nivel, setNivel] = useState<'I' | 'II'>('I');
  const [insumoId, setInsumoId] = useState('');
  const [reagenteTTPAId, setReagenteTTPAId] = useState('');
  const [equipamentoId, setEquipamentoId] = useState('');
  const [loteControle, setLoteControle] = useState('');
  const [fabricanteControle, setFabricanteControle] = useState('');
  const [validadeControle, setValidadeControle] = useState('');
  const [mean, setMean] = useState<Record<CoagAnalyteId, number>>(() => defaultsForLevel('I').mean);
  const [sdState, setSdState] = useState<Record<CoagAnalyteId, number>>(
    () => defaultsForLevel('I').sd,
  );
  const [low, setLow] = useState<Record<CoagAnalyteId, number>>(() => defaultsForLevel('I').low);
  const [high, setHigh] = useState<Record<CoagAnalyteId, number>>(() => defaultsForLevel('I').high);

  function resetForm() {
    setNome('');
    setNivel('I');
    setInsumoId('');
    setReagenteTTPAId('');
    setEquipamentoId('');
    setLoteControle('');
    setFabricanteControle('');
    setValidadeControle('');
    const d = defaultsForLevel('I');
    setMean(d.mean);
    setSdState(d.sd);
    setLow(d.low);
    setHigh(d.high);
  }

  function handleNivelChange(n: 'I' | 'II') {
    setNivel(n);
    const d = defaultsForLevel(n);
    setMean(d.mean);
    setSdState(d.sd);
    setLow(d.low);
    setHigh(d.high);
  }

  async function handleCreate() {
    if (!nome.trim()) {
      setActionMsg({ type: 'error', text: 'Nome é obrigatório.' });
      return;
    }
    setSaving(true);
    setActionMsg(null);
    try {
      const input: ControlOperacionalInput = {
        nome: nome.trim(),
        nivel,
        insumoId,
        reagenteTTPAId: reagenteTTPAId || undefined,
        equipamentoId,
        mean,
        sd: sdState,
        low,
        high,
        loteControle,
        fabricanteControle,
        validadeControle,
        status: 'ativo',
      };
      await createControlOperacional(labId, input);
      setActionMsg({ type: 'success', text: `Controle "${nome}" ativado.` });
      setShowForm(false);
      resetForm();
      await fetchControls();
    } catch {
      setActionMsg({ type: 'error', text: 'Erro ao criar controle.' });
    } finally {
      setSaving(false);
    }
  }

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<{
    loteControle: string;
    fabricanteControle: string;
    validadeControle: string;
    insumoId: string;
    reagenteTTPAId: string;
    equipamentoId: string;
    mean: Record<CoagAnalyteId, number>;
    sd: Record<CoagAnalyteId, number>;
    low: Record<CoagAnalyteId, number>;
    high: Record<CoagAnalyteId, number>;
  }>({
    loteControle: '',
    fabricanteControle: '',
    validadeControle: '',
    insumoId: '',
    reagenteTTPAId: '',
    equipamentoId: '',
    mean: { ...EMPTY_MEAN },
    sd: { ...EMPTY_SD },
    low: { ...EMPTY_LOW },
    high: { ...EMPTY_HIGH },
  });

  function startEdit(c: ControlOperacional) {
    setEditingId(c.id);
    setEditFields({
      loteControle: c.loteControle,
      fabricanteControle: c.fabricanteControle,
      validadeControle: c.validadeControle,
      insumoId: c.insumoId,
      reagenteTTPAId: c.reagenteTTPAId || '',
      equipamentoId: c.equipamentoId,
      mean: c.mean,
      sd: c.sd,
      low: c.low ?? defaultsForLevel(c.nivel).low,
      high: c.high ?? defaultsForLevel(c.nivel).high,
    });
    setActionMsg(null);
  }

  async function handleEditSave(id: string) {
    setSaving(true);
    setActionMsg(null);
    try {
      await updateControlOperacional(labId, id, {
        loteControle: editFields.loteControle,
        fabricanteControle: editFields.fabricanteControle,
        validadeControle: editFields.validadeControle,
        insumoId: editFields.insumoId,
        reagenteTTPAId: editFields.reagenteTTPAId || undefined,
        equipamentoId: editFields.equipamentoId,
        mean: editFields.mean,
        sd: editFields.sd,
        low: editFields.low,
        high: editFields.high,
      });
      setActionMsg({ type: 'success', text: 'Controle atualizado.' });
      setEditingId(null);
      await fetchControls();
    } catch {
      setActionMsg({ type: 'error', text: 'Erro ao salvar edição.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(id: string, status: ControlOperacional['status']) {
    setActionMsg(null);
    try {
      await updateControlOperacional(labId, id, { status });
      setActionMsg({ type: 'success', text: `Status alterado para "${STATUS_LABEL[status]}".` });
      await fetchControls();
    } catch {
      setActionMsg({ type: 'error', text: 'Erro ao alterar status.' });
    }
  }

  function openForm() {
    resetForm();
    setShowForm(true);
    setActionMsg(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium text-[var(--cl-text-strong)]">Lotes em uso</h2>
        <button
          type="button"
          onClick={openForm}
          className="rounded bg-[var(--cl-accent)] px-3 py-1.5 text-sm font-medium text-[var(--cl-accent-text)] hover:bg-[var(--cl-accent-hover)] sm:px-4 sm:py-2"
        >
          + Ativar controle
        </button>
      </div>

      {actionMsg && (
        <div
          className={`rounded px-3 py-2 text-sm ${
            actionMsg.type === 'success'
              ? 'bg-[var(--cl-success-bg)] text-[var(--cl-success)]'
              : 'bg-[var(--cl-danger-bg)] text-[var(--cl-danger)]'
          }`}
        >
          {actionMsg.text}
        </div>
      )}

      {showForm && (
        <div className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-card)] p-4 sm:p-6">
          <h3 className="mb-4 text-sm font-medium text-[var(--cl-text-body)]">Ativar controle</h3>
          <div className="space-y-3 sm:space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--cl-text-muted)]">
                Nome
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="ex: Controle Normal I"
                className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-3 py-2.5 text-sm text-[var(--cl-text-strong)] placeholder-[var(--cl-text-faint)] focus:border-[var(--cl-border-focus)] focus:outline-none sm:text-base"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--cl-text-muted)]">
                  Nível
                </label>
                <select
                  value={nivel}
                  onChange={(e) => handleNivelChange(e.target.value as 'I' | 'II')}
                  className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-3 py-2.5 text-sm text-[var(--cl-text-strong)] focus:border-[var(--cl-border-focus)] focus:outline-none sm:text-base"
                >
                  <option value="I">I — Normal</option>
                  <option value="II">II — Patológico</option>
                </select>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium uppercase tracking-wider text-[var(--cl-text-muted)]">
                    Reagente TP
                  </label>
                  <button
                    type="button"
                    onClick={() => setCurrentView('insumos')}
                    className="text-[10px] text-[var(--cl-accent)] hover:underline"
                  >
                    + novo lote
                  </button>
                </div>
                {insumosLoading ? (
                  <div className="py-2 text-xs text-[var(--cl-text-faint)]">Carregando...</div>
                ) : (
                  <select
                    value={insumoId}
                    onChange={(e) => setInsumoId(e.target.value)}
                    className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-3 py-2.5 text-sm text-[var(--cl-text-strong)] focus:border-[var(--cl-border-focus)] focus:outline-none sm:text-base"
                  >
                    <option value="">— selecionar —</option>
                    {insumos.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.nomeComercial} — {i.lote}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium uppercase tracking-wider text-[var(--cl-text-muted)]">
                  Reagente TTPA
                </label>
                <button
                  type="button"
                  onClick={() => setCurrentView('insumos')}
                  className="text-[10px] text-[var(--cl-accent)] hover:underline"
                >
                  + novo lote
                </button>
              </div>
              {insumosLoading ? (
                <div className="py-2 text-xs text-[var(--cl-text-faint)]">Carregando...</div>
              ) : (
                <select
                  value={reagenteTTPAId}
                  onChange={(e) => setReagenteTTPAId(e.target.value)}
                  className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-3 py-2.5 text-sm text-[var(--cl-text-strong)] focus:border-[var(--cl-border-focus)] focus:outline-none sm:text-base"
                >
                  <option value="">— selecionar —</option>
                  {insumos.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nomeComercial} — {i.lote}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium uppercase tracking-wider text-[var(--cl-text-muted)]">
                  Equipamento
                </label>
                <button
                  type="button"
                  onClick={() => setCurrentView('equipamentos')}
                  className="text-[10px] text-[var(--cl-accent)] hover:underline"
                >
                  + novo aparelho
                </button>
              </div>
              {equipamentosLoading ? (
                <div className="py-2 text-xs text-[var(--cl-text-faint)]">Carregando...</div>
              ) : (
                <select
                  value={equipamentoId}
                  onChange={(e) => setEquipamentoId(e.target.value)}
                  className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-3 py-2.5 text-sm text-[var(--cl-text-strong)] focus:border-[var(--cl-border-focus)] focus:outline-none sm:text-base"
                >
                  <option value="">— selecionar —</option>
                  {equipamentos.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.name} — {eq.modelo}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="rounded border border-[var(--cl-border)]/50 bg-[var(--cl-card-elevated)] p-3 sm:p-4">
              <p className="mb-3 text-xs text-[var(--cl-text-muted)]">
                Material de controle (soro CQ) — não confundir com o reagente
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--cl-text-muted)]">
                    Lote do soro controle
                  </label>
                  <input
                    type="text"
                    value={loteControle}
                    onChange={(e) => setLoteControle(e.target.value)}
                    placeholder="ex: TESTE-002"
                    className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-3 py-2.5 text-sm text-[var(--cl-text-strong)] placeholder-[var(--cl-text-faint)] focus:border-[var(--cl-border-focus)] focus:outline-none sm:text-base"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--cl-text-muted)]">
                    Fabricante
                  </label>
                  <input
                    type="text"
                    value={fabricanteControle}
                    onChange={(e) => setFabricanteControle(e.target.value)}
                    className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-3 py-2.5 text-sm text-[var(--cl-text-strong)] focus:border-[var(--cl-border-focus)] focus:outline-none sm:text-base"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--cl-text-muted)]">
                    Validade
                  </label>
                  <input
                    type="date"
                    value={validadeControle}
                    onChange={(e) => setValidadeControle(e.target.value)}
                    className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-3 py-2.5 text-sm text-[var(--cl-text-strong)] focus:border-[var(--cl-border-focus)] focus:outline-none sm:text-base"
                  />
                </div>
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--cl-text-muted)]">
                Valores por analito
              </h4>
              <div className="space-y-2 sm:space-y-3">
                <div className="hidden grid-cols-[1fr_72px_72px_64px_64px] items-center gap-2 pb-1 sm:grid">
                  <span />
                  <span className="text-center text-[10px] font-medium uppercase tracking-wider text-[var(--cl-text-faint)]">
                    Média
                  </span>
                  <span className="text-center text-[10px] font-medium uppercase tracking-wider text-[var(--cl-text-faint)]">
                    SD
                  </span>
                  <span className="text-center text-[10px] font-medium uppercase tracking-wider text-[var(--cl-text-faint)]">
                    Mín.
                  </span>
                  <span className="text-center text-[10px] font-medium uppercase tracking-wider text-[var(--cl-text-faint)]">
                    Máx.
                  </span>
                </div>
                {COAG_ANALYTE_IDS.map((id) => {
                  const cfg = COAG_ANALYTES[id];
                  return (
                    <div
                      key={id}
                      className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_72px_72px_64px_64px] sm:items-center sm:gap-2"
                    >
                      <span className="text-xs text-[var(--cl-text-muted)]">
                        {cfg.label}
                        {cfg.levels.I.unit ? ` (${cfg.levels.I.unit})` : ''}
                      </span>
                      <input
                        type="number"
                        step="any"
                        value={mean[id]}
                        onChange={(e) =>
                          setMean((prev) => ({ ...prev, [id]: parseFloat(e.target.value) || 0 }))
                        }
                        className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-2 py-1.5 text-right font-mono text-xs tabular-nums text-[var(--cl-text-strong)] focus:border-[var(--cl-border-focus)] focus:outline-none sm:text-sm"
                        placeholder="Mean"
                      />
                      <input
                        type="number"
                        step="any"
                        value={sdState[id]}
                        onChange={(e) =>
                          setSdState((prev) => ({ ...prev, [id]: parseFloat(e.target.value) || 0 }))
                        }
                        className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-2 py-1.5 text-right font-mono text-xs tabular-nums text-[var(--cl-text-strong)] focus:border-[var(--cl-border-focus)] focus:outline-none sm:text-sm"
                        placeholder="SD"
                      />
                      <input
                        type="number"
                        step="any"
                        value={low[id]}
                        onChange={(e) =>
                          setLow((prev) => ({ ...prev, [id]: parseFloat(e.target.value) || 0 }))
                        }
                        className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-2 py-1.5 text-right font-mono text-xs tabular-nums text-[var(--cl-text-strong)] focus:border-[var(--cl-border-focus)] focus:outline-none sm:text-sm"
                        placeholder="Mín"
                      />
                      <input
                        type="number"
                        step="any"
                        value={high[id]}
                        onChange={(e) =>
                          setHigh((prev) => ({ ...prev, [id]: parseFloat(e.target.value) || 0 }))
                        }
                        className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-2 py-1.5 text-right font-mono text-xs tabular-nums text-[var(--cl-text-strong)] focus:border-[var(--cl-border-focus)] focus:outline-none sm:text-sm"
                        placeholder="Máx"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 sm:gap-4 sm:pt-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded border border-[var(--cl-border)] px-4 py-2 text-sm text-[var(--cl-text-muted)] hover:bg-[var(--cl-card-elevated)] sm:text-base"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                className="rounded bg-[var(--cl-accent)] px-6 py-2 text-sm font-medium text-[var(--cl-accent-text)] hover:bg-[var(--cl-accent-hover)] disabled:opacity-50 sm:text-base"
              >
                {saving ? 'Ativando...' : 'Ativar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loadingControls ? (
        <div className="py-4 text-center text-sm text-[var(--cl-text-faint)]">
          Carregando controles...
        </div>
      ) : controls.length === 0 ? (
        <div className="rounded-lg border border-[var(--cl-border)] p-6 text-center text-sm text-[var(--cl-text-muted)]">
          Nenhum controle ativo. Clique em "+ Ativar controle" para começar.
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {controls.map((c) => (
            <div
              key={c.id}
              className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-card)] px-4 py-3 sm:px-6 sm:py-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <span className="truncate text-sm font-medium text-[var(--cl-text-strong)]">
                      {c.nome}
                    </span>
                    <span
                      className={`rounded border px-2 py-0.5 text-xs ${STATUS_BADGE[c.status]}`}
                    >
                      {STATUS_LABEL[c.status]}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--cl-text-muted)] sm:mt-1 sm:text-sm">
                    Nível {c.nivel} · Lote {c.loteControle || '—'} · Val.{' '}
                    {c.validadeControle || '—'}
                  </div>
                </div>
                <div className="ml-0 sm:ml-4 flex shrink-0 gap-2 sm:gap-3">
                  {editingId !== c.id && (
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="rounded border border-[var(--cl-border)] px-3 py-1.5 text-xs text-[var(--cl-text-muted)] hover:bg-[var(--cl-card-elevated)] sm:px-4 sm:py-2 sm:text-sm"
                    >
                      Editar
                    </button>
                  )}
                  {c.status !== 'ativo' && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(c.id, 'ativo')}
                      className="rounded border border-[var(--cl-success)]/30 px-3 py-1.5 text-xs text-[var(--cl-success)] hover:bg-[var(--cl-success-bg)] sm:px-4 sm:py-2 sm:text-sm"
                    >
                      Ativar
                    </button>
                  )}
                  {c.status !== 'pausado' && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(c.id, 'pausado')}
                      className="rounded border border-[var(--cl-accent)]/30 px-3 py-1.5 text-xs text-[var(--cl-accent)] hover:bg-[var(--cl-accent-muted)] sm:px-4 sm:py-2 sm:text-sm"
                    >
                      Pausar
                    </button>
                  )}
                  {c.status !== 'aposentado' && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(c.id, 'aposentado')}
                      className="rounded border border-[var(--cl-border)] px-3 py-1.5 text-xs text-[var(--cl-text-muted)] hover:bg-[var(--cl-card-elevated)] sm:px-4 sm:py-2 sm:text-sm"
                    >
                      Encerrar uso
                    </button>
                  )}
                </div>
              </div>

              {editingId === c.id && (
                <div className="mt-3 space-y-3 border-t border-[var(--cl-border)] pt-3 sm:mt-4 sm:space-y-4 sm:pt-4">
                  <div className="rounded border border-[var(--cl-border)]/50 bg-[var(--cl-card-elevated)] p-3 sm:p-4">
                    <p className="mb-2 text-xs text-[var(--cl-text-muted)]">
                      Material de controle (soro CQ)
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs text-[var(--cl-text-muted)]">
                          Lote do soro
                        </label>
                        <input
                          type="text"
                          value={editFields.loteControle}
                          onChange={(e) =>
                            setEditFields((p) => ({ ...p, loteControle: e.target.value }))
                          }
                          className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-2 py-1.5 text-sm text-[var(--cl-text-strong)] focus:border-[var(--cl-border-focus)] focus:outline-none sm:px-3 sm:py-2 sm:text-base"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-[var(--cl-text-muted)]">
                          Fabricante
                        </label>
                        <input
                          type="text"
                          value={editFields.fabricanteControle}
                          onChange={(e) =>
                            setEditFields((p) => ({ ...p, fabricanteControle: e.target.value }))
                          }
                          className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-2 py-1.5 text-sm text-[var(--cl-text-strong)] focus:border-[var(--cl-border-focus)] focus:outline-none sm:px-3 sm:py-2 sm:text-base"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-[var(--cl-text-muted)]">
                          Validade
                        </label>
                        <input
                          type="date"
                          value={editFields.validadeControle}
                          onChange={(e) =>
                            setEditFields((p) => ({ ...p, validadeControle: e.target.value }))
                          }
                          className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-2 py-1.5 text-sm text-[var(--cl-text-strong)] focus:border-[var(--cl-border-focus)] focus:outline-none sm:px-3 sm:py-2 sm:text-base"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs text-[var(--cl-text-muted)]">
                        Reagente TP
                      </label>
                      <select
                        value={editFields.insumoId}
                        onChange={(e) => setEditFields((p) => ({ ...p, insumoId: e.target.value }))}
                        className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-2 py-1.5 text-sm text-[var(--cl-text-strong)] focus:border-[var(--cl-border-focus)] focus:outline-none sm:px-3 sm:py-2 sm:text-base"
                      >
                        <option value="">— selecionar —</option>
                        {insumos.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.nomeComercial} — {i.lote}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-[var(--cl-text-muted)]">
                        Reagente TTPA
                      </label>
                      <select
                        value={editFields.reagenteTTPAId}
                        onChange={(e) =>
                          setEditFields((p) => ({ ...p, reagenteTTPAId: e.target.value }))
                        }
                        className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-2 py-1.5 text-sm text-[var(--cl-text-strong)] focus:border-[var(--cl-border-focus)] focus:outline-none sm:px-3 sm:py-2 sm:text-base"
                      >
                        <option value="">— selecionar —</option>
                        {insumos.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.nomeComercial} — {i.lote}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-[var(--cl-text-muted)]">
                        Equipamento
                      </label>
                      <select
                        value={editFields.equipamentoId}
                        onChange={(e) =>
                          setEditFields((p) => ({ ...p, equipamentoId: e.target.value }))
                        }
                        className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-2 py-1.5 text-sm text-[var(--cl-text-strong)] focus:border-[var(--cl-border-focus)] focus:outline-none sm:px-3 sm:py-2 sm:text-base"
                      >
                        <option value="">— selecionar —</option>
                        {equipamentos.map((eq) => (
                          <option key={eq.id} value={eq.id}>
                            {eq.name} — {eq.modelo}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--cl-text-muted)]">
                      Valores por analito
                    </h4>
                    <div className="space-y-2 sm:space-y-2.5">
                      <div className="hidden grid-cols-[1fr_64px_56px_56px_56px] items-center gap-1.5 pb-1 sm:grid">
                        <span />
                        <span className="text-center text-[10px] font-medium uppercase tracking-wider text-[var(--cl-text-faint)]">
                          Média
                        </span>
                        <span className="text-center text-[10px] font-medium uppercase tracking-wider text-[var(--cl-text-faint)]">
                          SD
                        </span>
                        <span className="text-center text-[10px] font-medium uppercase tracking-wider text-[var(--cl-text-faint)]">
                          Mín.
                        </span>
                        <span className="text-center text-[10px] font-medium uppercase tracking-wider text-[var(--cl-text-faint)]">
                          Máx.
                        </span>
                      </div>
                      {COAG_ANALYTE_IDS.map((id) => {
                        const cfg = COAG_ANALYTES[id];
                        return (
                          <div
                            key={id}
                            className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_64px_56px_56px_56px] sm:items-center sm:gap-1.5"
                          >
                            <span className="text-xs text-[var(--cl-text-muted)]">{cfg.label}</span>
                            <input
                              type="number"
                              step="any"
                              value={editFields.mean[id]}
                              onChange={(e) =>
                                setEditFields((p) => ({
                                  ...p,
                                  mean: { ...p.mean, [id]: parseFloat(e.target.value) || 0 },
                                }))
                              }
                              className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-1.5 py-1 text-right font-mono text-[11px] tabular-nums text-[var(--cl-text-strong)] focus:border-[var(--cl-border-focus)] focus:outline-none sm:text-xs"
                            />
                            <input
                              type="number"
                              step="any"
                              value={editFields.sd[id]}
                              onChange={(e) =>
                                setEditFields((p) => ({
                                  ...p,
                                  sd: { ...p.sd, [id]: parseFloat(e.target.value) || 0 },
                                }))
                              }
                              className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-1.5 py-1 text-right font-mono text-[11px] tabular-nums text-[var(--cl-text-strong)] focus:border-[var(--cl-border-focus)] focus:outline-none sm:text-xs"
                            />
                            <input
                              type="number"
                              step="any"
                              value={editFields.low[id]}
                              onChange={(e) =>
                                setEditFields((p) => ({
                                  ...p,
                                  low: { ...p.low, [id]: parseFloat(e.target.value) || 0 },
                                }))
                              }
                              className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-1.5 py-1 text-right font-mono text-[11px] tabular-nums text-[var(--cl-text-strong)] focus:border-[var(--cl-border-focus)] focus:outline-none sm:text-xs"
                            />
                            <input
                              type="number"
                              step="any"
                              value={editFields.high[id]}
                              onChange={(e) =>
                                setEditFields((p) => ({
                                  ...p,
                                  high: { ...p.high, [id]: parseFloat(e.target.value) || 0 },
                                }))
                              }
                              className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-1.5 py-1 text-right font-mono text-[11px] tabular-nums text-[var(--cl-text-strong)] focus:border-[var(--cl-border-focus)] focus:outline-none sm:text-xs"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded border border-[var(--cl-border)] px-3 py-1.5 text-xs text-[var(--cl-text-muted)] hover:bg-[var(--cl-card-elevated)] sm:px-4 sm:py-2 sm:text-sm"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEditSave(c.id)}
                      disabled={saving}
                      className="rounded bg-[var(--cl-accent)] px-4 py-1.5 text-xs font-medium text-[var(--cl-accent-text)] hover:bg-[var(--cl-accent-hover)] disabled:opacity-50 sm:px-6 sm:py-2 sm:text-sm"
                    >
                      {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
