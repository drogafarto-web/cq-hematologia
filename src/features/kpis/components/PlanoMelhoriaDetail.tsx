/**
 * Detalhe de plano de melhoria — ações (status/evidência via callable), nova ação (addDoc), fechar plano (callable + assinatura).
 */

import { useCallback, useMemo, useState } from 'react';

import {
  firestoreErrorMessage,
  functions,
  httpsCallable,
  Timestamp,
} from '../../../shared/services/firebase';
import { toast } from '../../../shared/store/useToastStore';
import {
  useActiveLabId,
  useIsSuperAdmin,
  useUser,
  useUserRole,
} from '../../../store/useAuthStore';
import { usePlanoMelhoria } from '../hooks/usePlanoMelhoria';
import type { AcaoMelhoria, AcaoMelhoriaStatus } from '../types/PlanoMelhoria';
import { AcaoMelhoriaForm } from './AcaoMelhoriaForm';
import {
  acaoStatusLabel,
  acaoStatusPillClass,
  planoStatusBadgeClass,
  planoStatusLabel,
} from './planoMelhoriaHelpers';

type AtualizarAcaoPayload = {
  labId: string;
  planoId: string;
  acaoId: string;
  status: AcaoMelhoriaStatus;
  evidencia?: string;
};

type FecharPlanoPayload = {
  labId: string;
  planoId: string;
  logicalSignature: { hash: string; operatorId: string; ts: Timestamp };
};

const callAtualizarAcao = httpsCallable<AtualizarAcaoPayload, { ok: true }>(
  functions,
  'atualizarAcaoMelhoria',
);

const callFecharPlano = httpsCallable<FecharPlanoPayload, { ok: true }>(functions, 'fecharPlanoMelhoria');

const ACAO_STATUS_OPTIONS: readonly { value: AcaoMelhoriaStatus; label: string }[] = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'cancelada', label: 'Cancelada' },
] as const;

function sortedStringify(data: Record<string, string | number>): string {
  const sorted = Object.keys(data)
    .sort()
    .reduce<Record<string, string | number>>((acc, key) => {
      acc[key] = data[key];
      return acc;
    }, {});
  return JSON.stringify(sorted);
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function buildFecharPlanoSignature(
  operatorId: string,
  labId: string,
  planoId: string,
): Promise<{ hash: string; operatorId: string; ts: Timestamp }> {
  const ts = Timestamp.now();
  const dataPart: Record<string, string | number> = {
    labId,
    operation: 'fechar_plano_melhoria',
    planoId,
  };
  const dataString = JSON.stringify({
    operatorId,
    ts: ts.toMillis(),
    data: sortedStringify(dataPart),
  });
  const hash = await sha256Hex(dataString);
  return { hash, operatorId, ts };
}

export interface PlanoMelhoriaDetailProps {
  readonly planoId: string;
  readonly onBack: () => void;
}

export function PlanoMelhoriaDetail({ planoId, onBack }: PlanoMelhoriaDetailProps) {
  const labId = useActiveLabId();
  const user = useUser();
  const role = useUserRole();
  const isSuperAdmin = useIsSuperAdmin();
  const { plano, acoes, loading, error } = usePlanoMelhoria(planoId);

  const [showAddForm, setShowAddForm] = useState(false);
  const [acaoUpdatingId, setAcaoUpdatingId] = useState<string | null>(null);
  const [evidenceDraftByAcao, setEvidenceDraftByAcao] = useState<Record<string, string>>({});
  const [fecharSubmitting, setFecharSubmitting] = useState(false);

  const canFecharPlano = useMemo(() => {
    if (!plano || plano.status !== 'ativo') {
      return false;
    }
    if (isSuperAdmin) {
      return true;
    }
    return role === 'admin' || role === 'owner';
  }, [isSuperAdmin, plano, role]);

  const handleStatusChange = useCallback(
    async (acao: AcaoMelhoria, next: AcaoMelhoriaStatus): Promise<void> => {
      if (!labId || next === acao.status) {
        return;
      }
      setAcaoUpdatingId(acao.id);
      try {
        await callAtualizarAcao({
          labId,
          planoId,
          acaoId: acao.id,
          status: next,
        });
        toast.success('Status da ação atualizado.');
      } catch (err: unknown) {
        toast.error(firestoreErrorMessage(err));
      } finally {
        setAcaoUpdatingId(null);
      }
    },
    [labId, planoId],
  );

  const handleSaveEvidencia = useCallback(
    async (acao: AcaoMelhoria): Promise<void> => {
      if (!labId) {
        return;
      }
      const raw = evidenceDraftByAcao[acao.id] ?? acao.evidencia ?? '';
      const trimmed = raw.trim();
      if (trimmed.length === 0) {
        toast.error('Digite um texto de evidência antes de salvar.');
        return;
      }
      setAcaoUpdatingId(acao.id);
      try {
        await callAtualizarAcao({
          labId,
          planoId,
          acaoId: acao.id,
          status: acao.status,
          evidencia: trimmed,
        });
        toast.success('Evidência registrada.');
      } catch (err: unknown) {
        toast.error(firestoreErrorMessage(err));
      } finally {
        setAcaoUpdatingId(null);
      }
    },
    [evidenceDraftByAcao, labId, planoId],
  );

  const handleFecharPlano = useCallback(async (): Promise<void> => {
    if (!labId || !plano || !user?.uid) {
      toast.error('Sessão ou laboratório inválido.');
      return;
    }
    setFecharSubmitting(true);
    try {
      const logicalSignature = await buildFecharPlanoSignature(user.uid, labId, planoId);
      await callFecharPlano({ labId, planoId, logicalSignature });
      toast.success('Plano encerrado como concluído.');
    } catch (err: unknown) {
      toast.error(firestoreErrorMessage(err));
    } finally {
      setFecharSubmitting(false);
    }
  }, [labId, plano, planoId, user?.uid]);

  if (!labId) {
    return <p className="text-sm text-white/55">Selecione um laboratório.</p>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500/60"
        >
          Voltar à lista
        </button>
      </div>

      {loading ? (
        <div className="space-y-3 rounded-xl border border-white/10 bg-[#1a1a1d] p-6">
          <div className="h-6 w-2/3 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-full animate-pulse rounded bg-white/5" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-white/5" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {firestoreErrorMessage(error)}
        </div>
      ) : !plano ? (
        <p className="text-sm text-white/55">Plano não encontrado ou removido.</p>
      ) : (
        <>
          <header className="rounded-xl border border-white/10 bg-[#1a1a1d] p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-xl font-semibold tracking-tight text-white">{plano.titulo}</h2>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums ${planoStatusBadgeClass(plano.status)}`}
              >
                {planoStatusLabel(plano.status)}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/65">{plano.descricao}</p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/40">Responsável</dt>
                <dd className="mt-0.5 text-white/90">{plano.responsavelNome}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/40">Prazo meta</dt>
                <dd className="mt-0.5 tabular-nums text-white/90">
                  {plano.prazoMeta.toDate().toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </dd>
              </div>
            </dl>
            {canFecharPlano ? (
              <div className="mt-6 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => void handleFecharPlano()}
                  disabled={fecharSubmitting}
                  className="rounded-lg border border-emerald-500/40 bg-emerald-600/20 px-4 py-2 text-sm font-semibold text-emerald-100 transition-colors hover:bg-emerald-600/30 disabled:opacity-50"
                >
                  {fecharSubmitting ? 'Encerrando…' : 'Fechar plano (concluído)'}
                </button>
                <p className="mt-2 text-xs text-white/45">
                  Apenas administradores do laboratório (ou superadmin) podem encerrar o plano com status ativo.
                </p>
              </div>
            ) : null}
          </header>

          <section className="rounded-xl border border-white/10 bg-[#1a1a1d]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-white/70">Ações</h3>
              {!showAddForm ? (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-500"
                >
                  Adicionar ação
                </button>
              ) : null}
            </div>

            {showAddForm ? (
              <div className="border-b border-white/10 p-4">
                <AcaoMelhoriaForm
                  labId={labId}
                  planoId={planoId}
                  onSuccess={() => setShowAddForm(false)}
                  onCancel={() => setShowAddForm(false)}
                />
              </div>
            ) : null}

            {acoes.length === 0 ? (
              <p className="p-4 text-sm text-white/50">Nenhuma ação cadastrada neste plano.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {acoes.map((a) => {
                  const busy = acaoUpdatingId === a.id;
                  const evidenceValue = evidenceDraftByAcao[a.id] ?? a.evidencia ?? '';
                  return (
                    <li key={a.id} className="space-y-3 px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white/90">{a.descricao}</p>
                          <p className="mt-1 text-xs text-white/45">
                            {a.responsavelNome} · prazo{' '}
                            {a.prazo.toDate().toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${acaoStatusPillClass(a.status)}`}
                          aria-hidden
                        >
                          {acaoStatusLabel(a.status)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label htmlFor={`acao-status-${a.id}`} className="sr-only">
                          Status da ação
                        </label>
                        <select
                          id={`acao-status-${a.id}`}
                          value={a.status}
                          disabled={busy}
                          onChange={(e) => {
                            const v = e.target.value as AcaoMelhoriaStatus;
                            void handleStatusChange(a, v);
                          }}
                          className="rounded-lg border border-white/10 bg-[#141417] px-2 py-1.5 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40 disabled:opacity-50"
                        >
                          {ACAO_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor={`acao-ev-${a.id}`} className="text-xs font-medium text-white/50">
                          Evidência
                        </label>
                        <textarea
                          id={`acao-ev-${a.id}`}
                          value={evidenceValue}
                          disabled={busy}
                          onChange={(e) =>
                            setEvidenceDraftByAcao((prev) => ({ ...prev, [a.id]: e.target.value }))
                          }
                          rows={2}
                          maxLength={8000}
                          className="mt-1 w-full resize-y rounded-lg border border-white/10 bg-[#141417] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40 disabled:opacity-50"
                          placeholder="Texto ou referência (máx. 8000 caracteres)."
                        />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleSaveEvidencia(a)}
                          className="mt-2 rounded-lg border border-white/15 px-3 py-1 text-xs font-medium text-white/85 transition-colors hover:bg-white/5 disabled:opacity-50"
                        >
                          Salvar evidência
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
