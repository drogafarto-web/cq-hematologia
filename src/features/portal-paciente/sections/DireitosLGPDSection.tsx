/**
 * DireitosLGPDSection
 * LGPD rights management: data export, deletion requests, audit log
 * Integrates with Cloud Functions for server-side processing
 * WCAG AAA dark-first design
 */

import React, { useState, useEffect } from 'react';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { Skeleton } from '../components/Skeleton';

interface AuditLogEntry {
  id: string;
  action: string;
  resource: string;
  timestamp: Timestamp;
  details?: string;
}

interface DireitosLGPDSectionProps {
  labId: string;
  patientId: string;
  onRequestAccess?: () => Promise<void>;
  onRequestExport?: () => Promise<void>;
  onRequestDeletion?: () => Promise<void>;
}

export const DireitosLGPDSection: React.FC<DireitosLGPDSectionProps> = ({
  labId,
  patientId,
  onRequestAccess,
  onRequestExport,
  onRequestDeletion,
}) => {
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(true);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  // Real-time audit log listener
  useEffect(() => {
    if (!labId || !patientId) {
      setIsLoadingAudit(false);
      return;
    }

    const db = getFirestore();
    const auditRef = collection(db, `lgpd-audit/${labId}/patient-operations/${patientId}/log`);
    const q = query(auditRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const logs = snapshot.docs.map((doc) => ({
          ...(doc.data() as AuditLogEntry),
          id: doc.id,
        }));
        setAuditLog(logs);
        setIsLoadingAudit(false);
      },
      (error) => {
        console.error('Error fetching audit log:', error);
        setIsLoadingAudit(false);
      },
    );

    return () => unsubscribe();
  }, [labId, patientId]);

  const handleAction = async (action: string, callback?: () => Promise<void>) => {
    setLoading((prev) => ({ ...prev, [action]: true }));
    setMessage(null);

    try {
      if (callback) {
        await callback();
      }
      setMessage({
        type: 'success',
        text: `Solicitação de ${action} enviada com sucesso. Você receberá uma resposta em até 30 dias úteis.`,
      });
      setTimeout(() => setMessage(null), 5000);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Erro ao processar solicitação. Tente novamente.',
      });
    } finally {
      setLoading((prev) => ({ ...prev, [action]: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Cards */}
      <div className="grid gap-4">
        {/* Right 1: Access */}
        <div className="border border-white/8 rounded-lg p-4 bg-white/2 hover:bg-white/3 transition-colors">
          <h3 className="text-sm font-medium text-white/95">Direito de Acesso</h3>
          <p className="text-xs text-white/60 mt-1">
            Solicitar cópia de todos os seus dados pessoais. Você receberá um arquivo com todas as
            informações processadas.
          </p>
          <button
            onClick={() => handleAction('acesso', onRequestAccess)}
            disabled={loading['acesso']}
            className="mt-3 px-4 py-2 text-xs font-medium bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-violet-500/20"
          >
            {loading['acesso'] ? 'Processando...' : 'Solicitar Acesso'}
          </button>
        </div>

        {/* Right 2: Portability */}
        <div className="border border-white/8 rounded-lg p-4 bg-white/2 hover:bg-white/3 transition-colors">
          <h3 className="text-sm font-medium text-white/95">Direito de Portabilidade</h3>
          <p className="text-xs text-white/60 mt-1">
            Exportar seus dados em formato estruturado (XLSX, CSV). Ideal para portabilidade entre
            laboratórios.
          </p>
          <button
            onClick={() => handleAction('portabilidade', onRequestExport)}
            disabled={loading['portabilidade']}
            className="mt-3 px-4 py-2 text-xs font-medium bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-500/20"
          >
            {loading['portabilidade'] ? 'Processando...' : 'Solicitar Exportação'}
          </button>
        </div>

        {/* Right 3: Deletion */}
        <div className="border border-white/8 rounded-lg p-4 bg-white/2 hover:bg-white/3 transition-colors">
          <h3 className="text-sm font-medium text-white/95">Direito ao Esquecimento</h3>
          <p className="text-xs text-white/60 mt-1">
            Solicitar a exclusão de seus dados pessoais (soft-delete conforme legislação de
            retenção).
          </p>
          <button
            onClick={() => handleAction('esquecimento', onRequestDeletion)}
            disabled={loading['esquecimento']}
            className="mt-3 px-4 py-2 text-xs font-medium bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-red-500/20"
          >
            {loading['esquecimento'] ? 'Processando...' : 'Solicitar Exclusão'}
          </button>
        </div>
      </div>

      {/* Success/Error Message */}
      {message && (
        <div
          className={`p-4 rounded-lg border ${
            message.type === 'success'
              ? 'bg-emerald-500/12 border-emerald-500/30'
              : 'bg-red-500/12 border-red-500/30'
          }`}
        >
          <p
            className={`text-sm ${
              message.type === 'success' ? 'text-emerald-300' : 'text-red-300'
            }`}
          >
            {message.text}
          </p>
        </div>
      )}

      {/* Audit Trail */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-white/95">Histórico de Operações LGPD</h3>

        {isLoadingAudit ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : auditLog.length > 0 ? (
          <div className="space-y-2">
            {auditLog.slice(0, 10).map((entry) => (
              <button
                key={entry.id}
                onClick={() => setExpandedAction(expandedAction === entry.id ? null : entry.id)}
                className="w-full text-left p-3 border border-white/8 rounded-lg bg-white/2 hover:bg-white/3 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/95 truncate">{entry.action}</p>
                    <p className="text-xs text-white/50 mt-0.5">
                      {new Date(entry.timestamp.toDate()).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <span className="text-white/50 text-xs flex-shrink-0">
                    {expandedAction === entry.id ? '−' : '+'}
                  </span>
                </div>

                {/* Expanded details */}
                {expandedAction === entry.id && (
                  <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                    <div>
                      <p className="text-xs font-medium text-white/70">Recurso:</p>
                      <p className="text-xs text-white/60 font-mono break-all">{entry.resource}</p>
                    </div>
                    {entry.details && (
                      <div>
                        <p className="text-xs font-medium text-white/70">Detalhes:</p>
                        <p className="text-xs text-white/60">{entry.details}</p>
                      </div>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-lg border border-white/8 bg-white/2 text-center">
            <p className="text-sm text-white/60">
              Nenhuma operação LGPD registrada. Todas as suas operações aparecem aqui.
            </p>
          </div>
        )}
      </div>

      {/* LGPD Legal Notice */}
      <div className="p-4 rounded-lg bg-white/2 border border-white/8 space-y-2">
        <p className="text-xs font-medium text-white/70">Informações Legais LGPD</p>
        <ul className="text-xs text-white/60 space-y-1">
          <li>• Direitos garantidos pela Lei Geral de Proteção de Dados (LGPD)</li>
          <li>• Prazo legal para resposta: até 30 dias úteis</li>
          <li>• Soft-delete respeita prazos de retenção regulatória (RDC 978)</li>
          <li>• Data Protection Officer: dpo@lab.com</li>
        </ul>
      </div>
    </div>
  );
};
