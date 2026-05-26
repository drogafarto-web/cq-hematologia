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

function defaultsForLevel(nivel: 'I' | 'II') {
  const mean = { ...EMPTY_MEAN };
  const sd = { ...EMPTY_SD };
  for (const id of COAG_ANALYTE_IDS) {
    const lv = COAG_ANALYTES[id].levels[nivel];
    mean[id] = lv.mean;
    sd[id] = lv.sd;
  }
  return { mean, sd };
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
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
  const [equipamentoId, setEquipamentoId] = useState('');
  const [loteControle, setLoteControle] = useState('');
  const [fabricanteControle, setFabricanteControle] = useState('');
  const [validadeControle, setValidadeControle] = useState('');
  const [mean, setMean] = useState<Record<CoagAnalyteId, number>>(() => defaultsForLevel('I').mean);
  const [sdState, setSdState] = useState<Record<CoagAnalyteId, number>>(() => defaultsForLevel('I').sd);

  function resetForm() {
    setNome('');
    setNivel('I');
    setInsumoId('');
    setEquipamentoId('');
    setLoteControle('');
    setFabricanteControle('');
    setValidadeControle('');
    const d = defaultsForLevel('I');
    setMean(d.mean);
    setSdState(d.sd);
  }

  function handleNivelChange(n: 'I' | 'II') {
    setNivel(n);
    const d = defaultsForLevel(n);
    setMean(d.mean);
    setSdState(d.sd);
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
        equipamentoId,
        mean,
        sd: sdState,
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
          className="rounded bg-[var(--cl-accent)] px-3 py-1.5 text-sm font-medium text-[var(--cl-accent-text)] hover:bg-[var(--cl-accent-hover)]"
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
        <div className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-card)] p-4">
          <h3 className="mb-4 text-sm font-medium text-[var(--cl-text-body)]">Ativar controle</h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--cl-text-muted)]">Nome</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="ex: Controle Normal I"
                className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-3 py-2.5 text-sm text-[var(--cl-text-strong)] placeholder-[var(--cl-text-faint)] focus:border-[var(--cl-border-focus)] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--cl-text-muted)]">Nível</label>
                <select
                  value={nivel}
                  onChange={(e) => handleNivelChange(e.target.value as 'I' | 'II')}
                  className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-3 py-2.5 text-sm text-[var(--cl-text-strong)] focus:border-[var(--cl-border-focus)] focus:outline-none"
                >
                  <option value="I">I — Normal</option>
                  <option value="II">II — Patológico</option>
                </select>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium uppercase tracking-wider text-[var(--cl-text-muted)]">Insumo (reagente)</label>
                  <button type="button" onClick={() => setCurrentView('insumos')} className="text-[10px] text-[var(--cl-accent)] hover:underline">+ novo lote</button>
                </div>
                {insumosLoading ? (
                  <div className="py-2 text-xs text-[var(--cl-text-faint)]">Carregando...</div>
                ) : (
                  <select
                    value={insumoId}
                    onChange={(e) => setInsumoId(e.target.value)}
                    className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-3 py-2.5 text-sm text-[var(--cl-text-strong)] focus:border-[var(--cl-border-focus)] focus:outline-none"
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
                <label className="text-xs font-medium uppercase tracking-wider text-[var(--cl-text-muted)]">Equipamento</label>
                <button type="button" onClick={() => setCurrentView('equipamentos')} className="text-[10px] text-[var(--cl-accent)] hover:underline">+ novo aparelho</button>
              </div>
              {equipamentosLoading ? (
                <div className="py-2 text-xs text-[var(--cl-text-faint)]">Carregando...</div>
              ) : (
                <select
                  value={equipamentoId}
                  onChange={(e) => setEquipamentoId(e.target.value)}
                  className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-3 py-2.5 text-sm text-[var(--cl-text-strong)] focus:border-[var(--cl-border-focus)] focus:outline-none"
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

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--cl-text-muted)]">Lote controle</label>
                <input
                  type="text"
                  value={loteControle}
                  onChange={(e) => setLoteControle(e.target.value)}
                  className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-3 py-2.5 text-sm text-[var(--cl-text-strong)] placeholder-[var(--cl-text-faint)] focus:border-[var(--cl-border-focus)] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--cl-text-muted)]">Fabricante controle</label>
                <input
                  type="text"
                  value={fabricanteControle}
                  onChange={(e) => setFabricanteControle(e.target.value)}
                  className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-3 py-2.5 text-sm text-[var(--cl-text-strong)] placeholder-[var(--cl-text-faint)] focus:border-[var(--cl-border-focus)] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--cl-text-muted)]">Validade (YYYY-MM-DD)</label>
                <input
                  type="text"
                  value={validadeControle}
                  onChange={(e) => setValidadeControle(e.target.value)}
                  placeholder="2027-06-30"
                  className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-3 py-2.5 text-sm text-[var(--cl-text-strong)] placeholder-[var(--cl-text-faint)] focus:border-[var(--cl-border-focus)] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--cl-text-muted)]">Valores por analito (Mean / SD)</h4>
              <div className="space-y-2">
                {COAG_ANALYTE_IDS.map((id) => {
                  const cfg = COAG_ANALYTES[id];
                  return (
                    <div key={id} className="grid grid-cols-[1fr_100px_100px] items-center gap-2">
                      <span className="text-xs text-[var(--cl-text-muted)]">{cfg.label}</span>
                      <input
                        type="number"
                        step="any"
                        value={mean[id]}
                        onChange={(e) =>
                          setMean((prev) => ({ ...prev, [id]: parseFloat(e.target.value) || 0 }))
                        }
                        className="rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-2 py-1.5 text-right font-mono text-sm tabular-nums text-[var(--cl-text-strong)] focus:border-[var(--cl-border-focus)] focus:outline-none"
                        placeholder="Mean"
                      />
                      <input
                        type="number"
                        step="any"
                        value={sdState[id]}
                        onChange={(e) =>
                          setSdState((prev) => ({ ...prev, [id]: parseFloat(e.target.value) || 0 }))
                        }
                        className="rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-2 py-1.5 text-right font-mono text-sm tabular-nums text-[var(--cl-text-strong)] focus:border-[var(--cl-border-focus)] focus:outline-none"
                        placeholder="SD"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded border border-[var(--cl-border)] px-4 py-2 text-sm text-[var(--cl-text-muted)] hover:bg-[var(--cl-card-elevated)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                className="rounded bg-[var(--cl-accent)] px-6 py-2 text-sm font-medium text-[var(--cl-accent-text)] hover:bg-[var(--cl-accent-hover)] disabled:opacity-50"
              >
                {saving ? 'Ativando...' : 'Ativar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loadingControls ? (
        <div className="py-4 text-center text-sm text-[var(--cl-text-faint)]">Carregando controles...</div>
      ) : controls.length === 0 ? (
        <div className="rounded-lg border border-[var(--cl-border)] p-6 text-center text-sm text-[var(--cl-text-muted)]">
          Nenhum controle ativo. Clique em "+ Ativar controle" para começar.
        </div>
      ) : (
        <div className="space-y-2">
          {controls.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-[var(--cl-border)] bg-[var(--cl-card)] px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-[var(--cl-text-strong)]">{c.nome}</span>
                  <span
                    className={`rounded border px-2 py-0.5 text-xs ${STATUS_BADGE[c.status]}`}
                  >
                    {STATUS_LABEL[c.status]}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-[var(--cl-text-muted)]">
                  Nível {c.nivel} · Lote {c.loteControle || '—'} · Val. {c.validadeControle || '—'}
                </div>
              </div>
              <div className="ml-4 flex shrink-0 gap-2">
                {c.status !== 'ativo' && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange(c.id, 'ativo')}
                    className="rounded border border-[var(--cl-success)]/30 px-2 py-1 text-xs text-[var(--cl-success)] hover:bg-[var(--cl-success-bg)]"
                  >
                    Ativar
                  </button>
                )}
                {c.status !== 'pausado' && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange(c.id, 'pausado')}
                    className="rounded border border-[var(--cl-accent)]/30 px-2 py-1 text-xs text-[var(--cl-accent)] hover:bg-[var(--cl-accent-muted)]"
                  >
                    Pausar
                  </button>
                )}
                {c.status !== 'aposentado' && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange(c.id, 'aposentado')}
                    className="rounded border border-[var(--cl-border)] px-2 py-1 text-xs text-[var(--cl-text-muted)] hover:bg-[var(--cl-card-elevated)]"
                  >
                    Encerrar uso
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
