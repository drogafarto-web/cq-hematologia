/**
 * SA-15: RuleBasedAlertList — Per-rule grouping + edit link
 *
 * Displays detection rules grouped with alert counts.
 * Supports filtering by single rule with paginated alert list.
 *
 * RDC 978 5.3 + DICQ 4.4 — rule-triggered alerts with audit trail.
 */

import React, { useEffect, useState, useMemo } from 'react';
import type { JSX } from 'react';
import { onSnapshot, collection, query, orderBy, db } from '../../../shared/services/firebase';
import { useAnomalyAlerts } from '../hooks/useAnomalyAlerts';
import type { AnomalyAlert } from '../hooks/useAnomalyAlerts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DetectionRule {
  id: string;
  name: string;
  description: string;
  lastTriggered: number | null;
  alertCount: number;
}

interface RuleBasedAlertListProps {
  labId: string;
  ruleId?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RuleBasedAlertList({
  labId,
  ruleId,
}: RuleBasedAlertListProps): JSX.Element {
  const [rules, setRules] = useState<DetectionRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState<Error | null>(null);
  const [page, setPage] = useState(0);

  const ITEMS_PER_PAGE = 25;

  // Fetch detection rules
  useEffect(() => {
    if (!labId) {
      setRulesLoading(false);
      return;
    }

    const rulesRef = collection(db, `labs/${labId}/audit-detection-rules`);
    const rulesQuery = query(rulesRef, orderBy('lastTriggered', 'desc'));

    const unsubscribe = onSnapshot(
      rulesQuery,
      (snap) => {
        const loadedRules: DetectionRule[] = [];
        snap.forEach((doc) => {
          const data = doc.data();
          loadedRules.push({
            id: doc.id,
            name: data.name,
            description: data.description,
            lastTriggered: data.lastTriggered ?? null,
            alertCount: 0, // Will be populated below
          });
        });
        setRules(loadedRules);
        setRulesError(null);
        setRulesLoading(false);
      },
      (error) => {
        setRulesError(error instanceof Error ? error : new Error(String(error)));
        setRulesLoading(false);
      },
    );

    return () => unsubscribe();
  }, [labId]);

  // Fetch alerts for the specific rule or all rules (last 30 days)
  const thirtyDaysAgo = useMemo(() => {
    return Date.now() - 30 * 24 * 60 * 60 * 1000;
  }, []);

  const { alerts } = useAnomalyAlerts(labId, {
    from: thirtyDaysAgo,
  });

  // Update alert counts per rule
  const enrichedRules = useMemo(() => {
    return rules.map((rule) => {
      const count = alerts.filter((alert) => alert.scope === rule.name).length;
      return { ...rule, alertCount: count };
    });
  }, [rules, alerts]);

  // If ruleId is specified, show only that rule + paginated alerts
  if (ruleId) {
    const selectedRule = enrichedRules.find((r) => r.id === ruleId);
    const ruleAlerts = alerts.filter((a) => a.scope === selectedRule?.name);
    const paginatedAlerts = ruleAlerts.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
    const totalPages = Math.ceil(ruleAlerts.length / ITEMS_PER_PAGE);

    if (!selectedRule) {
      return <div className="text-sm text-white/60">Regra não encontrada</div>;
    }

    return (
      <div className="flex flex-col gap-6">
        {/* Rule Header */}
        <div className="border-b border-white/10 pb-6">
          <h2 className="text-lg font-semibold text-white/90 mb-2">{selectedRule.name}</h2>
          <p className="text-sm text-white/70">{selectedRule.description}</p>
          <p className="text-xs text-white/50 mt-3">
            {ruleAlerts.length} alertas nos últimos 30 dias
          </p>
        </div>

        {/* Alert List */}
        {ruleAlerts.length === 0 ? (
          <p className="text-sm text-white/60 text-center py-8">Nenhum alerta para esta regra</p>
        ) : (
          <>
            <div className="space-y-2">
              {paginatedAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/[0.08] transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/90 truncate">{alert.shortDescription}</p>
                      <p className="text-xs text-white/50 mt-1">
                        {new Date(alert.detectedAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-white/10 text-white/70 flex-shrink-0">
                      {alert.severity}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/50">
                  Página {page + 1} de {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    ← Anterior
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Próximo →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Default: show all rules list
  return (
    <div className="flex flex-col gap-4">
      {rulesError && (
        <div className="p-4 rounded-lg bg-rose-500/15 border border-rose-400/30 text-sm text-rose-200">
          Erro ao carregar regras: {rulesError.message}
        </div>
      )}

      {rulesLoading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {!rulesLoading && enrichedRules.length === 0 && (
        <div className="text-center py-8 text-sm text-white/60">
          Nenhuma regra configurada — defina sua primeira regra
        </div>
      )}

      {!rulesLoading && enrichedRules.length > 0 && (
        <div className="space-y-3">
          {enrichedRules.map((rule) => (
            <div
              key={rule.id}
              className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/[0.08] transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white/90">{rule.name}</h3>
                  <p className="text-xs text-white/60 mt-1">{rule.description}</p>
                  {rule.lastTriggered && (
                    <p className="text-xs text-white/50 mt-2">
                      Última execução: {new Date(rule.lastTriggered).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <div className="text-center">
                    <p className="text-lg font-semibold text-white/90 tabular-nums">
                      {rule.alertCount}
                    </p>
                    <p className="text-xs text-white/50">alertas</p>
                  </div>
                  <a
                    href={`/auditoria/rules/${rule.id}/edit`}
                    className="text-xs text-violet-400 hover:text-violet-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 rounded-md px-2 py-1 transition-colors"
                  >
                    Editar regra →
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
