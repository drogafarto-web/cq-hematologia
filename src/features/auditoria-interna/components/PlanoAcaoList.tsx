import React, { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type { PlanoAcao, PlanoAcaoStatus } from '../../sgq/types/Auditoria';

interface PlanoAcaoListProps {
  auditoriaId: string;
  labId: string;
}

async function subscribePlanosAcao(
  labId: string,
  auditoriaId: string,
  callback: (planosAcao: PlanoAcao[]) => void,
  onError?: (err: Error) => void
): Promise<Unsubscribe> {
  const auditoriaRef = doc(db, `labs/${labId}/auditorias/${auditoriaId}`);
  const snap = await getDoc(auditoriaRef);

  if (snap.exists()) {
    const data = snap.data() as any;
    const planosAcao: PlanoAcao[] = data.planosAcao || [];
    callback(planosAcao);
  }

  // Return a no-op unsubscribe since we're reading from the Auditoria document
  return () => {};
}

function getStatusBadgeClass(status: PlanoAcaoStatus, isOverdue: boolean): string {
  if (isOverdue && status !== 'fechado') {
    return 'bg-rose-500/12 text-rose-400';
  }

  switch (status) {
    case 'nao_iniciado':
      return 'bg-white/4 text-white/60';
    case 'em_execucao':
      return 'bg-violet-500/12 text-violet-400';
    case 'fechado':
      return 'bg-emerald-500/12 text-emerald-400';
    case 'vencido':
      return 'bg-rose-500/12 text-rose-400';
    default:
      return 'bg-white/4 text-white/60';
  }
}

function formatStatus(status: PlanoAcaoStatus): string {
  const statusMap: Record<PlanoAcaoStatus, string> = {
    nao_iniciado: 'Não iniciado',
    em_execucao: 'Em Execução',
    fechado: 'Fechado',
    vencido: 'Vencido',
  };
  return statusMap[status] || status;
}

function formatDateRelative(timestamp: any): string {
  if (!timestamp) return '—';

  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `Vencido há ${Math.abs(diffDays)}d`;
    }

    if (diffDays === 0) {
      return 'Vence hoje';
    }

    if (diffDays === 1) {
      return 'Vence amanhã';
    }

    if (diffDays <= 7) {
      return `Em ${diffDays}d`;
    }

    const weeks = Math.floor(diffDays / 7);
    return `Em ${weeks}s`;
  } catch {
    return '—';
  }
}

function formatDateAbsolute(timestamp: any): string {
  if (!timestamp) return '—';

  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('pt-BR');
  } catch {
    return '—';
  }
}

function truncateText(text: string, maxLength: number = 80): string {
  if (text.length > maxLength) {
    return text.substring(0, maxLength) + '…';
  }
  return text;
}

export function PlanoAcaoList({ auditoriaId, labId }: PlanoAcaoListProps) {
  const [planosAcao, setPlanosAcao] = useState<PlanoAcao[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const setupSubscription = async () => {
      try {
        await subscribePlanosAcao(
          labId,
          auditoriaId,
          (planos) => {
            // Sort by prazo descending
            const sorted = [...planos].sort(
              (a, b) =>
                (b.prazo?.toDate?.().getTime() ?? 0) -
                (a.prazo?.toDate?.().getTime?.() ?? 0)
            );
            setPlanosAcao(sorted);
            setIsLoading(false);
          },
          (err) => {
            console.error('Error subscribing to planos de ação:', err);
            setError('Erro ao carregar planos de ação');
            setIsLoading(false);
          }
        );
      } catch (err) {
        console.error('Error setting up subscription:', err);
        setError('Erro ao configurar subscription');
        setIsLoading(false);
      }
    };

    setupSubscription();
  }, [auditoriaId, labId]);

  if (isLoading) {
    return (
      <div className="bg-[#141417] border border-white/8 rounded-lg p-6 text-center">
        <p className="text-sm text-white/60">Carregando planos de ação...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4">
        <p className="text-sm text-rose-400">{error}</p>
      </div>
    );
  }

  if (planosAcao.length === 0) {
    return (
      <div className="bg-[#141417] border border-white/8 rounded-lg p-6 text-center">
        <p className="text-sm text-white/60">Nenhum plano de ação registrado</p>
      </div>
    );
  }

  return (
    <div className="bg-[#141417] border border-white/8 rounded-lg overflow-hidden">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8 bg-white/[0.02]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-white/70 whitespace-nowrap">
                Descrição
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white/70 whitespace-nowrap">
                Responsável
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white/70 whitespace-nowrap">
                Prazo
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white/70 whitespace-nowrap">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {planosAcao.map((plano) => {
              const isOverdue =
                plano.prazo &&
                plano.prazo.toDate() < new Date() &&
                plano.status !== 'fechado';

              return (
                <tr
                  key={`${plano.achadoId}-${plano.criadoEm?.toDate?.().getTime()}`}
                  className="border-b border-white/4 hover:bg-white/[0.02] transition-colors"
                >
                  {/* Descrição */}
                  <td className="px-4 py-3 text-white/90">
                    <span title={plano.descricao}>
                      {truncateText(plano.descricao, 80)}
                    </span>
                  </td>

                  {/* Responsável */}
                  <td className="px-4 py-3 text-white/70">
                    <span className="text-xs">{plano.responsavel}</span>
                  </td>

                  {/* Prazo */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-white/90 text-xs font-medium">
                        {formatDateRelative(plano.prazo)}
                      </span>
                      <span className="text-white/50 text-xs">
                        {formatDateAbsolute(plano.prazo)}
                      </span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusBadgeClass(
                        plano.status,
                        isOverdue
                      )}`}
                    >
                      {isOverdue ? 'Vencido' : formatStatus(plano.status)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer stats */}
      <div className="border-t border-white/8 bg-white/[0.02] px-4 py-3 flex gap-6 text-xs text-white/60">
        <div>
          <span className="font-medium text-white/90">{planosAcao.length}</span>{' '}
          total
        </div>
        <div>
          <span className="font-medium text-white/90">
            {planosAcao.filter((p) => p.status === 'fechado').length}
          </span>{' '}
          fechados
        </div>
        <div>
          <span className="font-medium text-white/90">
            {planosAcao.filter(
              (p) =>
                p.prazo && p.prazo.toDate() < new Date() && p.status !== 'fechado'
            ).length}
          </span>{' '}
          vencidos
        </div>
      </div>
    </div>
  );
}
