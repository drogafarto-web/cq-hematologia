/**
 * DesignacoesList.tsx — SA-34
 *
 * Current personnel assignments by role.
 * Three cards: RT, Gerente de Qualidade, Diretor.
 * Shows validity status and certificate management.
 */

import { useEffect, useMemo, useState } from 'react';
import { useActiveLabId } from '../../../../store/useAuthStore';
import { subscribeToDesignacoes } from '../services/designacoesService';
import type { Designacao, DesignacaoType } from '../types';

interface DesignacoesListProps {}

type CargoKey = DesignacaoType;

const CARGO_LABELS: Record<CargoKey, { label: string; color: string }> = {
  'responsavel-tecnico': { label: 'Responsável Técnico', color: 'bg-purple-500/10 border-purple-500/30' },
  'gerente-qualidade': { label: 'Gerente de Qualidade', color: 'bg-emerald-500/10 border-emerald-500/30' },
  'diretor-laboratorio': { label: 'Diretor', color: 'bg-blue-500/10 border-blue-500/30' },
};

function PrintIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function getValidityStatus(expiryDate: number | null): {
  status: 'active' | 'expiring' | 'expired';
  label: string;
  color: string;
} {
  if (!expiryDate) return { status: 'active', label: 'Sem validade', color: 'bg-slate-500/20 text-slate-300' };

  const now = Date.now();
  const daysUntilExpiry = Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry < 0) {
    return { status: 'expired', label: 'Expirada', color: 'bg-red-500/20 text-red-300' };
  }
  if (daysUntilExpiry < 30) {
    return { status: 'expiring', label: `Expira em ${daysUntilExpiry}d`, color: 'bg-amber-500/20 text-amber-300' };
  }
  return { status: 'active', label: 'Ativa', color: 'bg-emerald-500/20 text-emerald-300' };
}

function formatDate(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('pt-BR');
}

function DesignacaoCard({
  role,
  designation,
  loading,
  onNew,
}: {
  role: CargoKey;
  designation: Designacao | null;
  loading: boolean;
  onNew: (role: CargoKey) => void;
}) {
  const roleInfo = CARGO_LABELS[role];
  const validity = designation ? getValidityStatus(designation.dataExpiracao) : null;

  return (
    <div className={`border rounded-lg p-5 ${roleInfo.color}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">
          {roleInfo.label}
        </h3>
        {designation && validity && (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${validity.color}`}>
            {validity.label}
          </span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          <div className="h-4 bg-slate-700/40 rounded animate-pulse" />
          <div className="h-4 bg-slate-700/40 rounded animate-pulse w-2/3" />
        </div>
      ) : designation ? (
        <div className="space-y-3">
          {/* Name */}
          <div>
            <p className="text-xs text-slate-400 mb-1">Designado</p>
            <p className="text-sm font-medium text-white">
              {designation.personName}
            </p>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Desde</p>
              <p className="text-xs font-mono text-slate-200">
                {formatDate(designation.dataDesignacao)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Expira</p>
              <p className="text-xs font-mono text-slate-200">
                {formatDate(designation.dataExpiracao)}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => window.print()}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium bg-white/10 hover:bg-white/20 transition-colors text-slate-300"
            >
              <PrintIcon />
              Certificado
            </button>
            <button
              onClick={() => onNew(role)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium bg-white/10 hover:bg-white/20 transition-colors text-slate-300"
            >
              <PlusIcon />
              Nova
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center py-6 text-center">
          <p className="text-xs text-slate-400 mb-3">Nenhuma designação ativa</p>
          <button
            onClick={() => onNew(role)}
            className="inline-flex items-center gap-1.5 px-3 h-7 rounded-md text-xs font-medium bg-white/10 hover:bg-white/20 transition-colors text-slate-300"
          >
            <PlusIcon />
            Criar designação
          </button>
        </div>
      )}
    </div>
  );
}

export function DesignacoesList({}: DesignacoesListProps) {
  const labId = useActiveLabId();
  const [designacoes, setDesignacoes] = useState<Designacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setLoading(false);
      setError(new Error('No active lab'));
      return;
    }
    setLoading(true);
    setError(null);
    const unsubscribe = subscribeToDesignacoes(
      labId,
      (list) => {
        setDesignacoes(list);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [labId]);

  const currentByRole = useMemo(() => {
    const map = new Map<DesignacaoType, Designacao>();
    const now = Date.now();
    for (const d of designacoes) {
      if (d.deletedAt) continue;
      if (d.dataExpiracao <= now) continue;
      const existing = map.get(d.type);
      if (!existing || existing.dataDesignacao < d.dataDesignacao) {
        map.set(d.type, d);
      }
    }
    return map;
  }, [designacoes]);

  const roles: CargoKey[] = ['responsavel-tecnico', 'gerente-qualidade', 'diretor-laboratorio'];

  const handleNewDesignacao = (role: CargoKey) => {
    // Placeholder for opening new designation form
    console.log('New designation for role:', role);
  };

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300">
        <p className="text-sm font-medium">Erro ao carregar designações</p>
        <p className="text-xs text-red-400 mt-1">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Summary */}
      <div className="flex items-center gap-4 px-4 py-3 bg-white/2 rounded-lg border border-white/5 text-xs text-slate-400">
        <span>
          Ativas: <span className="font-semibold text-slate-200">{designacoes.filter((d) => !d.deletedAt).length}</span>
        </span>
        <span className="text-white/20">·</span>
        <span>
          Vencidas:{' '}
          <span className="font-semibold text-red-400">
            {designacoes.filter((d) => !d.deletedAt && d.dataExpiracao && d.dataExpiracao < Date.now()).length}
          </span>
        </span>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {roles.map((role) => (
          <DesignacaoCard
            key={role}
            role={role}
            designation={currentByRole.get(role) || null}
            loading={loading}
            onNew={handleNewDesignacao}
          />
        ))}
      </div>

      {/* History */}
      {designacoes.filter((d) => !d.deletedAt).length > currentByRole.size && (
        <div className="pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Histórico
          </h3>
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-4 py-2">
                    Cargo
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-4 py-2">
                    Designado
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-4 py-2">
                    Desde
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-4 py-2">
                    Expirou
                  </th>
                </tr>
              </thead>
              <tbody>
                {designacoes
                  .filter((d) => !d.deletedAt && d.dataExpiracao && d.dataExpiracao < Date.now())
                  .slice(0, 5)
                  .map((d, i) => (
                    <tr key={i} className="border-t border-white/5 hover:bg-white/2 transition-colors">
                      <td className="px-4 py-2 text-slate-200 font-medium">
                        {CARGO_LABELS[d.type as CargoKey]?.label || d.type}
                      </td>
                      <td className="px-4 py-2 text-slate-400">{d.personName}</td>
                      <td className="px-4 py-2 text-slate-500 text-[10px] font-mono">
                        {formatDate(d.dataDesignacao)}
                      </td>
                      <td className="px-4 py-2 text-red-400 text-[10px] font-mono">
                        {formatDate(d.dataExpiracao)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
