import { useState, useId } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../shared/services/firebase';
import { useActiveLabId } from '../../../store/useAuthStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PresencaPanelProps {
  auditoriaId: string;
  sessaoId: string;
  reuniao: 'abertura' | 'encerramento';
  onSuccess?: (totalRegistrados: number) => void;
}

interface Participante {
  id: string;
  nome: string;
  papel: Papel;
}

type Papel = 'auditor' | 'auditado' | 'observador' | 'rt' | 'gerente_qc' | 'direcao';

// ─── Constants ─────────────────────────────────────────────────────────────────

const PAPEIS_OBRIGATORIOS_ABERTURA: Papel[] = ['auditor', 'rt', 'gerente_qc', 'auditado'];
const PAPEIS_OBRIGATORIOS_ENCERRAMENTO: Papel[] = ['auditor', 'rt', 'gerente_qc', 'auditado'];

const PAPEL_LABELS: Record<Papel, string> = {
  auditor: 'Auditor',
  auditado: 'Auditado',
  observador: 'Observador',
  rt: 'Responsável Técnico',
  gerente_qc: 'Gerente de QC',
  direcao: 'Direção',
};

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2 4h12M6.5 7v4M9.5 7v4M3 4l1 9a2 2 0 002 2h4a2 2 0 002-2l1-9M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2 8.5l3.5 3.5L14 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LoaderIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className="animate-spin"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeDasharray="8 12"
      />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PresencaPanel({ auditoriaId, sessaoId, reuniao, onSuccess }: PresencaPanelProps) {
  const labId = useActiveLabId();
  const [participantes, setParticipantes] = useState<Participante[]>([
    { id: crypto.randomUUID(), nome: '', papel: 'auditor' },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const dialogId = useId();
  const headerTitleId = useId();

  // ── Validation ──────────────────────────────────────────────────────────────

  function validateParticipantes(): string | null {
    // Check for empty rows
    const emptyRows = participantes.filter((p) => !p.nome.trim());
    if (emptyRows.length > 0) {
      return 'Todos os participantes devem ter nome preenchido.';
    }

    // Check mandatory roles
    const papaisPresentos = new Set(participantes.map((p) => p.papel));
    const obrigatorios =
      reuniao === 'abertura' ? PAPEIS_OBRIGATORIOS_ABERTURA : PAPEIS_OBRIGATORIOS_ENCERRAMENTO;
    const faltantes = obrigatorios.filter((p) => !papaisPresentos.has(p));

    if (faltantes.length > 0) {
      const nomes = faltantes.map((p) => PAPEL_LABELS[p]).join(', ');
      return `Presentes obrigatórios: ${nomes}.`;
    }

    return null;
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleConfirmarEAssinar() {
    setError(null);
    setSuccess(false);

    const validationError = validateParticipantes();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!labId) {
      setError('Lab ID não disponível. Tente recarregar a página.');
      return;
    }

    setLoading(true);
    try {
      const callable = httpsCallable(functions, 'registerPresenca');
      const result = await callable({
        labId,
        auditoriaId,
        sessaoId,
        reuniao,
        participantes: participantes.map((p) => ({
          nome: p.nome.trim(),
          papel: p.papel,
        })),
      });

      const data = result.data as { ok: boolean; totalRegistrados: number; error?: string };

      if (!data.ok) {
        throw new Error(data.error || 'Erro ao registrar presença');
      }

      setSuccess(true);
      onSuccess?.(data.totalRegistrados);

      // Clear form after 2s
      setTimeout(() => {
        setParticipantes([{ id: crypto.randomUUID(), nome: '', papel: 'auditor' }]);
        setSuccess(false);
      }, 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido ao registrar presença';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleAddRow() {
    setParticipantes([...participantes, { id: crypto.randomUUID(), nome: '', papel: 'auditor' }]);
  }

  function handleRemoveRow(id: string) {
    if (participantes.length > 1) {
      setParticipantes(participantes.filter((p) => p.id !== id));
    }
  }

  function handleNomeChange(id: string, valor: string) {
    setParticipantes(participantes.map((p) => (p.id === id ? { ...p, nome: valor } : p)));
  }

  function handlePapelChange(id: string, valor: Papel) {
    setParticipantes(participantes.map((p) => (p.id === id ? { ...p, papel: valor } : p)));
  }

  // ── Formatters ──────────────────────────────────────────────────────────────

  const reuniaoLabel = reuniao === 'abertura' ? 'Abertura' : 'Encerramento';
  const agora = new Date();
  const dataHora = agora.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      ref={(el) => el?.focus()}
      tabIndex={-1}
      className="space-y-6 rounded-2xl bg-[#1a1a1e] p-6 ring-1 ring-white/10"
    >
      {/* Header */}
      <div className="space-y-1">
        <h2 id={headerTitleId} className="text-base font-semibold text-white">
          Lista de Presença — Reunião de {reuniaoLabel}
        </h2>
        <p className="text-xs text-white/50">{dataHora}</p>
      </div>

      {/* Participantes Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-3 py-2 text-left text-xs font-medium text-white/60">Nome</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-white/60">Papel</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-white/60">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {participantes.map((p) => (
              <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                {/* Nome */}
                <td className="px-3 py-3">
                  <input
                    type="text"
                    value={p.nome}
                    onChange={(e) => handleNomeChange(p.id, e.target.value)}
                    disabled={loading}
                    placeholder="Digite o nome"
                    className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/25 transition-all disabled:opacity-40"
                  />
                </td>

                {/* Papel */}
                <td className="px-3 py-3">
                  <select
                    value={p.papel}
                    onChange={(e) => handlePapelChange(p.id, e.target.value as Papel)}
                    disabled={loading}
                    className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/25 transition-all disabled:opacity-40"
                  >
                    {(Object.entries(PAPEL_LABELS) as [Papel, string][]).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>

                {/* Remove Button */}
                <td className="px-3 py-3 text-center">
                  <button
                    onClick={() => handleRemoveRow(p.id)}
                    disabled={loading || participantes.length === 1}
                    className="inline-flex items-center justify-center rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white/90 disabled:opacity-20 transition-all"
                    aria-label="Remover participante"
                  >
                    <TrashIcon />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Row Button */}
      <button
        onClick={handleAddRow}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3.5 py-2 text-xs font-medium text-white/90 hover:bg-white/15 disabled:opacity-40 transition-all"
      >
        <PlusIcon />
        Adicionar Participante
      </button>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3.5 py-2.5 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2.5 text-sm text-emerald-400 flex items-center gap-2">
          <CheckIcon />
          Presença registrada com sucesso
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={handleConfirmarEAssinar}
        disabled={loading || success}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-600 disabled:opacity-60 transition-all"
      >
        {loading && <LoaderIcon />}
        {success && <CheckIcon />}
        <span>{loading ? 'Registrando...' : success ? 'Registrado' : 'Confirmar e Assinar'}</span>
      </button>
    </div>
  );
}
