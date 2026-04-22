/**
 * useInsumoFlowGuard — orquestra o fluxo de conferência de insumos pra uma
 * corrida: lê o EquipmentSetup ativo, resolve os insumos dos slots, valida
 * usabilidade, oferece API pra abrir override modal e retorna o snapshot
 * pronto pro save.
 *
 * Centraliza a lógica da Fase B1-etapa2 pra não duplicar em 3 forms
 * (Coagulação, Uroanálise, Imuno). Cada form passa seus `requiredSlots`
 * específicos.
 *
 * Contrato de uso no form:
 *   const guard = useInsumoFlowGuard({ module: 'coagulacao', requiredSlots: {...} });
 *   // render: <ConferenciaInsumoAtivo ... /> + (opcional) <OverrideModal ... />
 *   // submit:
 *   const ready = await guard.prepareForSave();  // abre override se necessário
 *   if (!ready) return;  // usuário cancelou override ou faltou setup
 *   const payload = { ..., insumosSnapshot: guard.getSnapshots(), ...ready.flags };
 *   await save(payload);
 *   await guard.afterSave(runId);  // logs transitions + incrementa runCount
 */

import { useCallback, useMemo, useState } from 'react';
import { useActiveLab } from '../../../store/useAuthStore';
import { useEquipmentSetup } from './useEquipmentSetup';
import { useInsumos } from './useInsumos';
import {
  buildInsumoSnapshot,
  type InsumosSnapshotSet,
} from '../types/InsumoSnapshot';
import { evaluateInsumoUsability } from '../utils/insumoUsability';
import {
  incrementInsumoRunCount,
  clearInsumoQCValidation,
} from '../services/insumosFirebaseService';
import type { OverrideContext } from '../components/OverrideModal';
import {
  insumoCobreEquipamento,
  type Insumo,
  type InsumoModulo,
} from '../types/Insumo';

export interface RequiredSlots {
  reagente?: boolean;
  controle?: boolean;
  tira?: boolean;
}

interface UseInsumoFlowGuardParams {
  module: InsumoModulo;
  requiredSlots: RequiredSlots;
  /**
   * Fase D (2026-04-21 — 2º turno): equipamento escolhido pelo operador
   * no form. Quando presente:
   *   - Setup lido de `/equipment-setups/{equipamentoId}` (não mais {module}).
   *   - `allAtivos` filtrado via `insumoCobreEquipamento`.
   * Backward-compat: ausente = fallback pro comportamento Fase A (docId=module).
   */
  equipamentoId?: string | null;
}

export interface InsumoFlowOverrideFlags {
  insumoVencidoOverride: boolean;
  qcNaoValidado: boolean;
  overrideMotivo?: string;
  /** Classificação da corrida Imuno (validação vs uso-normal). */
  classificacaoImuno?: 'validacao' | 'uso-normal';
}

export interface UseInsumoFlowGuardResult {
  // ── Estado ─────────────────────────────────────────────────────────────────
  reagente: Insumo | null;
  controle: Insumo | null;
  tira: Insumo | null;
  setupLoaded: boolean;
  /** true se todos os `requiredSlots` obrigatórios têm insumo configurado. */
  setupComplete: boolean;
  /** Lista dos slots obrigatórios ainda não preenchidos. UI usa pra mensagem. */
  slotsFaltando: Array<'reagente' | 'controle' | 'tira'>;

  // ── Conferência ────────────────────────────────────────────────────────────
  confirmed: boolean;
  setConfirmed: (v: boolean) => void;

  // ── Override modal ─────────────────────────────────────────────────────────
  overrideContext: OverrideContext | null;
  isOverrideOpen: boolean;
  closeOverride: () => void;

  // ── Comportamento ──────────────────────────────────────────────────────────
  /**
   * Chamado pelo handleSubmit do form. Retorna `null` se o save deve ser
   * bloqueado (setup incompleto, conferência ausente, override cancelado).
   * Se OK, devolve flags de override pra incluir no payload.
   */
  prepareForSave: () => Promise<InsumoFlowOverrideFlags | null>;

  /**
   * Chamado pelo form APÓS save bem-sucedido — incrementa runCount dos
   * insumos + cria transitions de override (se houve) + limpa qcValidation
   * dos reagentes/tiras em save conforme.
   */
  afterSave: (ctx: { runId: string; wasConforme: boolean }) => Promise<void>;

  /**
   * Snapshot set congelado. Chame no ponto do payload que vai pro save.
   * Idempotente — sempre reflete o setup atual do momento da leitura.
   */
  getSnapshots: () => InsumosSnapshotSet;

  /**
   * Confirma o override com a justificativa do usuário — usado pelo
   * `OverrideModal.onConfirm`. Dispara a resolução da Promise retornada por
   * `prepareForSave` com as flags derivadas.
   */
  confirmOverride: (motivo: string) => void;
}

export function useInsumoFlowGuard({
  module,
  requiredSlots,
  equipamentoId,
}: UseInsumoFlowGuardParams): UseInsumoFlowGuardResult {
  const activeLab = useActiveLab();
  // Fase D: se equipamentoId foi passado, lê o setup dele; senão cai no docId=module (Fase A).
  const setupDocId = equipamentoId ?? module;
  const { setup, isLoading } = useEquipmentSetup(setupDocId);
  const { insumos: allAtivos } = useInsumos({ status: 'ativo' });
  // Filtra só insumos que cobrem o equipamento ativo (reagente 1:1, controle N:1).
  // Sem equipamentoId, passa tudo (backward-compat).
  const insumos = useMemo(
    () =>
      equipamentoId
        ? allAtivos.filter((i) => insumoCobreEquipamento(i, equipamentoId))
        : allAtivos,
    [allAtivos, equipamentoId],
  );

  const [confirmed, setConfirmed] = useState(false);
  const [isOverrideOpen, setOverrideOpen] = useState(false);
  const [overrideContext, setOverrideContext] = useState<OverrideContext | null>(null);
  // Promise handler pra resolver a decisão do usuário no modal.
  const [pendingResolver, setPendingResolver] = useState<
    ((v: InsumoFlowOverrideFlags | null) => void) | null
  >(null);

  // ── Resolução dos insumos ativos ─────────────────────────────────────────
  const byId = useMemo(() => new Map(insumos.map((i) => [i.id, i])), [insumos]);
  const reagente = setup?.activeReagenteId ? byId.get(setup.activeReagenteId) ?? null : null;
  const controle = setup?.activeControleId ? byId.get(setup.activeControleId) ?? null : null;
  const tira = setup?.activeTiraUroId ? byId.get(setup.activeTiraUroId) ?? null : null;

  const slotsFaltando = useMemo(() => {
    const out: Array<'reagente' | 'controle' | 'tira'> = [];
    if (requiredSlots.reagente && !reagente) out.push('reagente');
    if (requiredSlots.controle && !controle) out.push('controle');
    if (requiredSlots.tira && !tira) out.push('tira');
    return out;
  }, [requiredSlots.reagente, requiredSlots.controle, requiredSlots.tira, reagente, controle, tira]);

  const setupComplete = slotsFaltando.length === 0;

  // ── Snapshot ─────────────────────────────────────────────────────────────
  const getSnapshots = useCallback((): InsumosSnapshotSet => {
    const snap: InsumosSnapshotSet = {};
    if (reagente) snap.reagente = buildInsumoSnapshot(reagente);
    if (controle) snap.controle = buildInsumoSnapshot(controle);
    if (tira) snap.tira = buildInsumoSnapshot(tira);
    return snap;
  }, [reagente, controle, tira]);

  // ── Override resolution ──────────────────────────────────────────────────
  const closeOverride = useCallback(() => {
    setOverrideOpen(false);
    setOverrideContext(null);
    if (pendingResolver) {
      pendingResolver(null); // cancelado
      setPendingResolver(null);
    }
  }, [pendingResolver]);

  /**
   * API pro OverrideModal onConfirm. Não deve ser chamada direto pelo form —
   * é usada internamente quando o modal confirma.
   */
  const resolveOverride = useCallback(
    (motivo: string) => {
      // Deriva flags a partir dos bloqueios registrados no contexto.
      const hasVencido = overrideContext?.bloqueios.some((b) => b.motivo === 'vencido') ?? false;
      const hasQcPend = overrideContext?.bloqueios.some((b) =>
        ['qc-pendente', 'imuno-nao-aprovado'].includes(b.motivo),
      ) ?? false;
      // Classificação Imuno: se qualquer slot imuno estava com qcStatus !== aprovado
      // no momento, a corrida é VALIDAÇÃO (não uso-normal).
      const hasImunoPend = overrideContext?.bloqueios.some(
        (b) => b.motivo === 'imuno-nao-aprovado',
      ) ?? false;

      const flags: InsumoFlowOverrideFlags = {
        insumoVencidoOverride: hasVencido,
        qcNaoValidado: hasQcPend,
        overrideMotivo: motivo,
      };
      if (module === 'imunologia' && hasImunoPend) {
        flags.classificacaoImuno = 'validacao';
      }

      setOverrideOpen(false);
      setOverrideContext(null);
      if (pendingResolver) {
        pendingResolver(flags);
        setPendingResolver(null);
      }
    },
    [overrideContext, module, pendingResolver],
  );

  // Expose resolveOverride on overrideContext façon — pai passa no onConfirm.
  // Pra simplicidade do contrato, expomos um bundle alternativo de callbacks
  // via isOverrideOpen + closeOverride + useCallback abaixo. O OverrideModal
  // recebe `onConfirm` ligado a resolveOverride pelo componente wrapper.
  // O form usa `guard.isOverrideOpen + guard.overrideContext` e monta o modal.

  // ── Prepare for save ─────────────────────────────────────────────────────
  const prepareForSave = useCallback((): Promise<InsumoFlowOverrideFlags | null> => {
    // 1. Setup incompleto → bloqueio rígido (sem override).
    if (!setupComplete) {
      return Promise.resolve(null);
    }
    // 2. Conferência obrigatória.
    if (!confirmed) {
      return Promise.resolve(null);
    }

    // 3. Validar usabilidade de cada slot configurado.
    const bloqueios: OverrideContext['bloqueios'] = [];
    const addIf = (slot: 'reagente' | 'controle' | 'tira', insumo: Insumo | null) => {
      if (!insumo) return;
      const u = evaluateInsumoUsability(insumo);
      if (!u.ok && u.motivo && u.mensagem) {
        bloqueios.push({
          slot,
          insumoId: insumo.id,
          insumoNome: insumo.nomeComercial,
          lote: insumo.lote,
          motivo: u.motivo,
          mensagem: u.mensagem,
        });
      }
    };
    addIf('reagente', reagente);
    addIf('controle', controle);
    addIf('tira', tira);

    if (bloqueios.length === 0) {
      // Caminho feliz: nenhum bloqueio.
      const flags: InsumoFlowOverrideFlags = {
        insumoVencidoOverride: false,
        qcNaoValidado: false,
      };
      // Para Imuno sem qcStatus='aprovado' a corrida seria bloqueada aqui —
      // logo se chegamos sem bloqueios em Imuno, insumo está aprovado → uso-normal.
      if (module === 'imunologia') {
        flags.classificacaoImuno = 'uso-normal';
      }
      return Promise.resolve(flags);
    }

    // 4. Há bloqueios → abrir override modal e esperar decisão.
    setOverrideContext({ bloqueios });
    setOverrideOpen(true);
    return new Promise<InsumoFlowOverrideFlags | null>((resolve) => {
      setPendingResolver(() => resolve);
    });
  }, [setupComplete, confirmed, reagente, controle, tira, module]);

  // ── After save ───────────────────────────────────────────────────────────
  const afterSave = useCallback(
    async ({ wasConforme }: { runId: string; wasConforme: boolean }) => {
      if (!activeLab) return;

      const insumoIds: string[] = [];
      const qcIds: string[] = [];
      if (reagente) {
        insumoIds.push(reagente.id);
        if (reagente.tipo === 'reagente') qcIds.push(reagente.id);
      }
      if (controle) insumoIds.push(controle.id);
      if (tira) {
        insumoIds.push(tira.id);
        if (tira.tipo === 'tira-uro') qcIds.push(tira.id);
      }

      // Incrementa runCount + lastRunAt — fire-and-forget interno ao service.
      await incrementInsumoRunCount(activeLab.id, insumoIds);

      // Limpa qcValidationRequired em reagentes/tiras se a corrida foi conforme.
      if (wasConforme && qcIds.length > 0) {
        await clearInsumoQCValidation(activeLab.id, qcIds);
      }
    },
    [activeLab, reagente, controle, tira],
  );

  return {
    reagente,
    controle,
    tira,
    setupLoaded: !isLoading && !!setup,
    setupComplete,
    slotsFaltando,
    confirmed,
    setConfirmed,
    overrideContext,
    isOverrideOpen,
    closeOverride,
    prepareForSave,
    afterSave,
    getSnapshots,
    confirmOverride: resolveOverride,
  };
}
