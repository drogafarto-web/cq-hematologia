/**
 * InsumosView — tela principal de Insumos + Equipamentos.
 *
 * Reorganizada na Fase D (2026-04-21 — 2º turno). Fluxo mental do operador:
 *   1. Cada módulo lista seus equipamentos (N por módulo, aposentadoria soft-delete).
 *   2. Cada equipamento expande pra mostrar: produtos cadastrados · setup ativo · lotes.
 *   3. Botões "Novo equipamento" / "Novo produto" / "Novo lote" ficam em contexto,
 *      não mais em header global que force o operador a adivinhar o fluxo.
 *
 * A tabela flat de lotes (versão anterior) é preservada em uma aba "Todos os lotes"
 * para busca/auditoria global. O fluxo de trabalho é o dos painéis por módulo.
 */

import React, { useMemo, useState } from 'react';
import { useActiveLab, useUser, useUserRole } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { useInsumos } from './hooks/useInsumos';
import {
  aprovarLoteImuno,
  closeInsumo,
  descartarInsumo,
  openInsumo,
} from './services/insumosFirebaseService';
import { NovoLoteModal } from './components/NovoLoteModal';
import { FR10ExportModal } from './components/FR10ExportModal';
import { CatalogoProdutosView } from './components/CatalogoProdutosView';
import { FornecedoresView } from '../fornecedores/FornecedoresView';
import { useFornecedores } from '../fornecedores/hooks/useFornecedores';
import { useNotasFiscais } from '../fornecedores/hooks/useNotasFiscais';
import { formatCnpj } from '../fornecedores/types/Fornecedor';
import type { Fornecedor } from '../fornecedores/types/Fornecedor';
import type { NotaFiscal } from '../fornecedores/types/NotaFiscal';
import { CATALOGO_TEMPLATES, importarTemplate } from './services/catalogoSeed';
import { validadeStatus, diasAteVencer } from './utils/validadeReal';
import { resolveInsumoState, isEmRotina } from './utils/insumoState';
import { hasQCValidationPending } from './types/Insumo';
import type { Insumo, InsumoStatus, InsumoModulo } from './types/Insumo';
import { ModuleEquipamentosPanel } from '../equipamentos/components/ModuleEquipamentosPanel';

// ─── UI tokens ───────────────────────────────────────────────────────────────

const BUTTON_GHOST = `
  px-3 h-9 rounded-lg text-xs font-medium
  text-slate-600 dark:text-white/55 hover:text-slate-900 dark:hover:text-white/85
  hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all
`.trim();

const CHIP = `
  inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border
`.trim();

const MODULES: InsumoModulo[] = ['hematologia', 'coagulacao', 'uroanalise', 'imunologia'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(ts: { toDate: () => Date } | null | undefined): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('pt-BR');
}

// statusChip legado removido — agora usamos `resolveInsumoState(insumo)` que
// distingue lacrado (nunca aberto) de encerrado (aberto e fechado) usando
// `dataAbertura`. Rever em call sites se algum ainda chamar statusChip.

function validadeChip(validadeReal: { toDate: () => Date }): {
  bg: string;
  label: string;
} {
  const date = validadeReal.toDate();
  const status = validadeStatus(date);
  const dias = diasAteVencer(date);
  if (status === 'expired')
    return {
      bg: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300',
      label: `Vencido há ${Math.abs(dias)}d`,
    };
  if (status === 'warning')
    return {
      bg: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
      label: `Vence em ${dias}d`,
    };
  return {
    bg: 'bg-slate-500/10 border-slate-500/30 text-slate-600 dark:text-white/50',
    label: `Válido (${dias}d)`,
  };
}

// ─── Tabs (nível topo) ───────────────────────────────────────────────────────

type MainTab = 'equipamentos' | 'catalogo' | 'fornecedores' | 'lotes';

// ─── Main view ───────────────────────────────────────────────────────────────

export function InsumosView() {
  const activeLab = useActiveLab();
  const user = useUser();
  const role = useUserRole();
  const setCurrentView = useAppStore((s) => s.setCurrentView);

  const [mainTab, setMainTab] = useState<MainTab>('equipamentos');
  const [catalogoModuloFilter, setCatalogoModuloFilter] = useState<InsumoModulo | undefined>(
    undefined,
  );
  const [showExport, setShowExport] = useState(false);
  const [importingTemplate, setImportingTemplate] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  const openCatalogo = (moduloFilter?: InsumoModulo) => {
    setCatalogoModuloFilter(moduloFilter);
    setMainTab('catalogo');
  };

  const canMutate = !!role;

  if (!activeLab) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-500">
        Nenhum laboratório ativo.
      </div>
    );
  }

  const operadorName = user?.displayName || user?.email?.split('@')[0] || 'Operador';

  async function handleImportTemplate(templateKey: string) {
    if (!user) return;
    setImportingTemplate(templateKey);
    setImportSummary(null);
    try {
      const result = await importarTemplate(
        activeLab!.id,
        templateKey as keyof typeof CATALOGO_TEMPLATES,
        user.uid,
      );
      setImportSummary(
        `Catálogo importado — ${result.totalCriados} novo(s), ${result.totalExistentes} já existia(m).`,
      );
    } catch (err) {
      setImportSummary(
        `Erro ao importar: ${err instanceof Error ? err.message : 'desconhecido'}`,
      );
    } finally {
      setImportingTemplate(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F14] text-slate-900 dark:text-white">
      {/* Header */}
      <header className="h-14 bg-white dark:bg-[#0F1318] border-b border-slate-200 dark:border-white/[0.06] flex items-center gap-4 px-6 sticky top-0 z-10">
        <button
          type="button"
          onClick={() => setCurrentView('hub')}
          className={BUTTON_GHOST}
          aria-label="Voltar ao hub"
        >
          ← Voltar
        </button>
        <div className="h-5 w-px bg-slate-200 dark:bg-white/[0.08]" />
        <div>
          <div className="text-sm font-medium text-slate-900 dark:text-white/85">
            Insumos & Equipamentos
          </div>
          <div className="text-xs text-slate-500 dark:text-white/40">{activeLab.name}</div>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setShowExport(true)}
          className={BUTTON_GHOST}
          title="Exportar FR-10 (Rastreabilidade de Insumos)"
        >
          <span className="inline-flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M9 15h6M9 11h6M9 19h3" />
            </svg>
            Exportar FR-10
          </span>
        </button>
        {canMutate && (
          <ImportCatalogoMenu
            importing={importingTemplate}
            onImport={handleImportTemplate}
          />
        )}
      </header>

      <main className="max-w-[1400px] w-full mx-auto px-8 py-6 space-y-6">
        {/* Tabs principais */}
        <div className="flex items-center gap-1 border-b border-slate-200 dark:border-white/[0.06]">
          <TabButton active={mainTab === 'equipamentos'} onClick={() => setMainTab('equipamentos')}>
            Equipamentos & setups
          </TabButton>
          <TabButton
            active={mainTab === 'catalogo'}
            onClick={() => {
              setCatalogoModuloFilter(undefined);
              setMainTab('catalogo');
            }}
          >
            Catálogo de produtos
          </TabButton>
          <TabButton
            active={mainTab === 'fornecedores'}
            onClick={() => setMainTab('fornecedores')}
          >
            Fornecedores
          </TabButton>
          <TabButton active={mainTab === 'lotes'} onClick={() => setMainTab('lotes')}>
            Todos os lotes
          </TabButton>
        </div>

        {mainTab === 'equipamentos' && (
          <div className="space-y-6">
            {MODULES.map((m) => (
              <ModuleEquipamentosPanel
                key={m}
                labId={activeLab.id}
                module={m}
                canMutate={canMutate}
                onOpenCatalogo={openCatalogo}
              />
            ))}
          </div>
        )}

        {mainTab === 'catalogo' && (
          <CatalogoProdutosView
            labId={activeLab.id}
            canMutate={canMutate}
            initialModuloFilter={catalogoModuloFilter}
          />
        )}

        {mainTab === 'fornecedores' && (
          <FornecedoresView labId={activeLab.id} canMutate={canMutate} />
        )}

        {mainTab === 'lotes' && (
          <LotesTable
            labId={activeLab.id}
            canMutate={canMutate}
            operadorName={operadorName}
          />
        )}
      </main>

      {showExport && <FR10ExportModal onClose={() => setShowExport(false)} />}

      {importSummary && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md p-3.5 rounded-xl bg-slate-900 dark:bg-white/[0.08] text-white text-sm shadow-2xl flex items-start gap-2">
          <span>{importSummary}</span>
          <button
            type="button"
            onClick={() => setImportSummary(null)}
            className="text-white/60 hover:text-white/90 shrink-0"
            aria-label="Fechar aviso"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Tab button ──────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all
        ${
          active
            ? 'border-violet-500 text-slate-900 dark:text-white/90'
            : 'border-transparent text-slate-500 dark:text-white/45 hover:text-slate-700 dark:hover:text-white/70'
        }
      `}
    >
      {children}
    </button>
  );
}

// ─── LotesTable (tab "Todos os lotes") ───────────────────────────────────────

function LotesTable({
  labId,
  canMutate,
  operadorName,
}: {
  labId: string;
  canMutate: boolean;
  operadorName: string;
}) {
  const user = useUser();
  const [tab, setTab] = useState<'all' | 'controle' | 'reagente' | 'tira-uro'>('all');
  /**
   * Hierarquia operacional dos estados — `fechado` desambiguado pra `lacrado`
   * (nunca aberto) ou `encerrado` (aberto e depois fechado). Default "em-rotina"
   * = em uso + lacrados, que é o que o operador precisa ver no dia-a-dia.
   */
  type StatusTab =
    | 'em-rotina'
    | 'ativo'
    | 'lacrados'
    | 'encerrados'
    | 'vencido'
    | 'descartado'
    | 'all';
  const [statusFilter, setStatusFilter] = useState<StatusTab>('em-rotina');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNovoLote, setShowNovoLote] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const filters = useMemo(() => {
    // Server-side filter por status quando a tab mapeia 1:1 no schema.
    // 'lacrados'/'encerrados' ambos são `status='fechado'` com distinção via
    // dataAbertura — server não sabe distinguir, filtramos client-side.
    const serverStatus: InsumoStatus | undefined =
      statusFilter === 'ativo'
        ? 'ativo'
        : statusFilter === 'vencido'
          ? 'vencido'
          : statusFilter === 'descartado'
            ? 'descartado'
            : statusFilter === 'lacrados' || statusFilter === 'encerrados'
              ? 'fechado'
              : undefined;
    return {
      tipo: tab === 'all' ? undefined : tab,
      ...(serverStatus && { status: serverStatus }),
      query: searchQuery.trim() || undefined,
    };
  }, [tab, statusFilter, searchQuery]);

  const { insumos: insumosRaw, isLoading, error } = useInsumos(filters);
  const insumos = useMemo(() => {
    switch (statusFilter) {
      case 'em-rotina':
        // Em uso + lacrado (nunca aberto). Encerrados são histórico.
        return insumosRaw.filter(isEmRotina);
      case 'lacrados':
        return insumosRaw.filter((i) => resolveInsumoState(i).kind === 'lacrado');
      case 'encerrados':
        return insumosRaw.filter((i) => resolveInsumoState(i).kind === 'encerrado');
      default:
        return insumosRaw;
    }
  }, [insumosRaw, statusFilter]);

  // Carrega notas + fornecedores pra enriquecer cada linha com rastreabilidade
  // fiscal (NF, razão social, CNPJ). Subscriptions são compartilhadas com
  // outros componentes via Firestore cache; custo baixo.
  const { notas } = useNotasFiscais();
  const { fornecedores } = useFornecedores();
  const notaById = useMemo(() => {
    const m = new Map<string, NotaFiscal>();
    for (const n of notas) m.set(n.id, n);
    return m;
  }, [notas]);
  const fornecedorById = useMemo(() => {
    const m = new Map<string, Fornecedor>();
    for (const f of fornecedores) m.set(f.id, f);
    return m;
  }, [fornecedores]);

  const activeFilters = useMemo(() => ({ status: 'ativo' as const }), []);
  const { insumos: ativosInsumos } = useInsumos(activeFilters);
  const qcPendingCount = useMemo(
    () => ativosInsumos.filter(hasQCValidationPending).length,
    [ativosInsumos],
  );

  async function handleOpen(i: Insumo) {
    if (!user) return;
    setActionError(null);
    try {
      await openInsumo(
        labId,
        i.id,
        {
          validade: i.validade,
          diasEstabilidadeAbertura: i.diasEstabilidadeAbertura,
          tipo: i.tipo,
        },
        user.uid,
        operadorName,
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao abrir insumo.');
    }
  }

  async function handleClose(i: Insumo) {
    if (!user) return;
    setActionError(null);
    try {
      await closeInsumo(labId, i.id, user.uid, operadorName);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao fechar insumo.');
    }
  }

  async function handleDescartar(i: Insumo) {
    if (!user) return;
    setActionError(null);
    const motivo = window.prompt('Motivo do descarte (obrigatório para auditoria):');
    if (!motivo || !motivo.trim()) return;
    try {
      await descartarInsumo(labId, i.id, motivo.trim(), user.uid, operadorName);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao descartar insumo.');
    }
  }

  async function handleAprovarImuno(i: Insumo) {
    if (!user) return;
    setActionError(null);
    const ok = window.confirm(
      `Aprovar lote ${i.lote} (${i.nomeComercial})?\n\n` +
        'Confirma que as corridas de validação deste lote foram executadas com sucesso ' +
        'e o lote está liberado para uso rotineiro. Ação auditável.',
    );
    if (!ok) return;
    try {
      await aprovarLoteImuno(labId, i.id, user.uid, operadorName);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao aprovar lote.');
    }
  }

  return (
    <div>
      {/* Tabs por tipo */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-white/[0.06] mb-5">
        {[
          { id: 'all' as const, label: 'Todos' },
          { id: 'controle' as const, label: 'Controles' },
          { id: 'reagente' as const, label: 'Reagentes' },
          { id: 'tira-uro' as const, label: 'Tiras uro' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`
              px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all
              ${
                tab === t.id
                  ? 'border-violet-500 text-slate-900 dark:text-white/90'
                  : 'border-transparent text-slate-500 dark:text-white/45 hover:text-slate-700 dark:hover:text-white/70'
              }
            `}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-white/[0.04] rounded-lg flex-wrap">
          {[
            { id: 'em-rotina' as const, label: 'Em rotina' },
            { id: 'ativo' as const, label: 'Em uso' },
            { id: 'lacrados' as const, label: 'Lacrados' },
            { id: 'encerrados' as const, label: 'Encerrados' },
            { id: 'vencido' as const, label: 'Vencidos' },
            { id: 'descartado' as const, label: 'Descartados' },
            { id: 'all' as const, label: 'Todos' },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStatusFilter(s.id)}
              className={`
                px-3 h-8 rounded-md text-xs font-medium transition-all
                ${
                  statusFilter === s.id
                    ? 'bg-white dark:bg-white/[0.08] text-slate-900 dark:text-white/90 shadow-sm'
                    : 'text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/75'
                }
              `}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[200px]">
          <input
            type="search"
            placeholder="Buscar por lote, fabricante ou nome comercial…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-md px-3.5 h-9 rounded-lg bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-sm placeholder-slate-400 dark:placeholder-white/25 focus:outline-none focus:border-violet-500/50"
          />
        </div>
        {canMutate && (
          <button
            type="button"
            onClick={() => setShowNovoLote(true)}
            className="px-4 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium transition-all"
          >
            + Novo lote
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {actionError && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-700 dark:text-red-300">
          {actionError}
        </div>
      )}

      {qcPendingCount > 0 && (
        <div
          role="status"
          className="mb-4 p-3.5 rounded-xl bg-amber-500/[0.08] border border-amber-500/25 flex items-start gap-3"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
            aria-hidden
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div className="flex-1">
            <p className="text-[13px] font-medium text-amber-700 dark:text-amber-300">
              {qcPendingCount} insumo{qcPendingCount > 1 ? 's' : ''} com CQ pendente de validação
            </p>
            <p className="text-[11px] text-amber-600/80 dark:text-amber-400/70 mt-0.5 leading-snug">
              Reagentes e tiras recém-abertos precisam ser validados por uma corrida de CQ
              aprovada antes de entrar em rotina — CLSI EP26-A · RDC 978/2025 Art.128.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1fr,140px,120px,180px,160px] gap-4 px-5 py-2.5 bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.06] text-[11px] uppercase tracking-wider text-slate-500 dark:text-white/35 font-medium">
          <div>Insumo</div>
          <div>Validade</div>
          <div>Abertura</div>
          <div>Situação</div>
          <div className="text-right">Ações</div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-slate-500 dark:text-white/40">
            Carregando…
          </div>
        ) : insumos.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-sm text-slate-500 dark:text-white/45">
              Nenhum insumo encontrado.
            </div>
            <p className="text-xs text-slate-400 dark:text-white/30 mt-1">
              Cadastre lotes diretamente nos cards de equipamento (aba anterior).
            </p>
          </div>
        ) : (
          insumos.map((i) => {
            const nota = i.notaFiscalId ? notaById.get(i.notaFiscalId) ?? null : null;
            const fornecedor = nota ? fornecedorById.get(nota.fornecedorId) ?? null : null;
            return (
              <InsumoRow
                key={i.id}
                insumo={i}
                nota={nota}
                fornecedor={fornecedor}
                canMutate={canMutate}
                onOpen={handleOpen}
                onClose={handleClose}
                onDescartar={handleDescartar}
                onAprovarImuno={handleAprovarImuno}
              />
            );
          })
        )}
      </div>

      <div className="mt-4 text-xs text-slate-400 dark:text-white/30">
        {insumos.length} insumo{insumos.length !== 1 ? 's' : ''} exibido
        {insumos.length !== 1 ? 's' : ''}.
      </div>

      {showNovoLote && (
        <NovoLoteModal
          labId={labId}
          {...(tab !== 'all' && { initialTipo: tab })}
          onClose={() => setShowNovoLote(false)}
        />
      )}
    </div>
  );
}

// ─── Linha de lote (preservada da versão anterior) ──────────────────────────

function InsumoRow({
  insumo,
  nota,
  fornecedor,
  canMutate,
  onOpen,
  onClose,
  onDescartar,
  onAprovarImuno,
}: {
  insumo: Insumo;
  /** Resolvido pelo caller via `useNotasFiscais()`. `null` quando o lote não
   * aponta pra nenhuma nota ou a nota foi removida. */
  nota: NotaFiscal | null;
  /** Resolvido a partir da nota — `null` quando não há nota ou o fornecedor
   * foi removido. */
  fornecedor: Fornecedor | null;
  canMutate: boolean;
  onOpen: (i: Insumo) => void;
  onClose: (i: Insumo) => void;
  onDescartar: (i: Insumo) => void;
  onAprovarImuno: (i: Insumo) => void;
}) {
  const state = resolveInsumoState(insumo);
  const v = validadeChip(insumo.validadeReal);
  // Lacrado = lote nunca aberto (kind='lacrado'). Só lacrados ganham botão
  // "Abrir lote" — encerrados ficam no histórico. `isFechado` legado é
  // mantido apenas para docs pre-backfill (status indefinido + dataAbertura
  // ausente). Ver `resolveInsumoState` para semântica canônica.
  const isLacrado = state.kind === 'lacrado';
  const isImuno =
    insumo.tipo === 'reagente' &&
    (insumo.modulos?.includes('imunologia') || insumo.modulo === 'imunologia');
  const qcStatus =
    insumo.tipo === 'reagente' || insumo.tipo === 'tira-uro' ? insumo.qcStatus : undefined;

  return (
    <div className="grid grid-cols-[1fr,140px,120px,180px,160px] gap-4 items-center px-5 py-3 border-b border-slate-100 dark:border-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-all">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-sm font-medium text-slate-900 dark:text-white/90 truncate">
            {insumo.nomeComercial}
          </div>
          <span className={`${CHIP} ${state.chipCls}`} title={state.tooltip}>
            {state.label}
          </span>
          {hasQCValidationPending(insumo) && (
            <span
              className={`${CHIP} bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300`}
              title="Reagente/tira aberto — execute uma corrida de CQ antes de rotina"
            >
              CQ pendente
            </span>
          )}
          {isImuno && qcStatus === 'pendente' && (
            <span className={`${CHIP} bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300`}>
              Lote não aprovado
            </span>
          )}
          {isImuno && qcStatus === 'aprovado' && (
            <span className={`${CHIP} bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300`}>
              Lote aprovado
            </span>
          )}
          {isImuno && qcStatus === 'reprovado' && (
            <span className={`${CHIP} bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300`}>
              Reprovado
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500 dark:text-white/45 mt-0.5 truncate">
          {insumo.fabricante} · Lote {insumo.lote} · {insumo.modulo}
          {insumo.tipo === 'controle' && ` · nível ${insumo.nivel}`}
        </div>
        {/* Rastreabilidade fiscal do LOTE (não do reagente) — NF + fornecedor
            vêm do vínculo insumo → notaFiscal → fornecedor. Duas compras do
            mesmo reagente aparecem em linhas distintas com NFs/fornecedores
            diferentes. */}
        {(nota || fornecedor) && (
          <div className="text-[11px] text-slate-400 dark:text-white/35 mt-0.5 truncate">
            {nota && (
              <>
                NF {nota.numero}
                {nota.serie && nota.serie !== '1' && `/${nota.serie}`}
              </>
            )}
            {nota && fornecedor && ' · '}
            {fornecedor && (
              <>
                {fornecedor.nomeFantasia ?? fornecedor.razaoSocial}
                {' · '}
                <span className="font-mono">{formatCnpj(fornecedor.cnpj)}</span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="text-xs text-slate-600 dark:text-white/55">
        <div>Validade</div>
        <div className="text-slate-900 dark:text-white/80 font-medium">
          {formatDate(insumo.validade)}
        </div>
      </div>

      <div className="text-xs text-slate-600 dark:text-white/55">
        <div>Abertura</div>
        <div className="text-slate-900 dark:text-white/80 font-medium">
          {insumo.dataAbertura == null ? '—' : formatDate(insumo.dataAbertura)}
        </div>
      </div>

      <span className={`${CHIP} ${v.bg} justify-self-start`}>{v.label}</span>

      <div className="flex items-center justify-end gap-1">
        {canMutate && isImuno && qcStatus !== 'aprovado' && insumo.status === 'ativo' && (
          <button
            type="button"
            onClick={() => onAprovarImuno(insumo)}
            className={`${BUTTON_GHOST} text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300`}
            title="Marcar lote como aprovado no CQ (Imuno)"
          >
            Aprovar lote
          </button>
        )}
        {canMutate && isLacrado && (
          <button
            type="button"
            onClick={() => onOpen(insumo)}
            className="px-3 h-8 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition-all"
            title="Registra a abertura do lote — libera pra uso rotineiro"
          >
            Abrir lote
          </button>
        )}
        {canMutate && insumo.status === 'ativo' && (
          <button
            type="button"
            onClick={() => onClose(insumo)}
            className={BUTTON_GHOST}
            title="Encerrar lote — fim de vida útil, mantém no histórico"
          >
            Encerrar
          </button>
        )}
        {canMutate && insumo.status !== 'descartado' && (
          <button
            type="button"
            onClick={() => onDescartar(insumo)}
            className={`${BUTTON_GHOST} text-red-600 dark:text-red-400/80 hover:text-red-700 dark:hover:text-red-300`}
          >
            Descartar
          </button>
        )}
      </div>
    </div>
  );
}

// ─── ImportCatalogoMenu (preservado) ─────────────────────────────────────────

function ImportCatalogoMenu({
  importing,
  onImport,
}: {
  importing: string | null;
  onImport: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={BUTTON_GHOST}
        title="Importar catálogo pré-cadastrado do fabricante"
      >
        <span className="inline-flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path
              d="M2 3h8M2 6h8M2 9h8"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          Importar catálogo
        </span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Fechar menu"
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-10 z-40 w-80 rounded-xl bg-white dark:bg-[#151d2a] border border-slate-200 dark:border-white/[0.1] shadow-2xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 dark:border-white/[0.06]">
              <p className="text-xs font-semibold text-slate-700 dark:text-white/70">
                Catálogos pré-cadastrados
              </p>
              <p className="text-[11px] text-slate-500 dark:text-white/40 mt-0.5">
                Importa produtos conhecidos. Rerun seguro — pula duplicados.
              </p>
            </div>
            <ul className="py-1 max-h-80 overflow-y-auto">
              {Object.entries(CATALOGO_TEMPLATES).map(([key, tpl]) => {
                const loading = importing === key;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        onImport(key);
                        setOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-white/[0.04] disabled:opacity-50 transition-all"
                    >
                      <p className="text-sm font-medium text-slate-900 dark:text-white/85">
                        {tpl.equipamento}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-white/40 mt-0.5 line-clamp-2">
                        {tpl.descricao}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-white/30 mt-1">
                        {tpl.produtos.length} produto(s)
                        {loading && ' · importando…'}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
