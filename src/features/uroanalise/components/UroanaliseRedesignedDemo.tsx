import React, { useCallback, useMemo, useState } from 'react';
import { useUroLots } from '../hooks/useUroLots';
import { useUroRuns } from '../hooks/useUroRuns';
import { useSaveUroRun } from '../hooks/useSaveUroRun';
import { useUroOcrSetting } from '../hooks/useUroOcrSetting';
import {
  useActiveLab,
  useActiveLabId,
  useIsSuperAdmin,
  useUser,
  useUserRole,
} from '../../../store/useAuthStore';
import {
  vincularUroLot,
  desvincularUroLot,
  updateUroLotDecision,
} from '../services/uroanaliseFirebaseService';
import { toast } from '../../../shared/store/useToastStore';
import { db, doc, getDoc } from '../../../shared/services/firebase';
import { UroanaliseRedesignedShell } from './UroanaliseRedesignedShell';
import { NovaRunModal, RunDetailModal, QRModal } from './UroanaliseContent';
import { NovoLoteModal } from '../../insumos/components/NovoLoteModal';
import { daysToExpiry } from './UroanaliseForm.schema';
import type { UroanaliseFormData } from './UroanaliseForm.schema';
import type { UroLotSidebarItem } from './UroLotSidebar';
import type { UroAuditRow } from './UroAuditTable';
import type { UroAuditEvent } from './UroAuditTrailDrawer';
import type { UroComplianceItem } from './UroComplianceChecklist';
import { URO_COMPLIANCE_REFERENCES } from './UroComplianceChecklist';
import type { UroanaliseLot, UroanaliseRun } from '../types/Uroanalise';
import type { UroStatus } from '../types/_shared_refs';

// ─── Adapters ────────────────────────────────────────────────────────────────

function lotToSidebarItem(lot: UroanaliseLot): UroLotSidebarItem {
  return {
    id: lot.id,
    nivel: lot.nivel,
    loteControle: lot.loteControle,
    fabricanteControle: lot.fabricanteControle,
    validadeControle: lot.validadeControle,
    status: lot.lotStatus,
    runCount: lot.runCount,
    pinned: Boolean(lot.setupType),
    setupType: lot.setupType ?? null,
    lastRunAt: lot.pinnedAt
      ? typeof lot.pinnedAt === 'object' && 'toMillis' in lot.pinnedAt
        ? (lot.pinnedAt as { toMillis: () => number }).toMillis()
        : undefined
      : undefined,
  };
}

function runToAuditRow(run: UroanaliseRun): UroAuditRow {
  const signed = Boolean(run.logicalSignature);
  const ts = run.dataRealizacao ? new Date(run.dataRealizacao).getTime() : undefined;
  return {
    id: run.id,
    runCode: run.runCode,
    dataRealizacao: run.dataRealizacao,
    operatorName: run.operatorName ?? run.responsavel ?? 'Operador',
    conformidade: run.conformidade,
    desviosCount: run.analitosNaoConformes?.length ?? 0,
    signed,
    signedBy: signed ? run.operatorName ?? undefined : undefined,
    signedAt: ts,
    hasNotivisaPending: run.notivisaStatus === 'pendente' && (run.analitosNaoConformes?.length ?? 0) > 0,
  };
}

function buildComplianceItems(lot: UroanaliseLot | undefined): UroComplianceItem[] {
  if (!lot) return [];
  const items: UroComplianceItem[] = [];

  const days = daysToExpiry(lot.validadeControle);
  items.push({
    id: 'validade-controle',
    requirement: 'Material de controle dentro da validade.',
    reference: URO_COMPLIANCE_REFERENCES.validadeControle,
    status: days < 0 ? 'fail' : days < 30 ? 'warn' : 'pass',
    evidence:
      days < 0
        ? `Validade: ${lot.validadeControle} (vencido há ${Math.abs(days)}d)`
        : days < 30
          ? `Validade: ${lot.validadeControle} (em ${days}d)`
          : `Validade: ${lot.validadeControle}`,
    remediation: days < 0 ? 'Substituir o lote de controle imediatamente.' : undefined,
  });

  items.push({
    id: 'decisao-rt',
    requirement: 'Decisão formal do Responsável Técnico registrada.',
    reference: URO_COMPLIANCE_REFERENCES.assinaturaRT,
    status: lot.uroDecision ? (lot.uroDecision === 'A' ? 'pass' : 'fail') : 'pending',
    evidence: lot.uroDecision
      ? `Decisão: ${lot.uroDecision === 'A' ? 'Aceitável' : lot.uroDecision === 'NA' ? 'Não aceitável' : 'Rejeitado'}`
      : 'Aguardando assinatura do RT.',
    remediation:
      !lot.uroDecision
        ? 'RT deve revisar as corridas e registrar decisão formal.'
        : undefined,
  });

  items.push({
    id: 'rastreabilidade',
    requirement: 'Rastreabilidade de lote e fabricante do controle.',
    reference: URO_COMPLIANCE_REFERENCES.rastreabilidade,
    status: lot.loteControle && lot.fabricanteControle ? 'pass' : 'fail',
    evidence: `${lot.loteControle} (${lot.fabricanteControle})`,
  });

  items.push({
    id: 'setup-bancada',
    requirement: 'Lote vinculado a uma bancada operacional.',
    reference: 'DICQ 4.3.6',
    status: lot.setupType ? 'pass' : 'na',
    evidence: lot.setupType
      ? `Vinculação: ${lot.setupType === 'principal' ? 'rotina' : 'validação paralela'}`
      : 'Lote em estoque (sem vinculação).',
  });

  return items;
}

function buildAuditEvents(runs: UroanaliseRun[], lot: UroanaliseLot | undefined): UroAuditEvent[] {
  const events: UroAuditEvent[] = [];

  for (const run of runs) {
    const ts = run.dataRealizacao ? new Date(run.dataRealizacao).getTime() : Date.now();
    if (run.logicalSignature) {
      events.push({
        id: `sig-${run.id}`,
        type: 'run_signed',
        ts,
        operatorName: run.operatorName ?? 'Operador',
        signatureHash: run.logicalSignature,
        description: `Corrida ${run.runCode} (${run.conformidade === 'A' ? 'Aceitável' : 'Rejeitada'})`,
      });
    }
    if (run.notivisaStatus === 'notificado' && run.notivisaProtocolo) {
      events.push({
        id: `notv-${run.id}`,
        type: 'notivisa_submitted',
        ts: run.notivisaDataEnvio ? new Date(run.notivisaDataEnvio).getTime() : ts,
        operatorName: run.operatorName ?? 'Operador',
        description: `Protocolo: ${run.notivisaProtocolo}`,
      });
    }
  }

  if (lot?.uroDecision && lot.decisionAt) {
    const ts =
      typeof lot.decisionAt === 'object' && 'toMillis' in lot.decisionAt
        ? (lot.decisionAt as { toMillis: () => number }).toMillis()
        : Date.now();
    events.push({
      id: `dec-${lot.id}`,
      type: 'lot_decision',
      ts,
      operatorName: lot.decisionBy ?? 'RT',
      description: `Decisão registrada: ${lot.uroDecision}`,
    });
  }

  return events.sort((a, b) => b.ts - a.ts);
}

function buildFormDefaults(lot: UroanaliseLot | undefined, userName: string): Partial<UroanaliseFormData> {
  if (!lot) {
    return {
      resultados: {},
      resultadosEsperadosRun: {},
    };
  }
  const today = new Date().toISOString().slice(0, 10);
  return {
    nivel: lot.nivel,
    frequencia: lot.frequencyConfig?.frequencyType === 'diaria' ? 'DIARIA' : 'LOTE',
    loteControle: lot.loteControle,
    fabricanteControle: lot.fabricanteControle,
    aberturaControle: lot.aberturaControle,
    validadeControle: lot.validadeControle,
    loteTira: '',
    operatorName: userName,
    operatorDocument: '',
    cargo: 'biomedico',
    dataRealizacao: today,
    resultados: {},
    resultadosEsperadosRun: lot.resultadosEsperados ?? {},
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function UroanaliseRedesignedDemo() {
  const activeLab = useActiveLab();
  const labId = useActiveLabId();
  const user = useUser();
  const userRole = useUserRole();
  const isSuperAdmin = useIsSuperAdmin();
  const { lots } = useUroLots();
  const { enabled: ocrEnabled } = useUroOcrSetting();
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [novoLoteInitialTipo, setNovoLoteInitialTipo] = useState<'reagente' | 'controle' | 'tira-uro'>('tira-uro');
  const [createdTiraLot, setCreatedTiraLot] = useState<{ loteTira: string } | null>(null);

  const effectiveLotId = selectedLotId ?? lots[0]?.id ?? null;
  const { runs, isLoading: runsLoading } = useUroRuns(effectiveLotId);
  const saveRun = useSaveUroRun();

  const userName = user?.displayName || user?.email?.split('@')[0] || 'Operador';
  const canDecide = isSuperAdmin || userRole === 'owner' || userRole === 'admin';

  // ── Modal state ──────────────────────────────────────────────────────────
  const [showCreateRun, setShowCreateRun] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<UroanaliseLot | null>(null);
  const [detailRunId, setDetailRunId] = useState<string | null>(null);
  const [qrRunId, setQrRunId] = useState<string | null>(null);
  const [showNovoLote, setShowNovoLote] = useState(false);

  const sidebarItems = useMemo(() => lots.map(lotToSidebarItem), [lots]);
  const auditRows = useMemo(() => runs.map(runToAuditRow), [runs]);

  const selectedLot = useMemo(
    () => lots.find((l) => l.id === effectiveLotId),
    [lots, effectiveLotId]
  );

  const detailRun = useMemo(
    () => runs.find((r) => r.id === detailRunId),
    [runs, detailRunId]
  );
  const qrRun = useMemo(() => runs.find((r) => r.id === qrRunId), [runs, qrRunId]);

  const complianceItems = useMemo(() => buildComplianceItems(selectedLot), [selectedLot]);
  const auditTrailEvents = useMemo(() => buildAuditEvents(runs, selectedLot), [runs, selectedLot]);
  const formDefaults = useMemo(() => {
    const defaults = buildFormDefaults(createPrefill ?? selectedLot, userName);
    if (createdTiraLot) {
      return {
        ...defaults,
        loteTira: createdTiraLot.loteTira,
      };
    }
    return defaults;
  }, [createPrefill, selectedLot, userName, createdTiraLot]);

  // ── Wired handlers ───────────────────────────────────────────────────────

  const handleSubmitRun = useCallback(
    async (data: UroanaliseFormData, options?: import('../hooks/useSaveUroRun').SaveUroRunOptions) => {
      saveRun.clearError();
      try {
        const result = await saveRun.save(data, options);
        toast.success('Corrida registrada e assinada. Auditada e imutável.');
        setShowCreateRun(false);
        setCreatePrefill(null);
        if (result.lotId) {
          setSelectedLotId(result.lotId);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao registrar corrida.';
        toast.error(msg);
        throw err;
      }
    },
    [saveRun]
  );

  const handleSelectLot = useCallback((id: string | null) => {
    setSelectedLotId(id);
    setCreatedTiraLot(null);
  }, []);

  const handleCreateLot = useCallback(() => {
    setNovoLoteInitialTipo('controle');
    setShowNovoLote(true);
  }, []);

  const handleNovoLoteCreated = useCallback(
    async (insumoId: string) => {
      setShowNovoLote(false);
      if (!labId) return;

      try {
        const lotRef = doc(db, 'labs', labId, 'ciq-uroanalise', insumoId);
        const lotSnap = await getDoc(lotRef);
        if (lotSnap.exists()) {
          const lotData = lotSnap.data() as UroanaliseLot;
          if (lotData.tipo === 'controle') {
            setSelectedLotId(insumoId);
            toast.success('Lote de controle selecionado automaticamente.');
          } else if (lotData.tipo === 'tira') {
            setCreatedTiraLot({
              loteTira: lotData.tiraReferencia ?? lotData.loteControle ?? '',
            });
            toast.success('Lote de tira selecionado automaticamente.');
          }
        }
      } catch (err) {
        console.error('Erro ao buscar lote recém-criado:', err);
      }
    },
    [labId]
  );

  const handleTogglePinLot = useCallback(
    async (id: string, nextPinned: boolean) => {
      if (!labId || !user) {
        toast.error('Sessão inválida.');
        return;
      }
      try {
        if (nextPinned) {
          await vincularUroLot(labId, id, 'principal', user.uid);
          toast.success('Lote vinculado como Setup Oficial. Auditado.');
        } else {
          await desvincularUroLot(labId, id, user.uid);
          toast.success('Lote desvinculado da bancada. Auditado.');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao alterar vínculo.';
        toast.error(msg);
      }
    },
    [labId, user]
  );

  const handleViewRun = useCallback((id: string) => {
    setDetailRunId(id);
  }, []);

  const handleSignRun = useCallback((id: string) => {
    // Assinatura SHA-256 é gerada automaticamente no save (RDC 978/2025).
    // Este botão abre o QR de auditoria, que comprova a assinatura imutável.
    setQrRunId(id);
  }, []);

  const handleApproveLot = useCallback(
    async (decision: UroStatus) => {
      if (!labId || !user || !selectedLot) return;
      const label = decision === 'A' ? 'Aceitável' : 'Rejeitado';
      if (!confirm(`Confirmar decisão "${label}" para o lote ${selectedLot.loteControle} (Nível ${selectedLot.nivel})?`)) {
        return;
      }
      try {
        await updateUroLotDecision(labId, selectedLot.id, decision, user.uid);
        toast.success(`Decisão "${label}" registrada. Auditada e imutável.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao registrar decisão.';
        toast.error(msg);
      }
    },
    [labId, user, selectedLot]
  );

  const selectedLotMapped = selectedLot
    ? {
        loteControle: selectedLot.loteControle,
        fabricanteControle: selectedLot.fabricanteControle,
        nivel: selectedLot.nivel,
        pinned: Boolean(selectedLot.setupType),
        setupType: selectedLot.setupType ?? null,
      }
    : undefined;

  // ── Lot decision actions in header ───────────────────────────────────────
  const lotDecisionActions = selectedLot && canDecide && !selectedLot.uroDecision ? (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => handleApproveLot('A')}
        title="Aprovar lote (RT)"
        className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-500/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
      >
        Aprovar
      </button>
      <button
        type="button"
        onClick={() => handleApproveLot('Rejeitado')}
        title="Rejeitar lote (RT)"
        className="text-[11px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 px-3 py-2 rounded-lg border border-red-300 dark:border-red-500/25 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
      >
        Rejeitar
      </button>
    </div>
  ) : selectedLot?.uroDecision ? (
    <span
      className={[
        'text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border',
        selectedLot.uroDecision === 'A'
          ? 'text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10'
          : 'text-red-600 dark:text-red-400 border-red-300 dark:border-red-500/25 bg-red-50 dark:bg-red-500/10',
      ].join(' ')}
      title={`Decisão registrada por ${selectedLot.decisionBy ?? 'RT'}`}
    >
      {selectedLot.uroDecision === 'A' ? 'Aprovado' : 'Rejeitado'}
    </span>
  ) : null;

  // ── Preview banner ───────────────────────────────────────────────────────
  const previewBanner = (
    <div className="flex items-center justify-between gap-3 px-6 py-2 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/20">
      <div className="flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-300">
        <span className="font-semibold uppercase tracking-wider">Preview</span>
        <span className="text-amber-600/70 dark:text-amber-400/70">
          UI experimental — funcionalidade completa, sujeita a refinamentos.
        </span>
      </div>
      <a
        href="/uroanalise"
        className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 underline-offset-4 hover:underline"
      >
        Voltar à UI estável
      </a>
    </div>
  );

  return (
    <>
      <UroanaliseRedesignedShell
        labName={activeLab?.name}
        lots={sidebarItems}
        selectedLotId={effectiveLotId ?? undefined}
        onSelectLot={handleSelectLot}
        onTogglePinLot={handleTogglePinLot}
        onCreateLot={handleCreateLot}
        selectedLot={selectedLotMapped}
        formInitialValues={formDefaults}
        onSubmitRun={handleSubmitRun}
        formDisabled={saveRun.isSaving}
        operadorDisplay={userName}
        auditRows={auditRows}
        auditLoading={runsLoading}
        onViewRun={handleViewRun}
        onSignRun={handleSignRun}
        complianceItems={complianceItems}
        auditTrailEvents={auditTrailEvents}
        auditTrailSubtitle={selectedLot?.loteControle}
        headerActionsExtra={lotDecisionActions}
        banner={previewBanner}
        onAddTiraLot={() => {
          setNovoLoteInitialTipo('tira-uro');
          setShowNovoLote(true);
        }}
      />

      {showCreateRun && (
        <NovaRunModal
          onClose={() => {
            setShowCreateRun(false);
            setCreatePrefill(null);
            saveRun.clearError();
          }}
          onSubmit={handleSubmitRun}
          isSaving={saveRun.isSaving}
          error={saveRun.error}
          {...(selectedLot && { initialNivel: selectedLot.nivel })}
          ocrEnabled={ocrEnabled}
          labId={labId}
          {...(createPrefill && { prefillFromLot: createPrefill })}
        />
      )}

      {detailRun && (
        <RunDetailModal
          run={detailRun}
          onClose={() => setDetailRunId(null)}
        />
      )}

      {qrRun && effectiveLotId && (
        <QRModal
          run={qrRun}
          lotId={effectiveLotId}
          onClose={() => setQrRunId(null)}
        />
      )}

      {showNovoLote && (
        <NovoLoteModal
          labId={labId ?? ''}
          initialTipo={novoLoteInitialTipo}
          initialModulo="uroanalise"
          onClose={() => setShowNovoLote(false)}
          onCreated={handleNovoLoteCreated}
        />
      )}
    </>
  );
}
