/**
 * NovoLoteModal — fluxo de cadastro em 2 etapas (Fase C — 2026-04-21).
 *
 * Etapa 1: escolher produto do catálogo (ou botão "cadastrar novo produto")
 * Etapa 2: preencher dados do lote (número, validade, abertura, estabilidade)
 *
 * Racional: Produto é estável e cadastrado uma vez (ABX Diluent Horiba). Cada
 * caixa nova só exige os dados do LOTE (número + datas). Reduz erro de digitação
 * e fricção operacional drasticamente.
 *
 * Validações do lote:
 *   - validade > hoje (senão warning no submit — não bloqueia pra suportar
 *     lotes já vencidos mas que o lab quer registrar o descarte)
 *   - dataAbertura <= validade (hard bloqueio — erro físico)
 *   - estabilidade 0-365 (opcional)
 */

import React, { useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useUser } from '../../../store/useAuthStore';
import { useProdutos } from '../hooks/useProdutos';
import { createInsumo } from '../services/insumosFirebaseService';
import { ProdutoFormModal } from './ProdutoFormModal';
import { useFornecedores } from '../../fornecedores/hooks/useFornecedores';
import { useNotasFiscais } from '../../fornecedores/hooks/useNotasFiscais';
import { NotaFiscalFormModal } from '../../fornecedores/components/NotaFiscalFormModal';
import { formatCnpj } from '../../fornecedores/types/Fornecedor';
import type { InsumoTipo, InsumoModulo } from '../types/Insumo';
import type { ProdutoInsumo } from '../types/ProdutoInsumo';

// ─── UI tokens ───────────────────────────────────────────────────────────────

const INPUT_CLS = `
  w-full px-3.5 py-2.5 rounded-xl
  bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09]
  text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/20 text-sm
  focus:outline-none focus:border-violet-500/50 focus:bg-white dark:focus:bg-white/[0.08]
  disabled:opacity-40 transition-all
`.trim();

const TIPO_LABEL: Record<InsumoTipo, string> = {
  reagente: 'Reagente',
  controle: 'Controle',
  'tira-uro': 'Tira Uroanálise',
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface NovoLoteModalProps {
  labId: string;
  /** Pré-filtra a lista por tipo. */
  initialTipo?: InsumoTipo;
  /**
   * Fase D (2026-04-21): equipamento destino do lote.
   *   - reagente/tira-uro → grava `equipamentoId` (1:1, exclusivo)
   *   - controle          → grava `equipamentosPermitidos = [equipamentoId]`
   *                         (N:1, user pode expandir via UI depois)
   */
  equipamentoId?: string;
  /** Modelo normalizado do equipamento — usado pra wiring futuro de statsPorModelo. */
  equipamentoModelo?: string;
  onClose: () => void;
  onCreated?: (insumoId: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function NovoLoteModal({
  labId,
  initialTipo,
  equipamentoId,
  equipamentoModelo,
  onClose,
  onCreated,
}: NovoLoteModalProps) {
  const user = useUser();
  const [tipoFiltro, setTipoFiltro] = useState<InsumoTipo | 'all'>(initialTipo ?? 'all');
  const [moduloFiltro, setModuloFiltro] = useState<InsumoModulo | 'all'>('all');
  const [busca, setBusca] = useState('');
  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoInsumo | null>(null);
  const [showProdutoForm, setShowProdutoForm] = useState(false);

  const filters = useMemo(
    () => ({
      tipo: tipoFiltro === 'all' ? undefined : tipoFiltro,
      modulo: moduloFiltro === 'all' ? undefined : moduloFiltro,
      query: busca.trim() || undefined,
    }),
    [tipoFiltro, moduloFiltro, busca],
  );
  const { produtos, isLoading } = useProdutos(filters);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="novo-lote-title"
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl"
      >
        <Header onClose={onClose} step={produtoSelecionado ? 2 : 1} produto={produtoSelecionado} />

        {produtoSelecionado ? (
          <LoteForm
            labId={labId}
            produto={produtoSelecionado}
            user={user}
            {...(equipamentoId && { equipamentoId })}
            {...(equipamentoModelo && { equipamentoModelo })}
            onBack={() => setProdutoSelecionado(null)}
            onCreated={(id) => {
              onCreated?.(id);
              onClose();
            }}
          />
        ) : (
          <ProdutoPicker
            produtos={produtos}
            isLoading={isLoading}
            tipoFiltro={tipoFiltro}
            moduloFiltro={moduloFiltro}
            busca={busca}
            onSetTipo={setTipoFiltro}
            onSetModulo={setModuloFiltro}
            onSetBusca={setBusca}
            onSelect={setProdutoSelecionado}
            onNovoProduto={() => setShowProdutoForm(true)}
          />
        )}
      </div>

      {showProdutoForm && (
        <ProdutoFormModal
          labId={labId}
          {...(tipoFiltro !== 'all' && { initialTipo: tipoFiltro })}
          {...(moduloFiltro !== 'all' && { initialModulo: moduloFiltro })}
          onClose={() => setShowProdutoForm(false)}
          onCreated={() => {
            // Fecha o modal de produto — o snapshot real-time da lista
            // `produtos` já vai incluir o novo produto. Operador continua
            // na etapa 1 e seleciona o recém-criado.
            setShowProdutoForm(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

function Header({
  step,
  produto,
  onClose,
}: {
  step: 1 | 2;
  produto: ProdutoInsumo | null;
  onClose: () => void;
}) {
  return (
    <div className="px-6 py-5 border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between sticky top-0 bg-white dark:bg-[#0F1318] z-10">
      <div className="flex-1 min-w-0">
        <h2
          id="novo-lote-title"
          className="text-base font-semibold text-slate-900 dark:text-white/90"
        >
          Novo lote de insumo
        </h2>
        <p className="text-xs text-slate-500 dark:text-white/45 mt-0.5 truncate">
          {step === 1
            ? 'Escolha o produto do catálogo ou cadastre um novo.'
            : `Lote de ${produto?.nomeComercial} (${produto?.fabricante})`}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-white/40">
          <StepBadge active={step === 1} done={step === 2} n={1} label="Produto" />
          <span>→</span>
          <StepBadge active={step === 2} done={false} n={2} label="Lote" />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path
              d="M3 3l8 8M11 3l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

function StepBadge({
  active,
  done,
  n,
  label,
}: {
  active: boolean;
  done: boolean;
  n: number;
  label: string;
}) {
  const cls = active
    ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30'
    : done
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
      : 'bg-slate-100 dark:bg-white/[0.04] text-slate-400 dark:text-white/30 border-slate-200 dark:border-white/[0.06]';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-medium ${cls}`}>
      <span className="w-4 h-4 rounded-full bg-current/15 flex items-center justify-center text-[9px] font-bold">
        {done ? '✓' : n}
      </span>
      {label}
    </span>
  );
}

// ─── Etapa 1: ProdutoPicker ─────────────────────────────────────────────────

interface ProdutoPickerProps {
  produtos: ProdutoInsumo[];
  isLoading: boolean;
  tipoFiltro: InsumoTipo | 'all';
  moduloFiltro: InsumoModulo | 'all';
  busca: string;
  onSetTipo: (v: InsumoTipo | 'all') => void;
  onSetModulo: (v: InsumoModulo | 'all') => void;
  onSetBusca: (v: string) => void;
  onSelect: (p: ProdutoInsumo) => void;
  onNovoProduto: () => void;
}

function ProdutoPicker({
  produtos,
  isLoading,
  tipoFiltro,
  moduloFiltro,
  busca,
  onSetTipo,
  onSetModulo,
  onSetBusca,
  onSelect,
  onNovoProduto,
}: ProdutoPickerProps) {
  return (
    <div className="p-6 space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          aria-label="Filtrar por tipo"
          className={`${INPUT_CLS} flex-none w-auto`}
          value={tipoFiltro}
          onChange={(e) => onSetTipo(e.target.value as InsumoTipo | 'all')}
        >
          <option value="all">Todos os tipos</option>
          <option value="reagente">Reagente</option>
          <option value="controle">Controle</option>
          <option value="tira-uro">Tira uroanálise</option>
        </select>
        <select
          aria-label="Filtrar por módulo"
          className={`${INPUT_CLS} flex-none w-auto`}
          value={moduloFiltro}
          onChange={(e) => onSetModulo(e.target.value as InsumoModulo | 'all')}
        >
          <option value="all">Todos os módulos</option>
          <option value="hematologia">Hematologia</option>
          <option value="coagulacao">Coagulação</option>
          <option value="uroanalise">Uroanálise</option>
          <option value="imunologia">Imunologia</option>
        </select>
        <input
          aria-label="Buscar produto"
          type="search"
          placeholder="Buscar por nome ou fabricante…"
          value={busca}
          onChange={(e) => onSetBusca(e.target.value)}
          className={`${INPUT_CLS} flex-1 min-w-[200px]`}
        />
      </div>

      {/* Lista */}
      <div className="border border-slate-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="py-10 text-center text-sm text-slate-500 dark:text-white/40">
            Carregando catálogo…
          </div>
        ) : produtos.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500 dark:text-white/40">
            <p>Nenhum produto cadastrado ainda.</p>
            <p className="text-xs mt-1 text-slate-400 dark:text-white/30">
              Cadastre o primeiro produto ou importe o catálogo do seu equipamento.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/[0.04] max-h-[50vh] overflow-y-auto">
            {produtos.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelect(p)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-900 dark:text-white/85">
                          {p.nomeComercial}
                        </p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.05] text-slate-500 dark:text-white/45 font-medium">
                          {TIPO_LABEL[p.tipo]}
                        </span>
                        {p.isCatalogoPadrao && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/25">
                            Catálogo padrão
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">
                        {p.fabricante}
                        {p.codigoFabricante && ` · ${p.codigoFabricante}`}
                        {p.modulos.length > 0 &&
                          ` · ${p.modulos.map((m) => m.slice(0, 4)).join('·')}`}
                      </p>
                      {p.funcaoTecnica && (
                        <p className="text-xs text-slate-400 dark:text-white/30 mt-1 line-clamp-1">
                          {p.funcaoTecnica}
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-medium text-violet-600 dark:text-violet-400 whitespace-nowrap">
                      Selecionar →
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={onNovoProduto}
        className="w-full px-4 h-11 rounded-xl border-2 border-dashed border-slate-300 dark:border-white/[0.1] text-sm text-slate-600 dark:text-white/55 hover:bg-slate-50 dark:hover:bg-white/[0.03] hover:border-violet-400 dark:hover:border-violet-500/40 hover:text-violet-600 dark:hover:text-violet-400 transition-all"
      >
        + Cadastrar novo produto no catálogo
      </button>
    </div>
  );
}

// ─── Etapa 2: LoteForm ──────────────────────────────────────────────────────

interface LoteFormProps {
  labId: string;
  produto: ProdutoInsumo;
  user: { uid: string } | null | undefined;
  /** Fase D: equipamento ao qual este lote está sendo vinculado. */
  equipamentoId?: string;
  equipamentoModelo?: string;
  onBack: () => void;
  onCreated: (insumoId: string) => void;
}

function LoteForm({
  labId,
  produto,
  user,
  equipamentoId,
  equipamentoModelo,
  onBack,
  onCreated,
}: LoteFormProps) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [lote, setLote] = useState('');
  const [validade, setValidade] = useState('');
  const [notaFiscalId, setNotaFiscalId] = useState<string | null>(null);
  const [showNovaNota, setShowNovaNota] = useState(false);
  // Lote nasce FECHADO por padrão — operador só marca "já em uso" quando o
  // produto físico já foi aberto no lab (ex: backfill de migração ou lote que
  // veio aberto de outra unidade). Sem marcar, o cadastro cria `status='fechado'`
  // e o lote só vira utilizável após `openInsumo` — regra regulatória (RDC 786).
  const [alreadyOpen, setAlreadyOpen] = useState(false);
  const [dataAbertura, setDataAbertura] = useState(todayIso);
  const [diasEstab, setDiasEstab] = useState<number>(
    produto.diasEstabilidadeAberturaDefault ?? 0,
  );
  const [nivel, setNivel] = useState<'normal' | 'patologico' | 'baixo' | 'alto' | ''>(
    produto.nivelDefault ?? '',
  );
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!lote.trim()) e.lote = 'Informe o número do lote.';
    if (!validade) e.validade = 'Informe a validade.';
    if (alreadyOpen) {
      if (!dataAbertura) {
        e.dataAbertura = 'Informe a data de abertura.';
      } else if (validade) {
        const v = new Date(validade + 'T00:00:00').getTime();
        const a = new Date(dataAbertura + 'T00:00:00').getTime();
        if (a > v) {
          e.dataAbertura = 'Abertura não pode ser posterior à validade do fabricante.';
        }
      }
    }
    if (produto.tipo === 'controle' && !nivel) {
      e.nivel = 'Selecione o nível do controle.';
    }
    // Nota fiscal: opcional em TODOS os tipos durante a fase inicial de produção.
    // Quando a base de lotes começar a ter massa crítica e o módulo de
    // qualificação de fornecedores for ativado, tornar obrigatório em tira-uro
    // (RDC 786/2023 art. 42). Por ora só exibimos "recomendado" no label.
    if (diasEstab < 0 || diasEstab > 365) {
      e.diasEstab = 'Estabilidade deve ficar entre 0 e 365 dias.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    if (!user) {
      setSubmitError('Usuário não autenticado.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const validadeTs = Timestamp.fromDate(new Date(`${validade}T00:00:00`));
      const aberturaTs = alreadyOpen
        ? Timestamp.fromDate(new Date(`${dataAbertura}T00:00:00`))
        : null;

      // Módulo principal (modulos[0]) — replica pro campo legado `modulo`.
      const moduloPrimario = produto.modulos[0];

      // Fase D (2026-04-21): vinculação ao equipamento:
      //  - reagente / tira → equipamentoId (exclusivo, 1:1)
      //  - controle        → equipamentosPermitidos (inicial com apenas este;
      //                      user pode adicionar outros via UI posteriormente)
      // `equipamentoModelo` reservado pra fluxo de statsPorModelo (bula do
      // controle multianalítico); por ora usamos como assinatura do contexto.
      void equipamentoModelo;

      const id = await (async () => {
        if (produto.tipo === 'controle') {
          return createInsumo(labId, {
            tipo: 'controle',
            produtoId: produto.id,
            nivel: (nivel || 'normal') as 'normal' | 'patologico' | 'baixo' | 'alto',
            modulo: moduloPrimario,
            modulos: produto.modulos,
            fabricante: produto.fabricante,
            nomeComercial: produto.nomeComercial,
            lote: lote.trim(),
            validade: validadeTs,
            dataAbertura: aberturaTs,
            diasEstabilidadeAbertura: diasEstab,
            ...(produto.registroAnvisa && { registroAnvisa: produto.registroAnvisa }),
            ...(equipamentoId && { equipamentosPermitidos: [equipamentoId] }),
            ...(notaFiscalId && { notaFiscalId }),
            createdBy: user.uid,
          });
        } else if (produto.tipo === 'tira-uro') {
          return createInsumo(labId, {
            tipo: 'tira-uro',
            produtoId: produto.id,
            modulo: 'uroanalise',
            modulos: ['uroanalise'],
            fabricante: produto.fabricante,
            nomeComercial: produto.nomeComercial,
            lote: lote.trim(),
            validade: validadeTs,
            dataAbertura: aberturaTs,
            diasEstabilidadeAbertura: diasEstab,
            analitosIncluidos: [], // pode ser enriquecido depois
            ...(produto.registroAnvisa && { registroAnvisa: produto.registroAnvisa }),
            ...(equipamentoId && { equipamentoId }),
            ...(notaFiscalId && { notaFiscalId }),
            createdBy: user.uid,
          });
        } else {
          return createInsumo(labId, {
            tipo: 'reagente',
            produtoId: produto.id,
            modulo: moduloPrimario,
            modulos: produto.modulos,
            fabricante: produto.fabricante,
            nomeComercial: produto.nomeComercial,
            lote: lote.trim(),
            validade: validadeTs,
            dataAbertura: aberturaTs,
            diasEstabilidadeAbertura: diasEstab,
            ...(produto.registroAnvisa && { registroAnvisa: produto.registroAnvisa }),
            ...(equipamentoId && { equipamentoId }),
            ...(notaFiscalId && { notaFiscalId }),
            createdBy: user.uid,
          });
        }
      })();

      onCreated(id);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erro ao cadastrar lote.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5">
      {/* Resumo do produto escolhido */}
      <div className="rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 dark:text-white/40">
              Produto selecionado
            </p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white/90 mt-1">
              {produto.nomeComercial}
            </p>
            <p className="text-xs text-slate-500 dark:text-white/45 mt-0.5">
              {produto.fabricante} · {TIPO_LABEL[produto.tipo]}
              {produto.codigoFabricante && ` · ${produto.codigoFabricante}`}
            </p>
            {produto.funcaoTecnica && (
              <p className="text-xs text-slate-500 dark:text-white/45 mt-1 italic">
                {produto.funcaoTecnica}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline whitespace-nowrap"
          >
            ← Trocar produto
          </button>
        </div>
      </div>

      {/* Dados do lote */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="loteNum"
            className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-1.5"
          >
            Número do lote <span className="text-red-500">*</span>
          </label>
          <input
            id="loteNum"
            className={INPUT_CLS}
            value={lote}
            onChange={(e) => setLote(e.target.value)}
            placeholder="ex: 2841A24"
            autoComplete="off"
          />
          {errors.lote && <p className="text-xs text-red-500 mt-1">{errors.lote}</p>}
        </div>

        <div>
          <label
            htmlFor="validade"
            className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-1.5"
          >
            Validade do fabricante <span className="text-red-500">*</span>
          </label>
          <input
            id="validade"
            aria-label="Validade do fabricante"
            type="date"
            className={INPUT_CLS}
            value={validade}
            onChange={(e) => setValidade(e.target.value)}
          />
          {errors.validade && (
            <p className="text-xs text-red-500 mt-1">{errors.validade}</p>
          )}
        </div>

        {/* Nota fiscal — obrigatória em tiras (RDC 786 art. 42 — rastreabilidade
            fiscal de insumos de diagnóstico); opcional em reagente/controle. */}
        <div className="col-span-2">
          <NotaFiscalPicker
            labId={labId}
            notaFiscalId={notaFiscalId}
            onSelect={setNotaFiscalId}
            onCreateNew={() => setShowNovaNota(true)}
            required={false}
            error={errors.notaFiscalId}
          />
        </div>

        <div className="col-span-2">
          <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] p-3 space-y-2">
            <label htmlFor="alreadyOpen" className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                id="alreadyOpen"
                type="checkbox"
                aria-label="Este lote já está em uso — registrar abertura agora"
                checked={alreadyOpen}
                onChange={(e) => setAlreadyOpen(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-white/20 text-violet-600 focus:ring-violet-500"
              />
              <span className="flex-1">
                <span className="block text-xs font-medium text-slate-800 dark:text-white/80">
                  Este lote já está em uso (abrir agora)
                </span>
                <span className="block text-[11px] text-slate-500 dark:text-white/40 mt-0.5 leading-relaxed">
                  Por padrão, o lote é cadastrado como <strong>fechado</strong> e só fica
                  utilizável após abertura formal. Marque apenas se o produto físico já
                  foi aberto no lab.
                </span>
              </span>
            </label>
            {alreadyOpen && (
              <div className="pl-6 pt-1">
                <label
                  htmlFor="dataAbertura"
                  className="block text-[11px] font-medium text-slate-500 dark:text-white/45 mb-1"
                >
                  Data de abertura <span className="text-red-500">*</span>
                </label>
                <input
                  id="dataAbertura"
                  aria-label="Data de abertura"
                  type="date"
                  max={todayIso}
                  className={INPUT_CLS}
                  value={dataAbertura}
                  onChange={(e) => setDataAbertura(e.target.value)}
                />
                {errors.dataAbertura && (
                  <p className="text-xs text-red-500 mt-1">{errors.dataAbertura}</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="diasEstab"
            className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-1.5"
          >
            Estabilidade pós-abertura (dias)
          </label>
          <input
            id="diasEstab"
            aria-label="Dias de estabilidade pós-abertura"
            type="number"
            min={0}
            max={365}
            className={INPUT_CLS}
            value={diasEstab}
            onChange={(e) => setDiasEstab(Math.max(0, Math.min(365, Number(e.target.value) || 0)))}
          />
          <p className="text-xs text-slate-400 dark:text-white/25 mt-1">
            Default do produto: {produto.diasEstabilidadeAberturaDefault ?? 0} dias
          </p>
          {errors.diasEstab && <p className="text-xs text-red-500 mt-1">{errors.diasEstab}</p>}
        </div>
      </div>

      {/* Nível (só pra controle) */}
      {produto.tipo === 'controle' && (
        <div>
          <label
            htmlFor="nivel"
            className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-1.5"
          >
            Nível do controle <span className="text-red-500">*</span>
          </label>
          <select
            id="nivel"
            aria-label="Nível do controle"
            className={INPUT_CLS}
            value={nivel}
            onChange={(e) =>
              setNivel(e.target.value as 'normal' | 'patologico' | 'baixo' | 'alto' | '')
            }
          >
            <option value="">Selecione…</option>
            <option value="normal">Normal</option>
            <option value="patologico">Patológico</option>
            <option value="baixo">Baixo</option>
            <option value="alto">Alto</option>
          </select>
          {errors.nivel && <p className="text-xs text-red-500 mt-1">{errors.nivel}</p>}
        </div>
      )}

      {submitError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-700 dark:text-red-300">
          {submitError}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="px-4 h-10 rounded-xl text-sm font-medium text-slate-600 dark:text-white/55 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
        >
          ← Voltar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-5 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-violet-600/50 text-white text-sm font-medium"
        >
          {submitting ? 'Salvando…' : 'Cadastrar lote'}
        </button>
      </div>

      {showNovaNota && (
        <NotaFiscalFormModal
          labId={labId}
          onClose={() => setShowNovaNota(false)}
          onCreated={(id) => {
            setNotaFiscalId(id);
            setShowNovaNota(false);
          }}
        />
      )}
    </form>
  );
}

// ─── NotaFiscalPicker ────────────────────────────────────────────────────────

function NotaFiscalPicker({
  labId: _labId,
  notaFiscalId,
  onSelect,
  onCreateNew,
  required,
  error,
}: {
  labId: string;
  notaFiscalId: string | null;
  onSelect: (id: string | null) => void;
  onCreateNew: () => void;
  required: boolean;
  error?: string;
}) {
  const [search, setSearch] = useState('');
  const filters = useMemo(
    () => ({ query: search.trim() || undefined }),
    [search],
  );
  const { notas, isLoading } = useNotasFiscais(filters);
  const { fornecedores } = useFornecedores();

  const fornecedorById = useMemo(() => {
    const m = new Map(fornecedores.map((f) => [f.id, f]));
    return m;
  }, [fornecedores]);

  const notaSelecionada = useMemo(
    () => notas.find((n) => n.id === notaFiscalId) ?? null,
    [notas, notaFiscalId],
  );

  return (
    <div>
      <label
        htmlFor="nota-picker-search"
        className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-1.5 ml-0.5"
      >
        Nota fiscal de entrada
        {required ? (
          <span className="text-red-500 dark:text-red-400/70 ml-0.5">*</span>
        ) : (
          <span className="text-slate-400 dark:text-white/25 font-normal ml-1">
            (opcional — recomendado)
          </span>
        )}
      </label>

      {notaSelecionada ? (
        (() => {
          const f = fornecedorById.get(notaSelecionada.fornecedorId);
          return (
            <div className="rounded-xl bg-violet-500/5 border border-violet-500/30 p-3 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white/90 truncate">
                  NF {notaSelecionada.numero}
                  {notaSelecionada.serie &&
                    notaSelecionada.serie !== '1' &&
                    ` · Série ${notaSelecionada.serie}`}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-white/45 mt-0.5 truncate">
                  {f
                    ? `${f.nomeFantasia ?? f.razaoSocial} · ${formatCnpj(f.cnpj)}`
                    : 'Fornecedor removido'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!required && (
                  <button
                    type="button"
                    onClick={() => onSelect(null)}
                    className="text-xs font-medium text-slate-500 dark:text-white/45 hover:underline"
                  >
                    Remover
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onSelect(null)}
                  className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
                >
                  Trocar
                </button>
              </div>
            </div>
          );
        })()
      ) : (
        <div className="space-y-2">
          <input
            id="nota-picker-search"
            className={INPUT_CLS}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número ou chave de acesso…"
            autoComplete="off"
          />
          <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] max-h-48 overflow-y-auto">
            {isLoading ? (
              <p className="p-3 text-xs text-slate-500 dark:text-white/40">Carregando…</p>
            ) : notas.length === 0 ? (
              <div className="p-3 text-xs text-slate-500 dark:text-white/40 flex items-center justify-between gap-3">
                <span>
                  {search.trim() ? 'Nenhuma nota encontrada.' : 'Nenhuma nota cadastrada.'}
                </span>
                <button
                  type="button"
                  onClick={onCreateNew}
                  className="text-violet-600 dark:text-violet-400 font-medium hover:underline whitespace-nowrap"
                >
                  + Cadastrar nota
                </button>
              </div>
            ) : (
              <ul>
                {notas.slice(0, 15).map((n) => {
                  const f = fornecedorById.get(n.fornecedorId);
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(n.id)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.03] border-b border-slate-100 dark:border-white/[0.04] last:border-b-0 transition-colors"
                      >
                        <p className="text-xs font-medium text-slate-800 dark:text-white/80 truncate">
                          NF {n.numero}
                          {f && (
                            <span className="text-slate-500 dark:text-white/45 font-normal">
                              {' · '}
                              {f.nomeFantasia ?? f.razaoSocial}
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-white/40 truncate">
                          Emitida {n.dataEmissao.toDate().toLocaleDateString('pt-BR')}
                          {f && ` · CNPJ ${formatCnpj(f.cnpj)}`}
                        </p>
                      </button>
                    </li>
                  );
                })}
                <li>
                  <button
                    type="button"
                    onClick={onCreateNew}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-500/[0.05] transition-colors"
                  >
                    + Cadastrar nova nota fiscal
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 dark:text-red-400/80 mt-1 ml-0.5">{error}</p>
      )}
    </div>
  );
}
