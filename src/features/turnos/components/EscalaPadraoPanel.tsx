import { useCallback, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { toast } from '../../../shared/store/useToastStore';
import { callSaveEscalaPadrao } from '../services/turnosCallables';
import { useEscalaPadrao } from '../hooks/useEscalaPadrao';
import {
  PERIODO_LABEL,
  type EscalaColaborador,
  type EscalaPadraoTurno,
  type Periodo,
} from '../types/Escala';

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const PERIODOS: Periodo[] = ['manha', 'tarde', 'noite', 'integral', 'plantao'];

interface EscalaPadraoPanelProps {
  onClose: () => void;
}

export function EscalaPadraoPanel({ onClose }: EscalaPadraoPanelProps) {
  const labId = useActiveLabId();
  const { padrao } = useEscalaPadrao();

  const [diasAtivos, setDiasAtivos] = useState<number[]>(padrao?.diasAtivos ?? [0, 1, 2, 3, 4]);
  const [turnos, setTurnos] = useState<EscalaPadraoTurno[]>(padrao?.turnos ?? []);
  const [saving, setSaving] = useState(false);

  // New turno form
  const [newPeriodo, setNewPeriodo] = useState<Periodo>('manha');
  const [newNomes, setNewNomes] = useState('');
  const [newRt, setNewRt] = useState(true);
  const [newSub, setNewSub] = useState(false);

  const toggleDia = useCallback((idx: number) => {
    setDiasAtivos((prev) =>
      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort(),
    );
  }, []);

  const addTurno = useCallback(() => {
    if (!newNomes.trim()) return;
    const colaboradores: EscalaColaborador[] = newNomes
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)
      .map((nome) => ({ id: crypto.randomUUID(), nome, cargo: 'Técnico' }));

    setTurnos((prev) => [
      ...prev,
      { periodo: newPeriodo, colaboradores, rtPresente: newRt, rtSubstitutoPresente: newSub },
    ]);
    setNewNomes('');
    setNewRt(true);
    setNewSub(false);
  }, [newPeriodo, newNomes, newRt, newSub]);

  const removeTurno = useCallback((idx: number) => {
    setTurnos((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleSave = useCallback(async () => {
    if (!labId) return;
    setSaving(true);
    try {
      await callSaveEscalaPadrao({ labId, diasAtivos, turnos });
      toast.success('Escala padrão salva.');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar padrão.');
    } finally {
      setSaving(false);
    }
  }, [labId, diasAtivos, turnos, onClose]);

  return (
    <div
      className="rounded-xl p-5 space-y-4"
      style={{
        background: 'var(--surface-card, #11161D)',
        border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3
            className="font-semibold"
            style={{ fontSize: '14px', color: 'var(--text-strong, #fff)' }}
          >
            Escala Padrão Semanal
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted, #94A3B8)' }}>
            Configure uma vez. Aplique em qualquer semana com um clique.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{ fontSize: '12px', color: 'var(--text-faint, #64748B)' }}
        >
          Fechar
        </button>
      </div>

      {/* Dias ativos */}
      <div>
        <label
          className="mb-2 block font-semibold uppercase"
          style={{ fontSize: '10px', letterSpacing: '0.06em', color: 'var(--text-faint, #64748B)' }}
        >
          Dias de funcionamento
        </label>
        <div className="flex gap-1.5">
          {DIAS_SEMANA.map((dia, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => toggleDia(idx)}
              className="rounded-md px-2.5 py-1.5 font-medium transition-colors"
              style={{
                fontSize: '12px',
                background: diasAtivos.includes(idx)
                  ? 'var(--accent-600, #2563EB)'
                  : 'var(--surface-muted, #161B23)',
                color: diasAtivos.includes(idx) ? '#fff' : 'var(--text-faint, #64748B)',
                border: `1px solid ${diasAtivos.includes(idx) ? 'transparent' : 'var(--border-soft, rgba(255,255,255,0.06))'}`,
              }}
            >
              {dia}
            </button>
          ))}
        </div>
      </div>

      {/* Turnos configurados */}
      {turnos.length > 0 && (
        <div className="space-y-1.5">
          <label
            className="block font-semibold uppercase"
            style={{
              fontSize: '10px',
              letterSpacing: '0.06em',
              color: 'var(--text-faint, #64748B)',
            }}
          >
            Turnos configurados
          </label>
          {turnos.map((t, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded-lg px-3 py-2"
              style={{ background: 'var(--surface-muted, #161B23)' }}
            >
              <div className="flex items-center gap-2">
                <span
                  style={{ fontSize: '12px', fontWeight: 500, color: 'var(--accent-400, #60A5FA)' }}
                >
                  {PERIODO_LABEL[t.periodo]}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted, #94A3B8)' }}>
                  {t.colaboradores.map((c) => c.nome).join(', ')}
                </span>
                {t.rtPresente && (
                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: 600,
                      color: 'var(--success-500, #10B981)',
                    }}
                  >
                    RT
                  </span>
                )}
                {t.rtSubstitutoPresente && (
                  <span style={{ fontSize: '9px', fontWeight: 600, color: 'rgba(16,185,129,0.7)' }}>
                    Sub
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeTurno(idx)}
                style={{ fontSize: '11px', color: 'var(--danger-500, #EF4444)' }}
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Adicionar turno */}
      <div
        className="space-y-2 pt-3"
        style={{ borderTop: '1px solid var(--border-hairline, rgba(255,255,255,0.04))' }}
      >
        <label
          className="block font-semibold uppercase"
          style={{ fontSize: '10px', letterSpacing: '0.06em', color: 'var(--text-faint, #64748B)' }}
        >
          Adicionar turno ao padrão
        </label>
        <div className="flex flex-wrap gap-2">
          <select
            value={newPeriodo}
            onChange={(e) => setNewPeriodo(e.target.value as Periodo)}
            className="rounded-md px-2.5 py-1.5"
            style={{
              fontSize: '12px',
              background: 'var(--surface-muted, #161B23)',
              border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
              color: 'var(--text-body, rgba(255,255,255,0.82))',
            }}
          >
            {PERIODOS.map((p) => (
              <option key={p} value={p}>
                {PERIODO_LABEL[p]}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newNomes}
            onChange={(e) => setNewNomes(e.target.value)}
            placeholder="Nomes (separados por vírgula)"
            className="flex-1 min-w-[180px] rounded-md px-3 py-1.5"
            style={{
              fontSize: '12px',
              background: 'var(--surface-muted, #161B23)',
              border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
              color: 'var(--text-body, rgba(255,255,255,0.82))',
            }}
          />
          <label
            className="flex items-center gap-1 cursor-pointer"
            style={{ fontSize: '11px', color: 'var(--text-muted, #94A3B8)' }}
          >
            <input
              type="checkbox"
              checked={newRt}
              onChange={(e) => setNewRt(e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-emerald-500"
            />
            RT
          </label>
          <label
            className="flex items-center gap-1 cursor-pointer"
            style={{ fontSize: '11px', color: 'var(--text-muted, #94A3B8)' }}
          >
            <input
              type="checkbox"
              checked={newSub}
              onChange={(e) => setNewSub(e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-emerald-500"
            />
            Sub
          </label>
          <button
            type="button"
            onClick={addTurno}
            className="rounded-md px-3 py-1.5 font-medium transition-colors"
            style={{
              fontSize: '12px',
              background: 'var(--surface-muted, #161B23)',
              border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
              color: 'var(--text-muted, #94A3B8)',
            }}
          >
            + Turno
          </button>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || turnos.length === 0}
          className="rounded-md px-4 py-1.5 font-medium transition-colors disabled:opacity-50"
          style={{
            fontSize: '12px',
            background: 'var(--accent-600, #2563EB)',
            color: '#fff',
          }}
        >
          {saving ? 'Salvando...' : 'Salvar padrão'}
        </button>
      </div>
    </div>
  );
}
