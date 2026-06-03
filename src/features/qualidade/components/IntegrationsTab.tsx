/**
 * IntegrationsTab.tsx
 *
 * Shows integrations between Auditoria Avançada and other modules:
 * - NCs generated from anomalies
 * - CAPAs linked to alerts
 * - Suggested focused audits based on anomaly concentration
 *
 * Phase 7 Wave 7 — Advanced Auditoria
 * RDC 978 Art. 107 + DICQ 4.4
 */

import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type { LabId } from '../types/shared_refs';

interface IntegrationsTabProps {
  labId: LabId;
}

interface LinkedNC {
  id: string;
  numero: string;
  titulo: string;
  severidade: string;
  status: string;
  criadoEm: number;
}

interface AnomalyConcentration {
  moduleId: string;
  count: number;
  lastDetected: number;
}

export function IntegrationsTab({ labId }: IntegrationsTabProps) {
  const [linkedNCs, setLinkedNCs] = useState<LinkedNC[]>([]);
  const [concentrations, setConcentrations] = useState<AnomalyConcentration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to NCs originated from auditoria-avancada
  useEffect(() => {
    if (!labId) return;

    setLoading(true);
    setError(null);

    const ncRef = collection(db, 'labs', labId, 'naoConformidades');
    const ncQuery = query(
      ncRef,
      where('origem', '==', 'auditoria-avancada'),
      where('deletadoEm', '==', null),
      orderBy('criadoEm', 'desc'),
      limit(20),
    );

    const unsubscribe = onSnapshot(
      ncQuery,
      (snap) => {
        const ncs: LinkedNC[] = [];
        snap.forEach((doc) => {
          const data = doc.data();
          ncs.push({
            id: doc.id,
            numero: data.numero || '—',
            titulo: data.titulo || 'Sem título',
            severidade: data.severidade || 'grave',
            status: data.status || 'aberta',
            criadoEm: data.criadoEm?.toMillis?.() || Date.now(),
          });
        });
        setLinkedNCs(ncs);
        setLoading(false);
      },
      (err) => {
        console.error('[IntegrationsTab] NC subscription error', err);
        setError(err.message || 'Erro ao carregar NCs vinculadas');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [labId]);

  // Compute anomaly concentrations from alerts
  useEffect(() => {
    if (!labId) return;

    const alertsRef = collection(db, 'labs', labId, 'audit-alerts');
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const alertsQuery = query(
      alertsRef,
      where('status', '==', 'active'),
      where('createdAt', '>=', thirtyDaysAgo),
      orderBy('createdAt', 'desc'),
      limit(100),
    );

    const unsubscribe = onSnapshot(
      alertsQuery,
      (snap) => {
        const moduleCounts: Record<string, { count: number; lastDetected: number }> = {};
        snap.forEach((doc) => {
          const data = doc.data();
          const entryId = data.anomalyScore?.entryId || 'unknown';
          const moduleId = entryId.split('-')[0] || 'geral';
          if (!moduleCounts[moduleId]) {
            moduleCounts[moduleId] = { count: 0, lastDetected: 0 };
          }
          moduleCounts[moduleId].count++;
          moduleCounts[moduleId].lastDetected = Math.max(
            moduleCounts[moduleId].lastDetected,
            data.createdAt || 0,
          );
        });

        const sorted = Object.entries(moduleCounts)
          .map(([moduleId, { count, lastDetected }]) => ({ moduleId, count, lastDetected }))
          .filter((c) => c.count >= 3)
          .sort((a, b) => b.count - a.count);

        setConcentrations(sorted);
      },
      () => {},
    );

    return () => unsubscribe();
  }, [labId]);

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'critica':
        return 'bg-red-600/20 text-red-400 border-red-600/50';
      case 'grave':
        return 'bg-orange-600/20 text-orange-400 border-orange-600/50';
      default:
        return 'bg-yellow-600/20 text-yellow-400 border-yellow-600/50';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      aberta: 'Aberta',
      investigacao: 'Investigação',
      correcao: 'Correção',
      verificacao: 'Verificação',
      fechada: 'Fechada',
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#141417] rounded-xl border border-slate-200 dark:border-white/[0.08] p-12 text-center">
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
          <p className="text-sm text-slate-600 dark:text-white/60">Carregando integrações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Anomaly Concentration Suggestions */}
      {concentrations.length > 0 && (
        <div className="bg-white dark:bg-[#141417] rounded-xl border border-amber-500/30 dark:border-amber-500/20 p-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
            Sugestão de Auditoria Focada
          </h3>
          <p className="text-xs text-slate-500 dark:text-white/40 mb-4">
            Módulos com concentração de anomalias nos últimos 30 dias
          </p>
          <div className="space-y-3">
            {concentrations.map((c) => (
              <div
                key={c.moduleId}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white capitalize">
                    {c.moduleId}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-white/40">
                    {c.count} anomalias — última em{' '}
                    {new Date(c.lastDetected).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <button
                  className="px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/30 text-violet-400 text-xs font-medium hover:bg-violet-500/20 transition-colors"
                  aria-label={`Sugerir auditoria focada em ${c.moduleId}`}
                >
                  Sugerir Auditoria
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Linked NCs */}
      <div className="bg-white dark:bg-[#141417] rounded-xl border border-slate-200 dark:border-white/[0.08] p-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
          Não Conformidades Geradas
        </h3>
        <p className="text-xs text-slate-500 dark:text-white/40 mb-4">
          NCs criadas automaticamente a partir de investigações de anomalias
        </p>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 mb-4" role="alert">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {linkedNCs.length === 0 ? (
          <div className="rounded-lg border border-slate-200 dark:border-white/10 p-8 text-center">
            <p className="text-sm text-slate-500 dark:text-white/50">
              Nenhuma NC gerada a partir de anomalias
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {linkedNCs.map((nc) => (
              <div
                key={nc.id}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {nc.numero}
                    </p>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${getSeverityBadge(nc.severidade)}`}
                    >
                      {nc.severidade}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5 truncate">
                    {nc.titulo}
                  </p>
                </div>
                <span className="text-xs text-slate-500 dark:text-white/40 ml-4 whitespace-nowrap">
                  {getStatusLabel(nc.status)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
