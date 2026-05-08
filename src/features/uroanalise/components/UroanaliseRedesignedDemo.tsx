import React, { useCallback, useMemo, useState } from 'react';
import { useUroLots } from '../hooks/useUroLots';
import { useUroRuns } from '../hooks/useUroRuns';
import { useSaveUroRun } from '../hooks/useSaveUroRun';
import { useActiveLab, useUser } from '../../../store/useAuthStore';
import { UroanaliseRedesignedShell } from './UroanaliseRedesignedShell';
import { daysToExpiry } from './UroanaliseForm.schema';
import type { UroanaliseFormData } from './UroanaliseForm.schema';
import type { UroLotSidebarItem } from './UroLotSidebar';
import type { UroAuditRow } from './UroAuditTable';
import type { UroAuditEvent } from './UroAuditTrailDrawer';
import type { UroComplianceItem } from './UroComplianceChecklist';
import { URO_COMPLIANCE_REFERENCES } from './UroComplianceChecklist';
import type { UroanaliseLot, UroanaliseRun } from '../types/Uroanalise';

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

  // Validade do controle
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

  // Status do lote (decisão RT)
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

  // Rastreabilidade
  items.push({
    id: 'rastreabilidade',
    requirement: 'Rastreabilidade de lote e fabricante do controle.',
    reference: URO_COMPLIANCE_REFERENCES.rastreabilidade,
    status: lot.loteControle && lot.fabricanteControle ? 'pass' : 'fail',
    evidence: `${lot.loteControle} (${lot.fabricanteControle})`,
  });

  // Setup vinculado à bancada
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
  const user = useUser();
  const { lots } = useUroLots();
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);

  const effectiveLotId = selectedLotId ?? lots[0]?.id ?? null;
  const { runs, isLoading: runsLoading } = useUroRuns(effectiveLotId);
  const saveRun = useSaveUroRun();

  const userName = user?.displayName || user?.email?.split('@')[0] || 'Operador';

  const sidebarItems = useMemo(() => lots.map(lotToSidebarItem), [lots]);
  const auditRows = useMemo(() => runs.map(runToAuditRow), [runs]);

  const selectedLot = useMemo(
    () => lots.find((l) => l.id === effectiveLotId),
    [lots, effectiveLotId]
  );

  const complianceItems = useMemo(() => buildComplianceItems(selectedLot), [selectedLot]);
  const auditTrailEvents = useMemo(() => buildAuditEvents(runs, selectedLot), [runs, selectedLot]);
  const formDefaults = useMemo(
    () => buildFormDefaults(selectedLot, userName),
    [selectedLot, userName]
  );

  const handleSubmitRun = useCallback(
    async (data: UroanaliseFormData) => {
      await saveRun.save(data);
    },
    [saveRun]
  );

  const handleViewRun = useCallback((id: string) => {
    console.info('[uroanalise-redesign] view run', id);
  }, []);

  const handleSignRun = useCallback((id: string) => {
    console.info('[uroanalise-redesign] sign run', id);
  }, []);

  const selectedLotMapped = selectedLot
    ? {
        loteControle: selectedLot.loteControle,
        fabricanteControle: selectedLot.fabricanteControle,
        nivel: selectedLot.nivel,
        pinned: Boolean(selectedLot.setupType),
        setupType: selectedLot.setupType ?? null,
      }
    : undefined;

  return (
    <UroanaliseRedesignedShell
      labName={activeLab?.name}
      lots={sidebarItems}
      selectedLotId={effectiveLotId ?? undefined}
      onSelectLot={setSelectedLotId}
      onTogglePinLot={() => {
        // TODO: wire pinning when bench-pin mutation exists
      }}
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
    />
  );
}
