import React, { useState, useMemo } from 'react';
import { CIQImunoFormSchema, daysToExpiry } from './CIQImunoForm.schema';
import type { CIQImunoFormData } from './CIQImunoForm.schema';
import { useUser } from '../../../store/useAuthStore';
import { useCIQTestTypes } from '../hooks/useCIQTestTypes';
import { CIQTestTypeManager } from './CIQTestTypeManager';
import { ConferenciaInsumoAtivo } from '../../insumos/components/ConferenciaInsumoAtivo';
import { ManualKitPicker } from '../../insumos/components/ManualKitPicker';
import { OverrideModal } from '../../insumos/components/OverrideModal';
import { useInsumoFlowGuard } from '../../insumos/hooks/useInsumoFlowGuard';
import { useManualKitGuard } from '../../insumos/hooks/useManualKitGuard';
import { EquipamentoSelector } from '../../equipamentos/components/EquipamentoSelector';
import { buildEquipamentoSnapshot } from '../../equipamentos/types/Equipamento';
import type { Equipamento } from '../../equipamentos/types/Equipamento';
import { useAppStore } from '../../../store/useAppStore';
import type { SaveCIQRunOptions } from '../hooks/useSaveCIQRun';
import type { Insumo, InsumoControle } from '../../insumos/types/Insumo';
import type { CIQImunoLot } from '../types/CIQImuno';

// ─── Icon ─────────────────────────────────────────────────────────────────────

function SettingsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <circle cx="6.5" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M6.5 1v1.2M6.5 10.8V12M1 6.5h1.2M10.8 6.5H12M2.4 2.4l.85.85M9.75 9.75l.85.85M2.4 10.6l.85-.85M9.75 3.25l.85-.85"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

const CARGO_OPTIONS: { value: CIQImunoFormData['cargo']; label: string }[] = [
  { value: 'biomedico', label: 'Biomédico(a)' },
  { value: 'tecnico', label: 'Técnico(a) de Laboratório' },
  { value: 'farmaceutico', label: 'Farmacêutico(a)' },
];

const today = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const INPUT = [
  'w-full px-3.5 py-2.5 rounded-xl',
  'bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09]',
  'text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/20 text-sm',
  'focus:outline-none focus:border-emerald-500/50 dark:focus:border-emerald-500/50 focus:bg-white dark:focus:bg-white/[0.08]',
  'disabled:opacity-40 transition-all',
].join(' ');

const INPUT_ERR = INPUT.replace(
  'border-slate-200 dark:border-white/[0.09]',
  'border-red-400/60 dark:border-red-400/40',
);

// ─── Sub-components ───────────────────────────────────────────────────────────

function Label({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-1.5 ml-0.5"
    >
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-red-500 dark:text-red-400/80 text-xs mt-1 ml-0.5">{msg}</p>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30 mb-3">
      {children}
    </p>
  );
}

/** Toggle R / NR */
function RNRToggle({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: 'R' | 'NR' | undefined;
  onChange: (v: 'R' | 'NR') => void;
  error?: string;
}) {
  return (
    <div>
      <div className="flex gap-2" id={id}>
        {(['R', 'NR'] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={[
              'flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all',
              value === opt
                ? opt === 'R'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                  : 'bg-red-500/10 border-red-400/40 text-red-600 dark:text-red-400'
                : 'border-slate-200 dark:border-white/[0.09] text-slate-400 dark:text-white/30 hover:border-slate-300 dark:hover:border-white/20',
            ].join(' ')}
          >
            {opt === 'R' ? 'R — Reagente' : 'NR — Não Reagente'}
          </button>
        ))}
      </div>
      <FieldError msg={error} />
    </div>
  );
}

/**
 * Feedback inline por par (Positivo/Negativo) — exibido logo abaixo do
 * Obtido. Resolve confusão visual onde a cor "vermelha" do NR (polaridade)
 * pode ser interpretada como erro pelo operador, mesmo quando NR é a
 * resposta correta para o controle negativo.
 */
function InlineConformidadeBadge({
  esperado,
  obtido,
}: {
  esperado: 'R' | 'NR' | undefined;
  obtido: 'R' | 'NR' | undefined;
}) {
  if (!esperado || !obtido) return null;
  const conforme = esperado === obtido;
  return (
    <div
      className={[
        'flex items-center gap-2 mt-2 px-3 py-1.5 rounded-lg text-xs font-medium border',
        conforme
          ? 'bg-emerald-500/[0.08] border-emerald-500/25 text-emerald-700 dark:text-emerald-400'
          : 'bg-red-500/[0.08] border-red-400/25 text-red-700 dark:text-red-400',
      ].join(' ')}
    >
      <span className="text-base leading-none">{conforme ? '✓' : '✗'}</span>
      <span>
        {conforme
          ? `Conforme — obtido ${obtido} bate com o esperado.`
          : `Diverge — esperado ${esperado}, obtido ${obtido}.`}
      </span>
    </div>
  );
}

/**
 * Esperado derivado da polaridade do controle:
 *   - 'positivo' → R (deve reagir)
 *   - 'negativo' → NR (não deve reagir)
 *
 * Quando o controle não tem polaridade definida (lote legado), retorna
 * `undefined` — caller exibe aviso pra editar o produto.
 */
function esperadoFromControle(controle: InsumoControle | null): 'R' | 'NR' | undefined {
  if (!controle) return undefined;
  if (controle.nivel === 'positivo') return 'R';
  if (controle.nivel === 'negativo') return 'NR';
  return undefined;
}

/** Badge read-only mostrando o esperado derivado, com nivel do controle. */
function EsperadoBadge({
  esperado,
  controle,
}: {
  esperado: 'R' | 'NR' | undefined;
  controle: InsumoControle | null;
}) {
  if (!esperado) {
    return (
      <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl border text-xs bg-amber-500/[0.07] border-amber-500/20 text-amber-600 dark:text-amber-400">
        <span className="mt-px shrink-0">⚠</span>
        <span>
          Polaridade não definida no produto deste controle. Edite o produto e selecione
          Positivo/Negativo para que o esperado seja automático.
        </span>
      </div>
    );
  }
  const isR = esperado === 'R';
  return (
    <div
      className={[
        'flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border',
        isR
          ? 'bg-emerald-500/[0.07] border-emerald-500/25'
          : 'bg-red-500/[0.07] border-red-400/20',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <span
          className={[
            'inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold',
            isR
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-500/15 text-red-600 dark:text-red-400',
          ].join(' ')}
        >
          {esperado}
        </span>
        <span className="text-xs text-slate-700 dark:text-white/70">
          {isR ? 'R — Reagente' : 'NR — Não Reagente'}
          {controle?.lote && (
            <span className="text-slate-500 dark:text-white/40"> · Lote {controle.lote}</span>
          )}
        </span>
      </div>
      <span className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-white/30">
        Auto · do lote
      </span>
    </div>
  );
}

/**
 * Banner "Validação de lote novo" — versão compacta com 3 linhas visíveis
 * (título · identificação do lote · resumo de uma frase) e detalhe
 * expansível "Por quê?" com a explicação regulatória completa.
 *
 * Decisão de copy: a versão de uma linha-só perde o "POR QUÊ" — operador
 * júnior pode interpretar como passo burocrático e tentar pular. Manter o
 * resumo de uma frase preserva a intenção e o expand revela a base regulatória
 * (RDC 786/2023 + RDC 978/2025) sem ocupar espaço default.
 */
function ValidationBanner({
  reagenteNome,
  reagenteLote,
}: {
  reagenteNome?: string;
  reagenteLote?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = reagenteNome && reagenteLote ? `${reagenteNome} · Lote ${reagenteLote}` : null;
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3 space-y-1.5">
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400 font-bold text-xs">
          ⚑
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              Esta corrida validará o lote {id ? <span className="font-bold">{id}</span> : 'novo'}
            </p>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open ? 'true' : 'false'}
              className="text-[11px] font-medium text-amber-700/80 dark:text-amber-300/70 hover:text-amber-800 dark:hover:text-amber-200 underline decoration-dotted underline-offset-2 transition-colors shrink-0"
            >
              {open ? 'Ocultar' : 'Por quê?'}
            </button>
          </div>
          <p className="text-[11px] text-amber-700/85 dark:text-amber-200/75 mt-0.5 leading-relaxed">
            Bate com o esperado nos dois controles → liberado para pacientes. Diverge
            → reprovado e bloqueado.
          </p>
        </div>
      </div>
      {open && (
        <div className="pl-9 pr-1 pt-1 text-[11px] text-amber-700/85 dark:text-amber-200/75 leading-relaxed border-t border-amber-500/15">
          <p className="mt-2">
            <strong>Toda caixa nova de kit imuno precisa ser qualificada antes de uso
            em amostras de paciente</strong> — RDC 786/2023 (rastreabilidade de
            insumos de diagnóstico) + RDC 978/2025 Art.128 (validação de lote
            novo de CQ). A corrida-validação é a forma documentada dessa
            qualificação: rodar os controles positivo e negativo do próprio kit
            e verificar que respondem como o fabricante declara.
          </p>
          <p className="mt-2">
            Se ambos baterem com o esperado, o lote é{' '}
            <strong>liberado automaticamente</strong> e fica disponível pra rotina.
            Qualquer divergência → <strong>lote reprovado</strong>, motivo gravado
            em auditoria, e o lote fica bloqueado (override só com justificativa).
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

function ExpiryWarning({ label, days }: { label: string; days: number }) {
  if (days >= 30) return null;
  const expired = days < 0;
  return (
    <div
      className={[
        'flex items-start gap-2 px-3.5 py-2.5 rounded-xl border text-xs mt-1.5',
        expired
          ? 'bg-red-500/[0.07] border-red-400/20 text-red-500 dark:text-red-400'
          : 'bg-amber-500/[0.07] border-amber-500/20 text-amber-600 dark:text-amber-400',
      ].join(' ')}
    >
      <span className="mt-px shrink-0">{expired ? '✕' : '⚠'}</span>
      <span>
        {expired
          ? `${label} vencido há ${Math.abs(days)} dia${Math.abs(days) !== 1 ? 's' : ''}.`
          : `${label} vence em ${days} dia${days !== 1 ? 's' : ''}.`}
      </span>
    </div>
  );
}

function ReagentOpenAlert() {
  return (
    <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl border text-xs mt-1.5 bg-amber-500/[0.07] border-amber-500/20 text-amber-600 dark:text-amber-400">
      <span className="mt-px shrink-0">⚠</span>
      <span>Reagente não reagente na abertura — inviabiliza uso para CIQ de testes Reagentes.</span>
    </div>
  );
}

// ─── Approval Badge ───────────────────────────────────────────────────────────

/** Aprovação derivada automaticamente — resultadoObtido === resultadoEsperado */
function ApprovalBadge({ conforme }: { conforme: boolean }) {
  return (
    <div
      className={[
        'flex items-center gap-3 px-3.5 py-3 rounded-xl border',
        conforme
          ? 'bg-emerald-500/[0.07] border-emerald-500/25'
          : 'bg-red-500/[0.07] border-red-400/20',
      ].join(' ')}
    >
      <div
        className={[
          'w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm font-bold',
          conforme
            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
            : 'bg-red-500/15 text-red-600 dark:text-red-400',
        ].join(' ')}
      >
        {conforme ? '✓' : '✕'}
      </div>
      <div>
        <p
          className={`text-sm font-semibold ${conforme ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
        >
          {conforme ? 'Aprovado' : 'Não aprovado'}
        </p>
        <p className="text-[10px] text-slate-400 dark:text-white/30 mt-0.5">
          {conforme
            ? 'Resultado conforme o esperado pelo fabricante.'
            : 'Resultado divergente — ação corretiva obrigatória (RDC 978/2025 Art.128).'}
        </p>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CIQImunoFormProps {
  /**
   * Callback de save. Recebe `data` validado + `options` com snapshot +
   * flags de override + `classificacaoImuno` (Fase B1-etapa2). Imuno
   * distingue corrida de validação (qcStatus pendente) vs uso normal.
   */
  onSave: (data: CIQImunoFormData, options?: SaveCIQRunOptions) => Promise<void>;
  isSaving?: boolean;
  onCancel?: () => void;
  /**
   * Fase 2 (2026-04-25) — Pré-fill do form a partir de um lote vinculado à
   * bancada. Quando passado, os campos identificadores do lote (testType,
   * loteControle, datas) são pré-preenchidos e bloqueados — o operador só
   * preenche resultado, reagente e equipamento. Reduz a fricção de seleção
   * manual quando o lab tem um lote oficial vinculado.
   */
  prefillFromLot?: CIQImunoLot;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CIQImunoForm({
  onSave,
  isSaving = false,
  onCancel,
  prefillFromLot,
}: CIQImunoFormProps) {
  const user = useUser();
  const setCurrentView = useAppStore((s) => s.setCurrentView);
  const {
    types: testTypes,
    loading: typesLoading,
    error: typesError,
    addType,
    renameType,
    removeType,
    setManual: setTestTypeManual,
  } = useCIQTestTypes();
  const [showManager, setShowManager] = useState(false);

  // ── Fase D — Equipamento da corrida ───────────────────────────────────────
  const [equipamentoId, setEquipamentoId] = useState<string | null>(null);
  const [equipamentoSel, setEquipamentoSel] = useState<Equipamento | null>(null);

  const [form, setForm] = useState<Partial<CIQImunoFormData>>(() => ({
    resultadoEsperado: 'R',
    dataRealizacao: today(),
    ...(prefillFromLot && {
      testType: prefillFromLot.testType,
      loteControle: prefillFromLot.loteControle,
      aberturaControle: prefillFromLot.aberturaControle,
      validadeControle: prefillFromLot.validadeControle,
    }),
  }));
  // Fase 2 — quando o form é aberto a partir de um lote vinculado, os campos
  // identificadores (tipo + lote + datas) ficam bloqueados. O operador só
  // edita resultado, reagente, controles e equipamento.
  // Operador pode liberar manualmente via "Trocar lote" no banner — útil
  // quando clicou no card errado e não quer cancelar pra reabrir.
  const [unlockedByOperator, setUnlockedByOperator] = useState(false);
  const lockedFromLot = !!prefillFromLot && !unlockedByOperator;
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Em modo manual o "obtido" é capturado por controle (P/N), separado do
  // estado do schema que guarda os dois pares já mapeados (positivo no campo
  // legado `resultadoObtido`, negativo em `resultadoObtidoNegativo`).
  const [obtidoPositivo, setObtidoPositivo] = useState<'R' | 'NR' | undefined>(undefined);
  const [obtidoNegativo, setObtidoNegativo] = useState<'R' | 'NR' | undefined>(undefined);

  // Fase F (2026-04-24) — resolve o tipo de teste para decidir modo manual vs
  // analisador. Quando `manual: true` o form esconde o EquipamentoSelector,
  // pula o EquipmentSetup e delega pro `useManualKitGuard` / `ManualKitPicker`.
  // 2026-04-25: equipamento com `modelo === 'MANUAL'` (kit de teste rápido,
  // sem analisador) também força o fluxo manual independente do tipo de teste —
  // se o equipamento já é declaradamente manual, exigir que o tipo também seja
  // marcado é redundante e bloqueia o operador. Diferença: quando o sinal vem
  // do equipamento, o `EquipamentoSelector` continua visível (ele é a evidência
  // de qual kit-equipamento está em uso); quando vem do testType, o seletor
  // some (testType manual é por kit, sem amarração com equip).
  const currentTestType = testTypes.find((t) => t.name === form.testType) ?? null;
  const isManualByTestType = !!currentTestType?.manual;
  const isManualByEquipamento = equipamentoSel?.modelo === 'MANUAL';
  const isManual = isManualByTestType || isManualByEquipamento;
  // 2026-04-25 (UX-pass) — em qualquer fluxo manual o seletor de equipamento
  // some. O signal canônico do modo manual passa a ser `testType.manual=true`;
  // o equipamento "MANUAL" como gatilho continua funcionando se vier
  // pré-selecionado de outro contexto (ex: navegação a partir do cadastro de
  // equipamento), mas não é mais oferecido como UI de seleção dentro da
  // corrida — economiza um card que não traz informação útil ao operador.
  const showEquipamentoSelector = !isManual;

  // Fase B1-etapa2 — Imuno analisador: apenas reagente (kit) obrigatório por
  // corrida. CQ é por lote (qcStatus), não por corrida — então `controle: false`.
  // Quando qcStatus !== 'aprovado', a corrida é classificada como 'validacao'
  // (o guard atribui automaticamente).
  const insumoGuard = useInsumoFlowGuard({
    module: 'imunologia',
    requiredSlots: { reagente: true },
    equipamentoId,
  });

  // Fase F — Imuno manual: reagente + controle positivo + controle negativo,
  // todos do kit manual. O picker filtra por testType via testTypesCompativeis.
  const manualGuard = useManualKitGuard({
    module: 'imunologia',
    testType: form.testType ?? null,
    requiredSlots: {
      reagente: true,
      controlePositivo: true,
      controleNegativo: true,
    },
  });

  function toIsoDate(ts: { toDate: () => Date } | null): string {
    if (!ts) return '';
    const d = ts.toDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // Pré-preenche campos do reagente a partir do slot ativo. Em modo analisador
  // vem do EquipmentSetup (`insumoGuard.reagente`); em modo manual vem do
  // picker (`manualGuard.resolved.reagente`). O useEffect observa ambos e
  // espelha o que for relevante conforme o modo atual.
  //
  // setState-in-effect justificado: espelhar subscription externa.
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    const reagente = isManual ? manualGuard.resolved.reagente : insumoGuard.reagente;
    if (!reagente) return;
    setForm((prev) => ({
      ...prev,
      loteReagente: reagente.lote,
      fabricanteReagente: reagente.fabricante,
      aberturaReagente: toIsoDate(reagente.dataAbertura),
      validadeReagente: toIsoDate(reagente.validade),
      // Spine spec (2026-04-26): ANVISA também vem do snapshot do Insumo —
      // se cadastrado no produto, propaga; senão fica vazio (operador podia
      // editar antes, agora fica disabled e o branco é admitido — registro
      // ANVISA não é required no schema).
      ...(reagente.registroAnvisa && { registroANVISA: reagente.registroAnvisa }),
    }));
  }, [isManual, insumoGuard.reagente, manualGuard.resolved.reagente]);

  // Em modo manual, pré-preenche também campos do controle a partir do
  // controle positivo escolhido no picker (é o "controle da corrida" registrado
  // no lote CIQ).
  React.useEffect(() => {
    if (!isManual) return;
    const ctrlP = manualGuard.resolved.controlePositivo;
    if (!ctrlP) return;
    setForm((prev) => ({
      ...prev,
      loteControle: ctrlP.lote,
      fabricanteControle: ctrlP.fabricante,
      aberturaControle: toIsoDate(ctrlP.dataAbertura),
      validadeControle: toIsoDate(ctrlP.validade),
    }));
  }, [isManual, manualGuard.resolved.controlePositivo]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function set<K extends keyof CIQImunoFormData>(key: K, value: CIQImunoFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key])
      setErrors((prev) => {
        const n = { ...prev };
        delete n[key];
        return n;
      });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Atualiza dataRealizacao para a data atual no momento do submit.
    // Em modo manual, espelha o par positivo no campo legado (resultadoEsperado/
    // Obtido) e o par negativo nos campos novos. Em modo analisador, mantém
    // o par single conforme o operador preencheu.
    const submitForm: Partial<CIQImunoFormData> = {
      ...form,
      dataRealizacao: today(),
      ...(isManual
        ? {
            // Auto-popula campo legado herdado do fluxo analisador — em kit
            // manual P+N, "status na abertura" é supérfluo (a checagem é feita
            // via controles). Default = 'R' pra satisfazer o schema sem
            // distorcer o significado em corrida manual.
            reagenteStatus: 'R' as const,
            resultadoEsperado: esperadoPositivo,
            resultadoObtido: obtidoPositivo,
            resultadoEsperadoNegativo: esperadoNegativo,
            resultadoObtidoNegativo: obtidoNegativo,
          }
        : {}),
    };
    const result = CIQImunoFormSchema.safeParse(submitForm);

    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      setErrors(Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, v?.[0] ?? ''])));
      const firstErrEl = document.querySelector('[data-field-error]');
      firstErrEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Em modo manual exige polaridade definida nos dois controles e obtido
    // preenchido pra cada — o schema cobre o par negativo via refine; aqui
    // protege a derivação do esperado.
    if (isManual) {
      const blockingErrors: Record<string, string> = {};
      if (esperadoPositivo === undefined) {
        blockingErrors.resultadoEsperado =
          'Defina a polaridade Positiva no produto do controle positivo.';
      }
      if (esperadoNegativo === undefined) {
        blockingErrors.resultadoEsperadoNegativo =
          'Defina a polaridade Negativa no produto do controle negativo.';
      }
      if (Object.keys(blockingErrors).length > 0) {
        setErrors(blockingErrors);
        return;
      }
    }

    // Fase F: em modo manual não exige equipamento; em modo analisador exige.
    if (!isManual) {
      if (!equipamentoId || !equipamentoSel) {
        setErrors({ equipamento: 'Selecione o equipamento em que a corrida está sendo feita.' });
        return;
      }
    }

    // Conferência + override auditado — rota depende do modo.
    const activeGuard = isManual ? manualGuard : insumoGuard;
    const guardFlags = await activeGuard.prepareForSave();
    if (!guardFlags) {
      setErrors({
        insumos: isManual
          ? 'Selecione o reagente e os controles positivo/negativo do kit e confirme antes de salvar.'
          : 'Conferência obrigatória do setup. Configure o reagente ativo e confirme antes de salvar.',
      });
      return;
    }

    setErrors({});
    const snapshot = activeGuard.getSnapshots();
    const saveOptions: SaveCIQRunOptions = {
      insumosSnapshot: snapshot,
      ...(guardFlags.insumoVencidoOverride && { insumoVencidoOverride: true }),
      ...(guardFlags.qcNaoValidado && { qcNaoValidado: true }),
      ...(guardFlags.overrideMotivo && { overrideMotivo: guardFlags.overrideMotivo }),
      ...(guardFlags.classificacaoImuno && { classificacaoImuno: guardFlags.classificacaoImuno }),
      ...(isManual
        ? { manual: true }
        : {
            equipamentoId: equipamentoId!,
            equipamentoSnapshot: buildEquipamentoSnapshot(equipamentoSel!),
          }),
    };
    await onSave(result.data, saveOptions);

    // afterSave — incrementa runCount dos insumos. Em Imuno manual com
    // classificacao=validacao, transiciona qcStatus do reagente do kit
    // (aprovado quando ambos os controles bateram, reprovado caso contrário).
    const isConforme = isManual
      ? obtidoPositivo === esperadoPositivo && obtidoNegativo === esperadoNegativo
      : result.data.resultadoObtido === result.data.resultadoEsperado;

    if (isManual) {
      const motivoReprovacao = !isConforme
        ? [
            obtidoPositivo !== esperadoPositivo &&
              `controle positivo obtido ${obtidoPositivo ?? '?'} (esperado ${esperadoPositivo ?? '?'})`,
            obtidoNegativo !== esperadoNegativo &&
              `controle negativo obtido ${obtidoNegativo ?? '?'} (esperado ${esperadoNegativo ?? '?'})`,
          ]
            .filter(Boolean)
            .join('; ')
        : undefined;
      void manualGuard.afterSave({
        runId: '',
        wasConforme: isConforme,
        ...(saveOptions.classificacaoImuno && {
          classificacaoImuno: saveOptions.classificacaoImuno,
        }),
        userId: user?.uid ?? '',
        userName: user?.displayName ?? user?.email ?? 'Operador',
        ...(motivoReprovacao && { motivoReprovacao }),
      });
    } else {
      // Analisador (não manual): incrementa runCount via insumoGuard.
      // insumoGuard tem o mesmo afterSave clássico — sem auto-aprovação.
      void insumoGuard.afterSave({ runId: '', wasConforme: isConforme });
    }
  }

  const ctrlDays = form.validadeControle ? daysToExpiry(form.validadeControle) : null;
  const reagDays = form.validadeReagente ? daysToExpiry(form.validadeReagente) : null;

  // ── Esperado/obtido — derivação por modo ────────────────────────────────
  const ctrlPositivo =
    isManual && manualGuard.resolved.controlePositivo?.tipo === 'controle'
      ? (manualGuard.resolved.controlePositivo as InsumoControle)
      : null;
  const ctrlNegativo =
    isManual && manualGuard.resolved.controleNegativo?.tipo === 'controle'
      ? (manualGuard.resolved.controleNegativo as InsumoControle)
      : null;
  const esperadoPositivo = useMemo(() => esperadoFromControle(ctrlPositivo), [ctrlPositivo]);
  const esperadoNegativo = useMemo(() => esperadoFromControle(ctrlNegativo), [ctrlNegativo]);

  // Veredito unificado:
  //   - manual: ambos os pares (P+N) precisam bater
  //   - analisador: o par single (resultadoEsperado === resultadoObtido)
  const naoConforme = isManual
    ? (obtidoPositivo !== undefined &&
        esperadoPositivo !== undefined &&
        obtidoPositivo !== esperadoPositivo) ||
      (obtidoNegativo !== undefined &&
        esperadoNegativo !== undefined &&
        obtidoNegativo !== esperadoNegativo)
    : form.resultadoObtido !== undefined &&
      form.resultadoEsperado !== undefined &&
      form.resultadoObtido !== form.resultadoEsperado;
  const aprovacaoDerived = isManual
    ? obtidoPositivo !== undefined &&
      obtidoNegativo !== undefined &&
      esperadoPositivo !== undefined &&
      esperadoNegativo !== undefined
    : form.resultadoObtido !== undefined && form.resultadoEsperado !== undefined;

  // Banner "Modo validação": reagente em uso ainda não está aprovado.
  // Manual → reagente do kit (manualGuard); analisador → reagente do setup.
  const reagenteAtivo = isManual ? manualGuard.resolved.reagente : insumoGuard.reagente;
  const isValidacaoMode =
    !!reagenteAtivo &&
    reagenteAtivo.tipo === 'reagente' &&
    reagenteAtivo.qcStatus !== 'aprovado' &&
    reagenteAtivo.qcStatus !== 'reprovado';

  // ── Auto-fill: simplificação radical da Bancada (2026-04-26) ─────────────
  // Quando o operador escolhe um Insumo no picker (ManualKitPicker ou
  // EquipmentSetup), os useEffects acima populam os campos lote/fabricante/
  // datas a partir do snapshot. Nesse cenário os inputs ficam bloqueados —
  // edição passa pelo picker, não por digitação livre. Elimina a duplicação
  // entre Layer 3 (Insumo) e a corrida, alinhado com mental model 3-camadas.
  // Em analisador, controle não vem de picker (entra manual) — só reagente
  // bloqueia. `lockedFromLot` continua atuando independente quando a corrida
  // veio de um CIQImunoLot vinculado.
  const controleAutoFilled = !!manualGuard.resolved.controlePositivo;
  const reagenteAutoFilled = isManual
    ? !!manualGuard.resolved.reagente
    : !!insumoGuard.reagente;

  // Data de hoje formatada para exibição
  const todayFormatted = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-7" noValidate>
      {/* ── Banner: corrida iniciada a partir de lote vinculado ──────────────── */}
      {prefillFromLot && (
        <div
          className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
            prefillFromLot.setupType === 'principal'
              ? 'bg-emerald-50 dark:bg-emerald-500/[0.06] border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
              : 'bg-blue-50 dark:bg-blue-500/[0.06] border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400'
          }`}
        >
          <span className="mt-0.5 shrink-0">
            <svg width="14" height="14" viewBox="0 0 13 13" fill="none" aria-hidden>
              <path
                d="M6.5 1.5l3 3-1 1 1.5 1.5-1 1L7 6.5l-3 3v-2L6.5 5l-1-1 1-1z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="text-xs leading-relaxed flex-1">
            <p className="font-semibold">
              Corrida vinculada · {prefillFromLot.testType} · Lote {prefillFromLot.loteControle}
            </p>
            <p className="opacity-80 mt-0.5">
              {prefillFromLot.setupType === 'principal'
                ? 'Setup oficial em rotina. Tipo, lote e datas estão bloqueados.'
                : 'Lote em validação paralela. Corrida será classificada como validação.'}
            </p>
          </div>
          {!unlockedByOperator && (
            <button
              type="button"
              onClick={() => setUnlockedByOperator(true)}
              className="shrink-0 underline text-[11px] font-medium opacity-80 hover:opacity-100"
              title="Libera tipo, lote e datas para edição manual"
            >
              Trocar lote
            </button>
          )}
        </div>
      )}

      {/* ── Operador ───────────────────────────────────────────────────────── */}
      <div>
        <SectionTitle>Operador</SectionTitle>
        <div className="space-y-3">
          {/* Responsável — read-only, vem do usuário logado */}
          <div
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl
                          bg-slate-50 dark:bg-white/[0.04]
                          border border-slate-200 dark:border-white/[0.07]"
          >
            <div
              className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/25
                            flex items-center justify-center shrink-0
                            text-emerald-600 dark:text-emerald-400 text-xs font-bold select-none"
            >
              {(user?.displayName ?? user?.email ?? 'O').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 dark:text-white/80 truncate">
                {user?.displayName ?? user?.email ?? 'Operador'}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-white/30 mt-0.5">
                Data e hora registradas automaticamente ao salvar
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="cargo" required>
              Cargo profissional
            </Label>
            <select
              id="cargo"
              title="Cargo profissional do operador"
              value={form.cargo ?? ''}
              onChange={(e) => set('cargo', e.target.value as CIQImunoFormData['cargo'])}
              className={errors.cargo ? INPUT_ERR : INPUT}
            >
              <option value="" disabled>
                Selecione o cargo…
              </option>
              {CARGO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <FieldError msg={errors.cargo} />
          </div>
        </div>
      </div>

      {/* ── Tipo de Teste ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30">
            Tipo de Teste
          </p>
          <button
            type="button"
            onClick={() => setShowManager(true)}
            disabled={typesLoading}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px]
                       text-slate-400 dark:text-white/30
                       hover:text-slate-700 dark:hover:text-white/60
                       hover:bg-slate-100 dark:hover:bg-white/[0.06]
                       border border-transparent hover:border-slate-200 dark:hover:border-white/[0.08]
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all -mt-1"
            title={typesLoading ? 'Aguarde o carregamento…' : 'Gerenciar tipos de teste'}
          >
            <SettingsIcon />
            Gerenciar
          </button>
        </div>
        <div>
          <Label htmlFor="testType" required>
            Imunoensaio
          </Label>
          {typesError && !typesLoading && (
            <div
              className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl border text-xs mb-2
                            bg-red-500/[0.07] border-red-500/20 text-red-600 dark:text-red-400"
            >
              <span className="mt-px shrink-0">⚠</span>
              <span>Não foi possível carregar os tipos de teste: {typesError}</span>
            </div>
          )}
          {typesLoading ? (
            <div
              className={`${INPUT} flex items-center gap-2 text-slate-400 dark:text-white/25 cursor-default`}
            >
              <svg className="animate-spin w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeOpacity="0.25"
                />
                <path
                  d="M22 12a10 10 0 00-10-10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              Carregando tipos de teste…
            </div>
          ) : testTypes.length === 0 ? (
            <div
              className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl border text-xs mt-0.5
                            bg-amber-500/[0.07] border-amber-500/20 text-amber-600 dark:text-amber-400"
            >
              <span className="mt-px shrink-0">⚠</span>
              <span>
                Nenhum tipo de teste cadastrado.{' '}
                <button
                  type="button"
                  onClick={() => setShowManager(true)}
                  className="underline font-medium"
                >
                  Cadastre um aqui
                </button>{' '}
                para continuar.
              </span>
            </div>
          ) : (
            <select
              id="testType"
              title="Tipo de imunoensaio"
              value={form.testType ?? ''}
              onChange={(e) => set('testType', e.target.value)}
              disabled={lockedFromLot}
              className={errors.testType ? INPUT_ERR : INPUT}
            >
              <option value="" disabled>
                Selecione o tipo de teste…
              </option>
              {testTypes.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                  {t.manual ? ' · manual' : ''}
                </option>
              ))}
            </select>
          )}
          <FieldError msg={errors.testType} />
        </div>
      </div>

      {/* ── Manager Modal ──────────────────────────────────────────────────── */}
      {showManager && (
        <CIQTestTypeManager
          types={testTypes}
          addType={addType}
          renameType={renameType}
          removeType={removeType}
          setManual={setTestTypeManual}
          onClose={() => setShowManager(false)}
        />
      )}

      {/* Equipamento + Insumos — layout muda conforme o teste seja de
          analisador ou manual (Fase F 2026-04-24, ajuste 2026-04-25).
          Quando o motivo do fluxo manual é o EQUIPAMENTO ser do tipo MANUAL,
          o seletor permanece visível (operador precisa ver/trocar o kit-equip);
          quando o motivo é o testType.manual=true, o seletor some (kit manual
          puro, sem amarração com equipamento). */}
      {showEquipamentoSelector && (
        <div>
          <SectionTitle>Equipamento</SectionTitle>
          <EquipamentoSelector
            module="imunologia"
            value={equipamentoId}
            onChange={(id, eq) => {
              setEquipamentoId(id);
              setEquipamentoSel(eq);
              if (errors.equipamento) {
                setErrors((prev) => {
                  const n = { ...prev };
                  delete n.equipamento;
                  return n;
                });
              }
            }}
            required
          />
          {errors.equipamento && <FieldError msg={errors.equipamento} />}
        </div>
      )}

      {!isManual ? (
        /* Conferência de insumos (Fase B1-etapa2) — Imuno analisador:
           reagente obrigatório, controle por LOTE (qcStatus), não por corrida. */
        <div>
          <SectionTitle>Insumos em uso</SectionTitle>
          <ConferenciaInsumoAtivo
            module="imunologia"
            requiredSlots={{ reagente: true }}
            equipamentoId={equipamentoId}
            confirmed={insumoGuard.confirmed}
            onConfirmedChange={insumoGuard.setConfirmed}
            onConfigurarSetup={() => setCurrentView('insumos')}
          />
          {errors.insumos && <FieldError msg={errors.insumos} />}
        </div>
      ) : (
        /* Fase F — kit manual: operador escolhe o kit na hora
           (reagente + controles positivo/negativo). */
        <div>
          <SectionTitle>Kit do teste manual</SectionTitle>
          <ManualKitPicker
            title={`Kit manual · ${form.testType ?? 'teste'}`}
            subtitle={
              isManualByEquipamento
                ? `Equipamento ${equipamentoSel?.name ?? ''} é manual — escolha o lote do reagente e dos controles do kit em uso.`
                : 'Escolha o lote do reagente e dos controles do próprio kit. A corrida será registrada sem equipamento.'
            }
            slots={[
              {
                slot: 'reagente',
                label: 'Reagente',
                required: true,
                emptyMessage:
                  'Nenhum reagente ativo cadastrado para imunologia. Cadastre em Insumos antes de salvar.',
              },
              {
                slot: 'controlePositivo',
                label: 'Controle Positivo',
                required: true,
                emptyMessage: 'Nenhum controle ativo cadastrado para imunologia.',
              },
              {
                slot: 'controleNegativo',
                label: 'Controle Negativo',
                required: true,
                emptyMessage: 'Nenhum controle ativo cadastrado para imunologia.',
              },
            ]}
            selection={manualGuard.selection}
            resolved={manualGuard.resolved}
            candidates={manualGuard.candidates}
            onSlotChange={manualGuard.setSlot}
            confirmed={manualGuard.confirmed}
            onConfirmedChange={manualGuard.setConfirmed}
            onCadastrarInsumo={() => setCurrentView('insumos')}
          />
          {errors.insumos && <FieldError msg={errors.insumos} />}
        </div>
      )}

      {/* ── Controle (kit positivo/negativo — preenchido manualmente em Imuno) ─ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30">
            Controle Interno
          </p>
          {(controleAutoFilled || lockedFromLot) && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-violet-500/[0.08] border-violet-500/25 text-violet-700 dark:text-violet-300"
              title={
                lockedFromLot
                  ? 'Campos vêm do lote vinculado.'
                  : 'Campos preenchidos a partir do controle escolhido no picker. Pra alterar, troque pelo picker.'
              }
            >
              <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor" aria-hidden>
                <path d="M4.5 0.5l1 2.5 2.5 0.5-2 1.5 0.5 2.5-2-1.5-2 1.5 0.5-2.5-2-1.5 2.5-0.5z" />
              </svg>
              Auto-preenchido
            </span>
          )}
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="loteControle" required>
                Lote do controle
              </Label>
              <input
                id="loteControle"
                type="text"
                placeholder="ex: L2024-001"
                value={form.loteControle ?? ''}
                onChange={(e) => set('loteControle', e.target.value)}
                disabled={lockedFromLot || controleAutoFilled}
                className={errors.loteControle ? INPUT_ERR : INPUT}
              />
              <FieldError msg={errors.loteControle} />
            </div>

            <div>
              <Label htmlFor="fabricanteControle" required>
                Fabricante
              </Label>
              <input
                id="fabricanteControle"
                type="text"
                placeholder="ex: BioSystems"
                value={form.fabricanteControle ?? ''}
                onChange={(e) => set('fabricanteControle', e.target.value)}
                disabled={controleAutoFilled}
                className={errors.fabricanteControle ? INPUT_ERR : INPUT}
              />
              <FieldError msg={errors.fabricanteControle} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="aberturaControle" required>
                Abertura do controle
              </Label>
              <input
                id="aberturaControle"
                type="date"
                title="Data de abertura do controle"
                value={form.aberturaControle ?? ''}
                onChange={(e) => set('aberturaControle', e.target.value)}
                disabled={lockedFromLot || controleAutoFilled}
                className={errors.aberturaControle ? INPUT_ERR : INPUT}
              />
              <FieldError msg={errors.aberturaControle} />
            </div>

            <div>
              <Label htmlFor="validadeControle" required>
                Validade do controle
              </Label>
              <input
                id="validadeControle"
                type="date"
                title="Data de validade do controle"
                value={form.validadeControle ?? ''}
                onChange={(e) => set('validadeControle', e.target.value)}
                disabled={lockedFromLot || controleAutoFilled}
                className={errors.validadeControle ? INPUT_ERR : INPUT}
              />
              <FieldError msg={errors.validadeControle} />
              {ctrlDays !== null && <ExpiryWarning label="Controle" days={ctrlDays} />}
            </div>
          </div>
        </div>
      </div>

      {/* ── Reagente ───────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30">
            Reagente
          </p>
          {reagenteAutoFilled && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-violet-500/[0.08] border-violet-500/25 text-violet-700 dark:text-violet-300"
              title={
                isManual
                  ? 'Campos preenchidos a partir do reagente do kit. Pra alterar, troque pelo picker.'
                  : 'Campos preenchidos a partir do reagente em uso no equipamento. Pra alterar, troque o setup.'
              }
            >
              <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor" aria-hidden>
                <path d="M4.5 0.5l1 2.5 2.5 0.5-2 1.5 0.5 2.5-2-1.5-2 1.5 0.5-2.5-2-1.5 2.5-0.5z" />
              </svg>
              Auto-preenchido
            </span>
          )}
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="loteReagente" required>
                Lote do reagente
              </Label>
              <input
                id="loteReagente"
                type="text"
                placeholder="ex: R2024-042"
                value={form.loteReagente ?? ''}
                onChange={(e) => set('loteReagente', e.target.value)}
                disabled={reagenteAutoFilled}
                className={errors.loteReagente ? INPUT_ERR : INPUT}
              />
              <FieldError msg={errors.loteReagente} />
            </div>

            <div>
              <Label htmlFor="fabricanteReagente" required>
                Fabricante
              </Label>
              <input
                id="fabricanteReagente"
                type="text"
                placeholder="ex: Abbott, Roche"
                value={form.fabricanteReagente ?? ''}
                onChange={(e) => set('fabricanteReagente', e.target.value)}
                disabled={reagenteAutoFilled}
                className={errors.fabricanteReagente ? INPUT_ERR : INPUT}
              />
              <FieldError msg={errors.fabricanteReagente} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="codigoKit">Código do kit</Label>
              <input
                id="codigoKit"
                type="text"
                placeholder="ex: 04L59-20"
                value={form.codigoKit ?? ''}
                onChange={(e) => set('codigoKit', e.target.value || undefined)}
                className={INPUT}
              />
            </div>

            <div>
              <Label htmlFor="registroANVISA">Registro ANVISA</Label>
              <input
                id="registroANVISA"
                type="text"
                placeholder="ex: 10269230117"
                value={form.registroANVISA ?? ''}
                onChange={(e) => set('registroANVISA', e.target.value || undefined)}
                disabled={reagenteAutoFilled}
                className={INPUT}
              />
            </div>
          </div>

          {/* Em kit manual P+N o "status na abertura" é supérfluo — o kit é
              o próprio reagente do teste e a checagem de funcionamento ocorre
              via controles positivo/negativo nesta mesma corrida. Campo só
              faz sentido em fluxo analisador, onde o operador pode rodar o
              reagente do estoque pra checar reatividade na abertura. */}
          {!isManual && (
            <div>
              <Label htmlFor="reagenteStatus" required>
                Status na abertura do kit
              </Label>
              <RNRToggle
                id="reagenteStatus"
                value={form.reagenteStatus}
                onChange={(v) => set('reagenteStatus', v)}
                error={errors.reagenteStatus}
              />
              {form.reagenteStatus === 'NR' && <ReagentOpenAlert />}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="aberturaReagente" required>
                Abertura do reagente
              </Label>
              <input
                id="aberturaReagente"
                type="date"
                title="Data de abertura do reagente"
                value={form.aberturaReagente ?? ''}
                onChange={(e) => set('aberturaReagente', e.target.value)}
                disabled={reagenteAutoFilled}
                className={errors.aberturaReagente ? INPUT_ERR : INPUT}
              />
              <FieldError msg={errors.aberturaReagente} />
            </div>

            <div>
              <Label htmlFor="validadeReagente" required>
                Validade do reagente
              </Label>
              <input
                id="validadeReagente"
                type="date"
                title="Data de validade do reagente"
                value={form.validadeReagente ?? ''}
                onChange={(e) => set('validadeReagente', e.target.value)}
                disabled={reagenteAutoFilled}
                className={errors.validadeReagente ? INPUT_ERR : INPUT}
              />
              <FieldError msg={errors.validadeReagente} />
              {reagDays !== null && <ExpiryWarning label="Reagente" days={reagDays} />}
            </div>
          </div>
        </div>
      </div>

      {/* ── Banner Modo Validação ───────────────────────────────────────────
          Aparece quando o reagente em uso ainda não tem qcStatus='aprovado'.
          Avisa que esta corrida é a corrida-validação que vai liberar (ou
          reprovar) o lote — e não exige override modal pra prosseguir. */}
      {isValidacaoMode && (
        <ValidationBanner
          {...(reagenteAtivo?.nomeComercial && { reagenteNome: reagenteAtivo.nomeComercial })}
          {...(reagenteAtivo?.lote && { reagenteLote: reagenteAtivo.lote })}
        />
      )}

      {/* ── Resultado ────────────────────────────────────────────────────────
          Manual (kit P+N) → dois pares com esperado read-only derivado da
          polaridade do controle. Veredito = ambos batem.
          Analisador → par single com esperado configurável (legacy). */}
      <div>
        <SectionTitle>Resultado</SectionTitle>
        <div className="space-y-5">
          {isManual ? (
            <>
              {/* Controle Positivo */}
              <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] p-4 space-y-3 bg-slate-50/40 dark:bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-700 dark:text-white/75">
                    Controle Positivo
                  </p>
                  {ctrlPositivo?.nomeComercial && (
                    <p className="text-[11px] text-slate-400 dark:text-white/35 truncate ml-2">
                      {ctrlPositivo.nomeComercial}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="esperadoPositivo">Esperado (do lote)</Label>
                  <EsperadoBadge esperado={esperadoPositivo} controle={ctrlPositivo} />
                  {errors.resultadoEsperado && <FieldError msg={errors.resultadoEsperado} />}
                </div>
                <div>
                  <Label htmlFor="obtidoPositivo" required>
                    Obtido
                  </Label>
                  <RNRToggle
                    id="obtidoPositivo"
                    value={obtidoPositivo}
                    onChange={(v) => {
                      setObtidoPositivo(v);
                      if (errors.resultadoObtido)
                        setErrors((prev) => {
                          const n = { ...prev };
                          delete n.resultadoObtido;
                          return n;
                        });
                    }}
                    error={errors.resultadoObtido}
                  />
                  <InlineConformidadeBadge
                    esperado={esperadoPositivo}
                    obtido={obtidoPositivo}
                  />
                </div>
              </div>

              {/* Controle Negativo */}
              <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] p-4 space-y-3 bg-slate-50/40 dark:bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-700 dark:text-white/75">
                    Controle Negativo
                  </p>
                  {ctrlNegativo?.nomeComercial && (
                    <p className="text-[11px] text-slate-400 dark:text-white/35 truncate ml-2">
                      {ctrlNegativo.nomeComercial}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="esperadoNegativo">Esperado (do lote)</Label>
                  <EsperadoBadge esperado={esperadoNegativo} controle={ctrlNegativo} />
                  {errors.resultadoEsperadoNegativo && (
                    <FieldError msg={errors.resultadoEsperadoNegativo} />
                  )}
                </div>
                <div>
                  <Label htmlFor="obtidoNegativo" required>
                    Obtido
                  </Label>
                  <RNRToggle
                    id="obtidoNegativo"
                    value={obtidoNegativo}
                    onChange={(v) => {
                      setObtidoNegativo(v);
                      if (errors.resultadoObtidoNegativo)
                        setErrors((prev) => {
                          const n = { ...prev };
                          delete n.resultadoObtidoNegativo;
                          return n;
                        });
                    }}
                    error={errors.resultadoObtidoNegativo}
                  />
                  <InlineConformidadeBadge
                    esperado={esperadoNegativo}
                    obtido={obtidoNegativo}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <Label htmlFor="resultadoEsperado" required>
                  Resultado esperado (fabricante)
                </Label>
                <RNRToggle
                  id="resultadoEsperado"
                  value={form.resultadoEsperado}
                  onChange={(v) => set('resultadoEsperado', v)}
                  error={errors.resultadoEsperado}
                />
              </div>

              <div>
                <Label htmlFor="resultadoObtido" required>
                  Resultado obtido
                </Label>
                <RNRToggle
                  id="resultadoObtido"
                  value={form.resultadoObtido}
                  onChange={(v) => set('resultadoObtido', v)}
                  error={errors.resultadoObtido}
                />
              </div>
            </>
          )}

          {/* Aprovação — derivada automaticamente, separada do resultado */}
          {aprovacaoDerived && (
            <div>
              <Label htmlFor="aprovacao">
                {isManual ? 'Veredito da corrida' : 'Aprovação'}
              </Label>
              <ApprovalBadge conforme={!naoConforme} />
              {isManual && isValidacaoMode && (
                <p className="text-[11px] text-slate-500 dark:text-white/40 mt-1.5 ml-0.5">
                  {!naoConforme
                    ? 'Lote será aprovado automaticamente após salvar.'
                    : 'Lote será reprovado automaticamente — motivo registrado em auditoria.'}
                </p>
              )}
            </div>
          )}

          {/* Data de realização — automática, não editável */}
          <div>
            <Label htmlFor="dataRealizacao">Data de realização</Label>
            <div
              id="dataRealizacao"
              className="w-full px-3.5 py-2.5 rounded-xl flex items-center gap-2
                         bg-slate-50 dark:bg-white/[0.04]
                         border border-slate-200 dark:border-white/[0.07]
                         cursor-default select-none"
            >
              <span className="text-sm text-slate-700 dark:text-white/65">{todayFormatted}</span>
              <span className="text-xs text-slate-400 dark:text-white/25">
                · hora exata capturada ao registrar
              </span>
            </div>
          </div>

          {/* Ação corretiva — visível sempre que há não conformidade */}
          {naoConforme && (
            <div>
              <Label htmlFor="acaoCorretiva" required>
                Ação corretiva (RDC 978/2025 Art.128)
              </Label>
              <textarea
                id="acaoCorretiva"
                rows={3}
                placeholder="Descreva a causa raiz, decisão tomada e responsável…"
                value={form.acaoCorretiva ?? ''}
                onChange={(e) => set('acaoCorretiva', e.target.value || undefined)}
                className={[
                  errors.acaoCorretiva ? INPUT_ERR : INPUT,
                  'resize-none leading-relaxed',
                ].join(' ')}
              />
              {/* Fase 3b — contador de caracteres com mín 20 (RDC: descrição substantiva) */}
              <div className="flex items-center justify-between mt-1">
                <FieldError msg={errors.acaoCorretiva} />
                <span
                  className={`ml-auto text-[10px] font-mono ${
                    (form.acaoCorretiva?.trim().length ?? 0) >= 20
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {form.acaoCorretiva?.trim().length ?? 0}/20 mín
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Notificação sanitária — só aparece em não conformidade ─────────── */}
      {naoConforme && (
        <div>
          <SectionTitle>Notificação Sanitária</SectionTitle>
          <p className="text-[11px] text-slate-500 dark:text-white/40 -mt-2 mb-4 leading-relaxed">
            Queixas técnicas e eventos adversos de produtos para saúde devem ser notificados ao
            NOTIVISA (RDC 67/2009 + RDC 551/2021). Prazo: até 72h para eventos graves.
          </p>
          {/* Fase 3b — Prazo dinâmico: calcula horas desde dataRealizacao
              e sinaliza visualmente o tier regulatório (72h evento grave / 30d QT). */}
          {form.dataRealizacao && (() => {
            const [y, m, d] = form.dataRealizacao.split('-').map(Number);
            const realizado = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
            const horas = Math.floor((Date.now() - realizado) / (1000 * 60 * 60));
            if (horas < 0) return null;
            const tier =
              horas >= 24 * 30
                ? { cls: 'bg-red-50 dark:bg-red-500/[0.08] border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-400', label: 'Prazo de 30 dias excedido' }
                : horas >= 72
                  ? { cls: 'bg-amber-50 dark:bg-amber-500/[0.08] border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-400', label: 'Prazo de 72h (evento grave) excedido' }
                  : horas >= 48
                    ? { cls: 'bg-amber-50 dark:bg-amber-500/[0.06] border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400', label: `${72 - horas}h restantes (evento grave)` }
                    : { cls: 'bg-blue-50 dark:bg-blue-500/[0.06] border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400', label: `${horas}h desde a realização` };
            return (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] font-medium mb-3 ${tier.cls}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                {tier.label}
              </div>
            );
          })()}
          <div className="space-y-4">
            <div>
              <Label htmlFor="notivisaTipo">Tipo de notificação</Label>
              <select
                id="notivisaTipo"
                value={form.notivisaTipo ?? ''}
                onChange={(e) =>
                  set(
                    'notivisaTipo',
                    (e.target.value || undefined) as
                      | 'queixa_tecnica'
                      | 'evento_adverso'
                      | undefined,
                  )
                }
                className={INPUT}
              >
                <option value="">— selecione —</option>
                <option value="queixa_tecnica">
                  Queixa Técnica (desvio de qualidade do produto)
                </option>
                <option value="evento_adverso">Evento Adverso (impacto clínico)</option>
              </select>
            </div>

            <div>
              <Label htmlFor="notivisaStatus">Status da notificação</Label>
              <select
                id="notivisaStatus"
                value={form.notivisaStatus ?? ''}
                onChange={(e) =>
                  set(
                    'notivisaStatus',
                    (e.target.value || undefined) as
                      | 'pendente'
                      | 'notificado'
                      | 'dispensado'
                      | undefined,
                  )
                }
                className={INPUT}
              >
                <option value="">— selecione —</option>
                <option value="pendente">Pendente — investigação em andamento</option>
                <option value="notificado">Notificado — protocolo emitido</option>
                <option value="dispensado">
                  Dispensado — causa operacional, não defeito de produto
                </option>
              </select>
            </div>

            {form.notivisaStatus === 'notificado' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="notivisaProtocolo" required>
                    Protocolo NOTIVISA
                  </Label>
                  <input
                    id="notivisaProtocolo"
                    type="text"
                    placeholder="ex: 2026.01.0001234"
                    value={form.notivisaProtocolo ?? ''}
                    onChange={(e) => set('notivisaProtocolo', e.target.value || undefined)}
                    className={errors.notivisaProtocolo ? INPUT_ERR : INPUT}
                  />
                  <FieldError msg={errors.notivisaProtocolo} />
                </div>
                <div>
                  <Label htmlFor="notivisaDataEnvio" required>
                    Data de envio
                  </Label>
                  <input
                    id="notivisaDataEnvio"
                    type="date"
                    value={form.notivisaDataEnvio ?? ''}
                    onChange={(e) => set('notivisaDataEnvio', e.target.value || undefined)}
                    className={errors.notivisaDataEnvio ? INPUT_ERR : INPUT}
                  />
                  <FieldError msg={errors.notivisaDataEnvio} />
                </div>
              </div>
            )}

            {form.notivisaStatus === 'dispensado' && (
              <div>
                <Label htmlFor="notivisaJustificativa" required>
                  Justificativa da dispensa
                </Label>
                <textarea
                  id="notivisaJustificativa"
                  rows={3}
                  placeholder="ex: Causa raiz identificada como erro de armazenamento (quebra de cadeia fria local); lote do kit reprocessado sem falhas."
                  value={form.notivisaJustificativa ?? ''}
                  onChange={(e) => set('notivisaJustificativa', e.target.value || undefined)}
                  className={[
                    errors.notivisaJustificativa ? INPUT_ERR : INPUT,
                    'resize-none leading-relaxed',
                  ].join(' ')}
                />
                <FieldError msg={errors.notivisaJustificativa} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Dados adicionais (opcional, colapsado por default) ──────────────
          Equipamento/analisador e temperatura ambiente são metadados legacy
          (anteriores ao EquipamentoSelector da Fase D). Em manual são
          irrelevantes; em analisador costumam ser redundantes com o
          equipamento estruturado. Esconder por default reduz a altura do
          formulário e baixa a fricção pra concluir a corrida — o operador
          que precisa registrar pode expandir. */}
      <details className="group rounded-xl border border-slate-200 dark:border-white/[0.07] bg-slate-50/50 dark:bg-white/[0.02] open:bg-white dark:open:bg-white/[0.03]">
        <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3 text-xs font-medium text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/70 transition-colors">
          <span className="flex items-center gap-2">
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              aria-hidden
              className="transition-transform group-open:rotate-90 text-slate-400 dark:text-white/30"
            >
              <path d="M3 1.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Dados adicionais
          </span>
          <span className="text-[10px] text-slate-400 dark:text-white/30">opcional</span>
        </summary>
        <div className="px-4 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="equipamento">Equipamento / analisador</Label>
            <input
              id="equipamento"
              type="text"
              placeholder="ex: Mini VIDAS, Architect i1000"
              value={form.equipamento ?? ''}
              onChange={(e) => set('equipamento', e.target.value || undefined)}
              className={INPUT}
            />
          </div>

          <div>
            <Label htmlFor="temperaturaAmbiente">Temperatura ambiente (°C)</Label>
            <input
              id="temperaturaAmbiente"
              type="number"
              step="0.1"
              min="-10"
              max="50"
              placeholder="ex: 22.5"
              title="Temperatura ambiente em graus Celsius"
              value={form.temperaturaAmbiente ?? ''}
              onChange={(e) =>
                set('temperaturaAmbiente', e.target.value ? Number(e.target.value) : undefined)
              }
              className={INPUT}
            />
          </div>
        </div>
      </details>

      {/* ── Ações ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-3 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.1]
                       text-sm text-slate-500 dark:text-white/50
                       hover:text-slate-800 dark:hover:text-white/80
                       hover:border-slate-300 dark:hover:border-white/[0.2]
                       disabled:opacity-40 transition-all"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={isSaving}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all
                     bg-emerald-500 hover:bg-emerald-400 text-white
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Salvando…' : 'Registrar corrida'}
        </button>
      </div>

      {(isManual ? manualGuard : insumoGuard).overrideContext && (
        <OverrideModal
          open={(isManual ? manualGuard : insumoGuard).isOverrideOpen}
          context={(isManual ? manualGuard : insumoGuard).overrideContext!}
          onCancel={(isManual ? manualGuard : insumoGuard).closeOverride}
          onConfirm={({ justificativa }) => {
            (isManual ? manualGuard : insumoGuard).confirmOverride(justificativa);
          }}
        />
      )}
    </form>
  );
}
