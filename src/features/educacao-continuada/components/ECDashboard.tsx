import { useMemo, useState } from 'react';

import { useTreinamentos } from '../hooks/useTreinamentos';
import type {
  Modalidade,
  Periodicidade,
  Treinamento,
  Unidade,
} from '../types/EducacaoContinuada';

import { downloadTemplate } from '../services/ecImportService';

import { BancoQuestoes } from './BancoQuestoes';
import { BibliotecaTemplates } from './BibliotecaTemplates';
import { ConfigAlertasForm } from './ConfigAlertasForm';
import { ECCronograma } from './ECCronograma';
import { ImportTreinamentosModal } from './ImportTreinamentosModal';
import { OnboardingPanel } from './OnboardingPanel';
import { TreinamentoForm } from './TreinamentoForm';

type PanelState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; treinamento: Treinamento };

const MODALIDADE_LABEL: Record<Modalidade, string> = {
  presencial: 'Presencial',
  online: 'Online',
  em_servico: 'Em serviço',
};

const UNIDADE_LABEL: Record<Unidade, string> = {
  fixa: 'Unidade fixa',
  itinerante: 'Unidade itinerante',
  ambas: 'Ambas',
};

const PERIODICIDADE_LABEL: Record<Periodicidade, string> = {
  mensal: 'Mensal',
  bimestral: 'Bimestral',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
};

type ViewMode = 'grid' | 'cards';

export function ECDashboard() {
  const [showInactive, setShowInactive] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [panel, setPanel] = useState<PanelState>({ mode: 'closed' });
  const [importOpen, setImportOpen] = useState<boolean>(false);
  const [bibliotecaOpen, setBibliotecaOpen] = useState<boolean>(false);
  const [onboardingOpen, setOnboardingOpen] = useState<boolean>(false);
  const [questoesOpen, setQuestoesOpen] = useState<boolean>(false);
  const [configOpen, setConfigOpen] = useState<boolean>(false);

  const { treinamentos, isLoading, error, update, softDelete } = useTreinamentos();

  const visible = useMemo(() => {
    if (showInactive) return treinamentos;
    return treinamentos.filter((t) => t.ativo);
  }, [treinamentos, showInactive]);

  const groups = useMemo(() => groupByPeriodicidade(visible), [visible]);

  const handleToggleAtivo = async (t: Treinamento): Promise<void> => {
    try {
      await update(t.id, { ativo: !t.ativo });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao alternar status.';
      window.alert(message);
    }
  };

  const handleArchive = async (t: Treinamento): Promise<void> => {
    const ok = window.confirm(
      `Arquivar "${t.titulo}"? Ficará oculto nas próximas planejamentos mas o histórico é preservado (RDC 978/2025).`,
    );
    if (!ok) return;
    try {
      await softDelete(t.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao arquivar.';
      window.alert(message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-slate-400">
            Planejamento anual de treinamentos conforme FR-027 / RDC 978/2025.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="tablist"
            aria-label="Modo de visualização"
            className="flex rounded-lg border border-slate-800 bg-slate-900/50 p-0.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'grid' ? 'true' : 'false'}
              onClick={() => setViewMode('grid')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === 'grid'
                  ? 'bg-slate-800 text-slate-100 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Grid anual
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'cards' ? 'true' : 'false'}
              onClick={() => setViewMode('cards')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === 'cards'
                  ? 'bg-slate-800 text-slate-100 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cards
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-400 select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
            />
            Incluir inativos
          </label>
          <button
            type="button"
            onClick={() => setBibliotecaOpen(true)}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-300 hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-300"
          >
            Biblioteca
          </button>
          <button
            type="button"
            onClick={() => setOnboardingOpen(true)}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-300 hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-300"
          >
            Onboarding
          </button>
          <button
            type="button"
            onClick={() => setQuestoesOpen(true)}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-300 hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-300"
          >
            Questões
          </button>
          <button
            type="button"
            onClick={() => setConfigOpen(true)}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-300 hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-300"
          >
            Config
          </button>
          <button
            type="button"
            onClick={() => downloadTemplate()}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            Baixar modelo
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            Importar XLSX
          </button>
          <button
            type="button"
            onClick={() => setPanel({ mode: 'create' })}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Novo treinamento
          </button>
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          Erro ao carregar treinamentos: {error.message}
        </p>
      )}

      {viewMode === 'grid' && (
        <ECCronograma
          onEditTreinamento={(t) => setPanel({ mode: 'edit', treinamento: t })}
          onArchiveTreinamento={(t) => void handleArchive(t)}
        />
      )}

      {viewMode === 'cards' && isLoading && <SkeletonGrid />}

      {viewMode === 'cards' && !isLoading && visible.length === 0 && (
        <EmptyState onCreate={() => setPanel({ mode: 'create' })} />
      )}

      {viewMode === 'cards' && !isLoading && groups.length > 0 && (
        <div className="flex flex-col gap-8">
          {groups.map(([periodicidade, items]) => (
            <section key={periodicidade} className="flex flex-col gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {PERIODICIDADE_LABEL[periodicidade]} · {items.length}
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {items.map((t) => (
                  <TreinamentoCard
                    key={t.id}
                    treinamento={t}
                    onEdit={() => setPanel({ mode: 'edit', treinamento: t })}
                    onToggleAtivo={() => handleToggleAtivo(t)}
                    onArchive={() => handleArchive(t)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {panel.mode !== 'closed' && (
        <FormPanel onClose={() => setPanel({ mode: 'closed' })}>
          <TreinamentoForm
            treinamento={panel.mode === 'edit' ? panel.treinamento : undefined}
            onSaved={() => setPanel({ mode: 'closed' })}
            onCancel={() => setPanel({ mode: 'closed' })}
          />
        </FormPanel>
      )}

      {importOpen && (
        <ImportTreinamentosModal
          onClose={() => setImportOpen(false)}
          onImported={() => {
            // Lista atualiza sozinha via subscribe — só deixa o modal aberto
            // no estado "done" pra o usuário revisar resultado.
          }}
        />
      )}

      {bibliotecaOpen && (
        <FormPanel onClose={() => setBibliotecaOpen(false)}>
          <BibliotecaTemplates onClose={() => setBibliotecaOpen(false)} />
        </FormPanel>
      )}

      {onboardingOpen && (
        <FormPanel onClose={() => setOnboardingOpen(false)}>
          <OnboardingPanel onClose={() => setOnboardingOpen(false)} />
        </FormPanel>
      )}

      {questoesOpen && (
        <FormPanel onClose={() => setQuestoesOpen(false)}>
          <BancoQuestoes onClose={() => setQuestoesOpen(false)} />
        </FormPanel>
      )}

      {configOpen && (
        <FormPanel onClose={() => setConfigOpen(false)}>
          <ConfigAlertasForm onClose={() => setConfigOpen(false)} />
        </FormPanel>
      )}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

interface TreinamentoCardProps {
  treinamento: Treinamento;
  onEdit: () => void;
  onToggleAtivo: () => void;
  onArchive: () => void;
}

function TreinamentoCard({
  treinamento: t,
  onEdit,
  onToggleAtivo,
  onArchive,
}: TreinamentoCardProps) {
  return (
    <article
      className={`flex flex-col gap-3 rounded-lg border bg-slate-900/60 p-4 ${
        t.ativo ? 'border-slate-800' : 'border-slate-800 opacity-60'
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-100">{t.titulo}</h3>
        <StatusBadge ativo={t.ativo} />
      </header>

      <p className="text-sm text-slate-400 line-clamp-2">{t.tema}</p>

      <dl className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-2 gap-y-1.5 text-xs text-slate-400">
        <MetaRow label="Carga" value={`${formatHoras(t.cargaHoraria)}`} />
        <MetaRow label="Responsável" value={t.responsavel} />
        <MetaRow label="Modalidade" value={MODALIDADE_LABEL[t.modalidade]} />
        <MetaRow label="Unidade" value={UNIDADE_LABEL[t.unidade]} />
      </dl>

      <footer className="flex items-center justify-end gap-1 border-t border-slate-800 pt-3">
        <button
          type="button"
          onClick={onEdit}
          className="rounded px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={onToggleAtivo}
          className="rounded px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          {t.ativo ? 'Desativar' : 'Ativar'}
        </button>
        <button
          type="button"
          onClick={onArchive}
          className="rounded px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10"
        >
          Arquivar
        </button>
      </footer>
    </article>
  );
}

function StatusBadge({ ativo }: { ativo: boolean }) {
  const cls = ativo
    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
    : 'bg-slate-700/40 text-slate-400 border border-slate-700';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {ativo ? 'Ativo' : 'Inativo'}
    </span>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-slate-500">{label}:</dt>
      <dd className="min-w-0 truncate text-slate-300">{value}</dd>
    </>
  );
}

// ─── Painel do form ───────────────────────────────────────────────────────────

function FormPanel({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex">
      <button
        type="button"
        aria-label="Fechar painel"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
      />
      <aside
        role="dialog"
        aria-modal="true"
        className="relative ml-auto flex h-full w-full max-w-xl flex-col gap-4 overflow-y-auto border-l border-slate-800 bg-slate-950 p-6 shadow-2xl"
      >
        {children}
      </aside>
    </div>
  );
}

// ─── Estados auxiliares ───────────────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-40 animate-pulse rounded-lg border border-slate-800 bg-slate-900/40"
        />
      ))}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-800 py-16 text-center">
      <p className="text-sm text-slate-400">
        Nenhum treinamento planejado ainda.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
      >
        Criar primeiro treinamento
      </button>
    </div>
  );
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

function formatHoras(h: number): string {
  if (Number.isInteger(h)) return `${h}h`;
  return `${h.toString().replace('.', ',')}h`;
}

/**
 * Agrupa treinamentos por periodicidade na ordem mensal→anual. Retorna tuplas
 * `[periodicidade, items]` somente para grupos não vazios — evita renderizar
 * seções vazias.
 */
function groupByPeriodicidade(
  list: Treinamento[],
): ReadonlyArray<readonly [Periodicidade, Treinamento[]]> {
  const ORDER: readonly Periodicidade[] = [
    'mensal',
    'bimestral',
    'trimestral',
    'semestral',
    'anual',
  ];
  const buckets = new Map<Periodicidade, Treinamento[]>();
  for (const p of ORDER) buckets.set(p, []);
  for (const t of list) {
    // Fase 10: periodicidade opcional. Treinamentos sem periodicidade
    // (tipo != periodico) ficam fora do agrupamento — view "Cards" é por
    // periodicidade e não faz sentido para tipos event-triggered.
    if (!t.periodicidade) continue;
    const bucket = buckets.get(t.periodicidade);
    if (bucket) bucket.push(t);
  }
  return ORDER
    .map((p) => [p, buckets.get(p) ?? []] as const)
    .filter(([, items]) => items.length > 0);
}
