/**
 * useManualKitGuard — equivalente manual do `useInsumoFlowGuard`.
 *
 * Usado por corridas de testes manuais (kits lidos a olho — PCR látex, VDRL
 * em lâmina, cartela imunocromatográfica, tira de uroanálise sem leitor).
 * Nessas corridas não há `EquipmentSetup` ativo: o operador escolhe o kit
 * na hora via `ManualKitPicker`, e o hook congela os snapshots no save.
 *
 * Contrato idêntico ao `useInsumoFlowGuard` onde faz sentido — o form alterna
 * entre os dois hooks via `testType.manual` (Imuno) ou toggle manual (Uro)
 * sem mudar o shape do payload final.
 *
 * Fase F — 2026-04-24.
 */

import { useCallback, useMemo, useState } from 'react';
import { useActiveLab } from '../../../store/useAuthStore';
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
import { type Insumo, type InsumoModulo, type InsumoTipo } from '../types/Insumo';

// ─── Slots ───────────────────────────────────────────────────────────────────

/**
 * Slots suportados no modo manual. Config varia por módulo:
 *   - Imuno manual:       reagente + controlePositivo + controleNegativo
 *   - Uro manual:         tira + controle
 *
 * Hemato/Coag não têm modo manual (sempre rodam em analisador).
 */
export type ManualSlot =
  | 'reagente'
  | 'controlePositivo'
  | 'controleNegativo'
  | 'controle'
  | 'tira';

export interface ManualKitRequiredSlots {
  reagente?: boolean;
  controlePositivo?: boolean;
  controleNegativo?: boolean;
  controle?: boolean;
  tira?: boolean;
}

export interface ManualKitSelection {
  reagente: string | null;
  controlePositivo: string | null;
  controleNegativo: string | null;
  controle: string | null;
  tira: string | null;
}

const EMPTY_SELECTION: ManualKitSelection = {
  reagente: null,
  controlePositivo: null,
  controleNegativo: null,
  controle: null,
  tira: null,
};

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseManualKitGuardParams {
  module: InsumoModulo;
  requiredSlots: ManualKitRequiredSlots;
  /**
   * testType é usado para priorizar insumos com `testTypesCompativeis` incluindo
   * o valor atual. Quando ausente, todos os insumos ativos do módulo aparecem
   * no picker. Em Uro passa `null` (não há testType).
   */
  testType?: string | null;
}

export interface UseManualKitGuardResult {
  selection: ManualKitSelection;
  setSlot: (slot: ManualSlot, insumoId: string | null) => void;
  /** Insumos resolvidos a partir da seleção — `null` por slot não selecionado. */
  resolved: Record<ManualSlot, Insumo | null>;
  /** Candidatos elegíveis por slot, ordenados com compatíveis primeiro. */
  candidates: Record<ManualSlot, Insumo[]>;

  slotsFaltando: ManualSlot[];
  /** true quando todos os `requiredSlots` têm insumo selecionado. */
  selectionComplete: boolean;

  confirmed: boolean;
  setConfirmed: (v: boolean) => void;

  overrideContext: OverrideContext | null;
  isOverrideOpen: boolean;
  closeOverride: () => void;
  confirmOverride: (motivo: string) => void;

  prepareForSave: () => Promise<ManualKitOverrideFlags | null>;
  /**
   * Pós-save — incrementa runCount, e em Imuno valida/reprova o lote do
   * reagente quando a corrida foi de validação (qcStatus pendente).
   *
   * `classificacaoImuno`: vem do `prepareForSave` — quando `'validacao'` e
   * conforme, o reagente é aprovado; quando `'validacao'` e reprovado, o
   * reagente é reprovado com motivo automático. Usado apenas em Imuno.
   *
   * `userId` / `userName`: necessários pra registrar approver/reprover.
   * Caller passa do user logado.
   *
   * `motivoReprovacao` (opcional): mensagem a gravar quando reprovado;
   * default = "Validação reprovada — controle(s) divergente(s) do esperado".
   */
  afterSave: (ctx: {
    runId: string;
    wasConforme: boolean;
    classificacaoImuno?: 'validacao' | 'uso-normal';
    /** Necessário apenas quando `classificacaoImuno === 'validacao'`. */
    userId?: string;
    userName?: string;
    motivoReprovacao?: string;
  }) => Promise<void>;
  getSnapshots: () => InsumosSnapshotSet;
}

export interface ManualKitOverrideFlags {
  insumoVencidoOverride: boolean;
  qcNaoValidado: boolean;
  overrideMotivo?: string;
  classificacaoImuno?: 'validacao' | 'uso-normal';
}

/**
 * Determina se um insumo do módulo correto é elegível para o slot dado.
 * Controles positivo/negativo são ambos `tipo: 'controle'` — a distinção é
 * manual (o operador escolhe pelo nomeComercial/rótulo). Reagente e tira
 * casam pelos seus respectivos `tipo`.
 */
function tipoEsperado(slot: ManualSlot): InsumoTipo {
  if (slot === 'reagente') return 'reagente';
  if (slot === 'tira') return 'tira-uro';
  return 'controle';
}

/**
 * Ordena candidatos: (1) compatíveis com o testType atual primeiro, (2) depois
 * os sem `testTypesCompativeis` (genéricos do módulo), (3) depois os que têm
 * lista mas não incluem este testType (menos provável — mas pode ser útil).
 * Dentro de cada grupo, ordena por nomeComercial (estável).
 */
function rankCandidates(items: Insumo[], testType: string | null | undefined): Insumo[] {
  const group = (i: Insumo): number => {
    const list =
      i.tipo === 'reagente' || i.tipo === 'controle'
        ? (i as { testTypesCompativeis?: string[] }).testTypesCompativeis
        : undefined;
    if (!testType) return list && list.length > 0 ? 1 : 0;
    if (list && list.includes(testType)) return 0;
    if (!list || list.length === 0) return 1;
    return 2;
  };
  return [...items].sort((a, b) => {
    const ga = group(a);
    const gb = group(b);
    if (ga !== gb) return ga - gb;
    return a.nomeComercial.localeCompare(b.nomeComercial);
  });
}

export function useManualKitGuard({
  module,
  requiredSlots,
  testType,
}: UseManualKitGuardParams): UseManualKitGuardResult {
  const activeLab = useActiveLab();
  const { insumos: allAtivos } = useInsumos({ status: 'ativo' });

  const insumosDoModulo = useMemo(
    () =>
      allAtivos.filter((i) => {
        const mods: InsumoModulo[] =
          Array.isArray(i.modulos) && i.modulos.length > 0 ? [...i.modulos] : [i.modulo];
        return mods.includes(module);
      }),
    [allAtivos, module],
  );

  const [selection, setSelection] = useState<ManualKitSelection>(EMPTY_SELECTION);
  const [confirmed, setConfirmed] = useState(false);
  const [isOverrideOpen, setOverrideOpen] = useState(false);
  const [overrideContext, setOverrideContext] = useState<OverrideContext | null>(null);
  const [pendingResolver, setPendingResolver] = useState<
    ((v: ManualKitOverrideFlags | null) => void) | null
  >(null);

  const setSlot = useCallback((slot: ManualSlot, insumoId: string | null) => {
    setSelection((prev) => ({ ...prev, [slot]: insumoId }));
    // Nova escolha invalida confirmação anterior — força reconferência.
    setConfirmed(false);
  }, []);

  // ── Candidatos por slot (ordenados) ───────────────────────────────────────
  const candidates = useMemo<Record<ManualSlot, Insumo[]>>(() => {
    const byTipo: Record<InsumoTipo, Insumo[]> = {
      reagente: [],
      controle: [],
      'tira-uro': [],
    };
    for (const i of insumosDoModulo) byTipo[i.tipo].push(i);

    return {
      reagente: rankCandidates(byTipo.reagente, testType),
      controlePositivo: rankCandidates(byTipo.controle, testType),
      controleNegativo: rankCandidates(byTipo.controle, testType),
      controle: rankCandidates(byTipo.controle, testType),
      tira: rankCandidates(byTipo['tira-uro'], testType),
    };
  }, [insumosDoModulo, testType]);

  // ── Resolve selection → Insumo ────────────────────────────────────────────
  const byId = useMemo(() => new Map(insumosDoModulo.map((i) => [i.id, i])), [insumosDoModulo]);

  const resolved = useMemo<Record<ManualSlot, Insumo | null>>(
    () => ({
      reagente: selection.reagente ? byId.get(selection.reagente) ?? null : null,
      controlePositivo: selection.controlePositivo
        ? byId.get(selection.controlePositivo) ?? null
        : null,
      controleNegativo: selection.controleNegativo
        ? byId.get(selection.controleNegativo) ?? null
        : null,
      controle: selection.controle ? byId.get(selection.controle) ?? null : null,
      tira: selection.tira ? byId.get(selection.tira) ?? null : null,
    }),
    [selection, byId],
  );

  const slotsFaltando = useMemo<ManualSlot[]>(() => {
    const out: ManualSlot[] = [];
    (Object.keys(requiredSlots) as ManualSlot[]).forEach((slot) => {
      if (requiredSlots[slot] && !resolved[slot]) out.push(slot);
    });
    return out;
  }, [requiredSlots, resolved]);

  const selectionComplete = slotsFaltando.length === 0;

  // ── Snapshot ──────────────────────────────────────────────────────────────
  const getSnapshots = useCallback((): InsumosSnapshotSet => {
    const snap: InsumosSnapshotSet = {};
    if (resolved.reagente) snap.reagente = buildInsumoSnapshot(resolved.reagente);
    if (resolved.controle) snap.controle = buildInsumoSnapshot(resolved.controle);
    if (resolved.tira) snap.tira = buildInsumoSnapshot(resolved.tira);
    if (resolved.controlePositivo)
      snap.controlePositivo = buildInsumoSnapshot(resolved.controlePositivo);
    if (resolved.controleNegativo)
      snap.controleNegativo = buildInsumoSnapshot(resolved.controleNegativo);
    return snap;
  }, [resolved]);

  // ── Override resolution ───────────────────────────────────────────────────
  const closeOverride = useCallback(() => {
    setOverrideOpen(false);
    setOverrideContext(null);
    if (pendingResolver) {
      pendingResolver(null);
      setPendingResolver(null);
    }
  }, [pendingResolver]);

  const confirmOverride = useCallback(
    (motivo: string) => {
      const hasVencido = overrideContext?.bloqueios.some((b) => b.motivo === 'vencido') ?? false;
      const hasQcPend =
        overrideContext?.bloqueios.some((b) =>
          ['qc-pendente', 'imuno-nao-aprovado'].includes(b.motivo),
        ) ?? false;
      const hasImunoPend =
        overrideContext?.bloqueios.some((b) => b.motivo === 'imuno-nao-aprovado') ?? false;

      const flags: ManualKitOverrideFlags = {
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

  // ── Prepare for save ──────────────────────────────────────────────────────
  const prepareForSave = useCallback((): Promise<ManualKitOverrideFlags | null> => {
    if (!selectionComplete || !confirmed) return Promise.resolve(null);

    const bloqueios: OverrideContext['bloqueios'] = [];
    const addIfBlocked = (slot: ManualSlot, insumo: Insumo | null) => {
      if (!insumo) return;
      const u = evaluateInsumoUsability(insumo);
      if (!u.ok && u.motivo && u.mensagem) {
        // Mapeia slot manual para slot do OverrideContext (apenas reagente/controle/tira).
        const ctxSlot: 'reagente' | 'controle' | 'tira' =
          slot === 'reagente'
            ? 'reagente'
            : slot === 'tira'
              ? 'tira'
              : 'controle';
        bloqueios.push({
          slot: ctxSlot,
          insumoId: insumo.id,
          insumoNome: insumo.nomeComercial,
          lote: insumo.lote,
          motivo: u.motivo,
          mensagem: u.mensagem,
        });
      }
    };
    (Object.keys(resolved) as ManualSlot[]).forEach((slot) => addIfBlocked(slot, resolved[slot]));

    if (bloqueios.length === 0) {
      const flags: ManualKitOverrideFlags = {
        insumoVencidoOverride: false,
        qcNaoValidado: false,
      };
      if (module === 'imunologia') flags.classificacaoImuno = 'uso-normal';
      return Promise.resolve(flags);
    }

    // Fase G (2026-04-25) — fluxo de validação Imuno:
    // Quando o ÚNICO motivo de bloqueio é `imuno-nao-aprovado` E o lote ainda
    // está PENDENTE (não reprovado), a corrida É a validação do lote.
    // Override modal não faz sentido aqui — virou a regra original
    // ("pra aprovar precisa rodar, pra rodar precisa de override"). Bypass
    // direto: classifica a corrida como 'validacao' e segue. UI já exibe
    // banner "Modo validação".
    //
    // Lote 'reprovado' continua exigindo override (uso deliberado de lote já
    // reprovado pede justificativa formal). Mistura com outros motivos
    // (vencido, qc-pendente em outros slots) também exige.
    if (
      module === 'imunologia' &&
      bloqueios.every((b) => b.motivo === 'imuno-nao-aprovado') &&
      bloqueios.every((b) => {
        const insumo = resolved[
          b.slot === 'reagente' ? 'reagente' : 'controle'
        ] as Insumo | null;
        const candidato =
          insumo?.id === b.insumoId
            ? insumo
            : (Object.values(resolved) as (Insumo | null)[]).find(
                (i) => i?.id === b.insumoId,
              ) ?? null;
        if (!candidato) return false;
        if (candidato.tipo !== 'reagente') return true;
        return candidato.qcStatus !== 'reprovado';
      })
    ) {
      return Promise.resolve({
        insumoVencidoOverride: false,
        qcNaoValidado: true,
        classificacaoImuno: 'validacao',
      });
    }

    setOverrideContext({ bloqueios });
    setOverrideOpen(true);
    return new Promise<ManualKitOverrideFlags | null>((resolve) => {
      setPendingResolver(() => resolve);
    });
  }, [selectionComplete, confirmed, resolved, module]);

  // ── After save ────────────────────────────────────────────────────────────
  const afterSave = useCallback(
    async ({
      runId,
      wasConforme,
      classificacaoImuno,
      userId,
      userName,
      motivoReprovacao,
    }: {
      runId: string;
      wasConforme: boolean;
      classificacaoImuno?: 'validacao' | 'uso-normal';
      userId?: string;
      userName?: string;
      motivoReprovacao?: string;
    }) => {
      if (!activeLab) return;

      const insumoIds: string[] = [];
      const qcIds: string[] = [];
      (Object.values(resolved) as (Insumo | null)[]).forEach((i) => {
        if (!i) return;
        insumoIds.push(i.id);
        if (i.tipo === 'reagente' || i.tipo === 'tira-uro') qcIds.push(i.id);
      });

      if (insumoIds.length > 0) await incrementInsumoRunCount(activeLab.id, insumoIds);
      if (wasConforme && qcIds.length > 0) {
        await clearInsumoQCValidation(activeLab.id, qcIds);
      }

      // PR1 (2026-04-26) — fluxo de aprovação/reprovação do lote saiu daqui.
      // Decisão formal agora é responsabilidade da callable Cloud Function
      // `approveQualificacao` / `reproveQualificacao`, disparada explicitamente
      // pelo operador via `InsumoQualificacaoModal`. Esta hook só incrementa
      // contadores — o run pode ser USADO COMO EVIDÊNCIA depois, mas isso é
      // uma decisão separada do RT/biomedico.
      //
      // Side effects suprimidos vs. Fase G (2026-04-25):
      //   classificacaoImuno === 'validacao' & wasConforme  → aprovarLoteImuno
      //   classificacaoImuno === 'validacao' & !wasConforme → reprovarLoteImuno
      //
      // Esses caminhos foram intencionalmente removidos. Mantemos os parâmetros
      // `classificacaoImuno`, `userId`, `userName`, `motivoReprovacao` no shape
      // do callback para não quebrar callers existentes — ignorados aqui.
      void classificacaoImuno;
      void userId;
      void userName;
      void motivoReprovacao;
    },
    [activeLab, resolved],
  );

  return {
    selection,
    setSlot,
    resolved,
    candidates,
    slotsFaltando,
    selectionComplete,
    confirmed,
    setConfirmed,
    overrideContext,
    isOverrideOpen,
    closeOverride,
    confirmOverride,
    prepareForSave,
    afterSave,
    getSnapshots,
  };
}

// Mantém referência para o tipo de slot (reutilizado em ManualKitPicker).
export type { InsumoTipo };
