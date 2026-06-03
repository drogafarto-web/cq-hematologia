import { useCallback, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { toast } from '../../../shared/store/useToastStore';
import {
  callCreateEscala,
  callUpdateEscala,
  callSoftDeleteEscala,
} from '../services/turnosCallables';
import {
  PERIODO_LABEL,
  type EscalaDiaria,
  type EscalaColaborador,
  type Periodo,
} from '../types/Escala';

interface EscalaFormModalProps {
  day: Date;
  existing: EscalaDiaria | null;
  onClose: () => void;
}

const PERIODOS: Periodo[] = ['manha', 'tarde', 'noite', 'integral', 'plantao'];

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function EscalaFormModal({ day, existing, onClose }: EscalaFormModalProps) {
  const labId = useActiveLabId();
  const [periodo, setPeriodo] = useState<Periodo>(existing?.periodo ?? 'manha');
  const [colaboradores, setColaboradores] = useState<EscalaColaborador[]>(
    existing?.colaboradores ?? [],
  );
  const [rtPresente, setRtPresente] = useState(existing?.rtPresente ?? false);
  const [rtSubstitutoPresente, setRtSubstitutoPresente] = useState(
    existing?.rtSubstitutoPresente ?? false,
  );
  const [observacoes, setObservacoes] = useState(existing?.observacoes ?? '');
  const [novoNome, setNovoNome] = useState('');
  const [novoCargo, setNovoCargo] = useState('');
  const [saving, setSaving] = useState(false);

  const addColaborador = useCallback(() => {
    if (!novoNome.trim()) return;
    setColaboradores((prev) => [
      ...prev,
      { id: crypto.randomUUID(), nome: novoNome.trim(), cargo: novoCargo.trim() || 'Técnico' },
    ]);
    setNovoNome('');
    setNovoCargo('');
  }, [novoNome, novoCargo]);

  const removeColaborador = useCallback((id: string) => {
    setColaboradores((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleSave = useCallback(async () => {
    if (!labId) return;
    setSaving(true);
    try {
      if (existing) {
        await callUpdateEscala({
          labId,
          escalaId: existing.id,
          periodo,
          colaboradores,
          rtPresente,
          rtSubstitutoPresente,
          observacoes: observacoes || undefined,
        });
        toast.success('Escala atualizada.');
      } else {
        await callCreateEscala({
          labId,
          data: toISODate(day),
          periodo,
          colaboradores,
          rtPresente,
          rtSubstitutoPresente,
          observacoes: observacoes || undefined,
        });
        toast.success('Escala criada.');
      }
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar escala.');
    } finally {
      setSaving(false);
    }
  }, [
    labId,
    existing,
    day,
    periodo,
    colaboradores,
    rtPresente,
    rtSubstitutoPresente,
    observacoes,
    onClose,
  ]);

  const handleDelete = useCallback(async () => {
    if (!labId || !existing) return;
    setSaving(true);
    try {
      await callSoftDeleteEscala({ labId, escalaId: existing.id });
      toast.success('Escala removida.');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover.');
    } finally {
      setSaving(false);
    }
  }, [labId, existing, onClose]);

  const dayLabel = `${String(day.getDate()).padStart(2, '0')}/${String(day.getMonth() + 1).padStart(2, '0')}/${day.getFullYear()}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Escala ${dayLabel}`}
    >
      <div
        className="w-full max-w-md rounded-xl p-6 shadow-2xl"
        style={{
          background: 'var(--surface-card, #11161D)',
          border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
        }}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2
            className="font-semibold"
            style={{ fontSize: '14px', color: 'var(--text-strong, #fff)' }}
          >
            {existing ? 'Editar' : 'Nova'} Escala — {dayLabel}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded transition-colors"
            style={{ color: 'var(--text-faint, #64748B)' }}
            aria-label="Fechar"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Período */}
          <div>
            <label
              className="mb-1.5 block font-semibold uppercase"
              style={{
                fontSize: '10px',
                letterSpacing: '0.06em',
                color: 'var(--text-faint, #64748B)',
              }}
            >
              Período
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PERIODOS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriodo(p)}
                  className="rounded-md px-3 py-1.5 font-medium transition-colors"
                  style={{
                    fontSize: '12px',
                    background:
                      periodo === p
                        ? 'var(--accent-600, #2563EB)'
                        : 'var(--surface-muted, #161B23)',
                    color: periodo === p ? '#fff' : 'var(--text-muted, #94A3B8)',
                    border: `1px solid ${periodo === p ? 'transparent' : 'var(--border-soft, rgba(255,255,255,0.06))'}`,
                  }}
                >
                  {PERIODO_LABEL[p]}
                </button>
              ))}
            </div>
          </div>

          {/* RT toggles */}
          <div className="flex gap-4">
            <label
              className="flex items-center gap-2 cursor-pointer"
              style={{ fontSize: '12px', color: 'var(--text-body, rgba(255,255,255,0.82))' }}
            >
              <input
                type="checkbox"
                checked={rtPresente}
                onChange={(e) => setRtPresente(e.target.checked)}
                className="h-4 w-4 rounded accent-emerald-500"
              />
              RT presente
            </label>
            <label
              className="flex items-center gap-2 cursor-pointer"
              style={{ fontSize: '12px', color: 'var(--text-body, rgba(255,255,255,0.82))' }}
            >
              <input
                type="checkbox"
                checked={rtSubstitutoPresente}
                onChange={(e) => setRtSubstitutoPresente(e.target.checked)}
                className="h-4 w-4 rounded accent-emerald-500"
              />
              Substituto
            </label>
          </div>

          {/* Colaboradores */}
          <div>
            <label
              className="mb-1.5 block font-semibold uppercase"
              style={{
                fontSize: '10px',
                letterSpacing: '0.06em',
                color: 'var(--text-faint, #64748B)',
              }}
            >
              Colaboradores
            </label>
            {colaboradores.length > 0 && (
              <div className="mb-2 space-y-1">
                {colaboradores.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded px-2.5 py-1.5"
                    style={{ background: 'var(--surface-muted, #161B23)' }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-body, rgba(255,255,255,0.82))',
                      }}
                    >
                      {c.nome}{' '}
                      <span style={{ color: 'var(--text-faint, #64748B)' }}>· {c.cargo}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeColaborador(c.id)}
                      style={{ fontSize: '11px', color: 'var(--danger-500, #EF4444)' }}
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
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Nome"
                className="flex-1 rounded-md px-3 py-1.5"
                style={{
                  fontSize: '12px',
                  background: 'var(--surface-muted, #161B23)',
                  border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
                  color: 'var(--text-body, rgba(255,255,255,0.82))',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addColaborador();
                  }
                }}
              />
              <input
                type="text"
                value={novoCargo}
                onChange={(e) => setNovoCargo(e.target.value)}
                placeholder="Cargo"
                className="w-24 rounded-md px-3 py-1.5"
                style={{
                  fontSize: '12px',
                  background: 'var(--surface-muted, #161B23)',
                  border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
                  color: 'var(--text-body, rgba(255,255,255,0.82))',
                }}
              />
              <button
                type="button"
                onClick={addColaborador}
                className="rounded-md px-3 py-1.5 font-medium transition-colors"
                style={{
                  fontSize: '12px',
                  background: 'var(--surface-muted, #161B23)',
                  border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
                  color: 'var(--text-muted, #94A3B8)',
                }}
              >
                +
              </button>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label
              className="mb-1.5 block font-semibold uppercase"
              style={{
                fontSize: '10px',
                letterSpacing: '0.06em',
                color: 'var(--text-faint, #64748B)',
              }}
            >
              Observações
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-md px-3 py-2"
              style={{
                fontSize: '12px',
                background: 'var(--surface-muted, #161B23)',
                border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
                color: 'var(--text-body, rgba(255,255,255,0.82))',
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-between">
          <div>
            {existing && (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={saving}
                className="rounded-md px-3 py-1.5 font-medium transition-colors"
                style={{ fontSize: '12px', color: 'var(--danger-500, #EF4444)' }}
              >
                Remover
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 font-medium transition-colors"
              style={{
                fontSize: '12px',
                color: 'var(--text-muted, #94A3B8)',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-md px-4 py-1.5 font-medium transition-colors disabled:opacity-50"
              style={{
                fontSize: '12px',
                background: 'var(--accent-600, #2563EB)',
                color: '#fff',
              }}
            >
              {saving ? 'Salvando...' : existing ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
