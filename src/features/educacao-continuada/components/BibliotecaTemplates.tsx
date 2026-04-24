import { useMemo, useState } from 'react';

import { useKitsIntegracao } from '../hooks/useKitsIntegracao';
import { useTemplates } from '../hooks/useTemplates';
import type {
  KitIntegracao,
  TemplateTreinamento,
} from '../types/EducacaoContinuada';

import { KitIntegracaoForm } from './KitIntegracaoForm';
import { MaterialViewer } from './MaterialViewer';
import { TemplateForm } from './TemplateForm';

export interface BibliotecaTemplatesProps {
  onClose: () => void;
}

type View = 'templates' | 'kits';

type Panel =
  | { mode: 'none' }
  | { mode: 'template-create' }
  | { mode: 'template-edit'; template: TemplateTreinamento }
  | { mode: 'template-detail'; template: TemplateTreinamento }
  | { mode: 'kit-create' }
  | { mode: 'kit-edit'; kit: KitIntegracao };

/**
 * Painel unificado Templates + Kits (Fase 6). Montado dentro de um drawer
 * (fornecido pelo caller). Tem segment toggle interno para alternar entre
 * biblioteca de templates e kits de integração — evita adicionar uma 7ª tab
 * ao `EducacaoContinuadaView`.
 */
export function BibliotecaTemplates({ onClose }: BibliotecaTemplatesProps) {
  const [view, setView] = useState<View>('templates');
  const [busca, setBusca] = useState('');
  const [panel, setPanel] = useState<Panel>({ mode: 'none' });

  const { templates, softDelete: softDeleteTemplate } = useTemplates();
  const { kits, softDelete: softDeleteKit } = useKitsIntegracao();

  const templatesVisiveis = useMemo(() => {
    const needle = busca.trim().toLowerCase();
    if (!needle) return templates;
    return templates.filter(
      (t) =>
        t.titulo.toLowerCase().includes(needle) ||
        t.tema.toLowerCase().includes(needle) ||
        t.tags.some((tag) => tag.toLowerCase().includes(needle)),
    );
  }, [templates, busca]);

  const kitsVisiveis = useMemo(() => {
    const needle = busca.trim().toLowerCase();
    if (!needle) return kits;
    return kits.filter(
      (k) =>
        k.nome.toLowerCase().includes(needle) ||
        k.cargo.toLowerCase().includes(needle),
    );
  }, [kits, busca]);

  const handleArchiveTemplate = async (t: TemplateTreinamento): Promise<void> => {
    if (!window.confirm(`Arquivar template "${t.titulo}"?`)) return;
    try {
      await softDeleteTemplate(t.id);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Erro ao arquivar.');
    }
  };

  const handleArchiveKit = async (k: KitIntegracao): Promise<void> => {
    if (!window.confirm(`Arquivar kit "${k.nome}"?`)) return;
    try {
      await softDeleteKit(k.id);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Erro ao arquivar.');
    }
  };

  // Sub-panel: formulário ou detalhe substitui a lista principal
  if (panel.mode === 'template-create' || panel.mode === 'template-edit') {
    return (
      <BibliotecaHeader titulo="Biblioteca" onClose={onClose}>
        <TemplateForm
          template={panel.mode === 'template-edit' ? panel.template : undefined}
          onSaved={() => setPanel({ mode: 'none' })}
          onCancel={() => setPanel({ mode: 'none' })}
        />
      </BibliotecaHeader>
    );
  }

  if (panel.mode === 'template-detail') {
    return (
      <BibliotecaHeader titulo={`Template: ${panel.template.titulo}`} onClose={onClose}>
        <TemplateDetail
          template={panel.template}
          onBack={() => setPanel({ mode: 'none' })}
          onEdit={() => setPanel({ mode: 'template-edit', template: panel.template })}
        />
      </BibliotecaHeader>
    );
  }

  if (panel.mode === 'kit-create' || panel.mode === 'kit-edit') {
    return (
      <BibliotecaHeader titulo="Biblioteca" onClose={onClose}>
        <KitIntegracaoForm
          kit={panel.mode === 'kit-edit' ? panel.kit : undefined}
          onSaved={() => setPanel({ mode: 'none' })}
          onCancel={() => setPanel({ mode: 'none' })}
        />
      </BibliotecaHeader>
    );
  }

  // Lista principal
  return (
    <BibliotecaHeader titulo="Biblioteca" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div
          role="tablist"
          aria-label="Vista da biblioteca"
          className="flex rounded-lg border border-slate-800 bg-slate-900/50 p-0.5"
        >
          <SegmentTab active={view === 'templates'} onClick={() => setView('templates')}>
            Templates ({templates.length})
          </SegmentTab>
          <SegmentTab active={view === 'kits'} onClick={() => setView('kits')}>
            Kits ({kits.length})
          </SegmentTab>
        </div>

        <div className="flex gap-2">
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={view === 'templates' ? 'Buscar por título, tema ou tag…' : 'Buscar por nome ou cargo…'}
            aria-label="Buscar"
            className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() =>
              setPanel(
                view === 'templates'
                  ? { mode: 'template-create' }
                  : { mode: 'kit-create' },
              )
            }
            className="shrink-0 rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            {view === 'templates' ? 'Novo template' : 'Novo kit'}
          </button>
        </div>

        {view === 'templates' && (
          <TemplatesList
            templates={templatesVisiveis}
            onOpen={(t) => setPanel({ mode: 'template-detail', template: t })}
            onEdit={(t) => setPanel({ mode: 'template-edit', template: t })}
            onArchive={(t) => void handleArchiveTemplate(t)}
          />
        )}

        {view === 'kits' && (
          <KitsList
            kits={kitsVisiveis}
            onEdit={(k) => setPanel({ mode: 'kit-edit', kit: k })}
            onArchive={(k) => void handleArchiveKit(k)}
          />
        )}
      </div>
    </BibliotecaHeader>
  );
}

function BibliotecaHeader({
  titulo,
  onClose,
  children,
}: {
  titulo: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col gap-4">
      <header className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h2 className="text-lg font-semibold text-slate-100">{titulo}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        >
          ✕
        </button>
      </header>
      {children}
    </div>
  );
}

function SegmentTab({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active ? 'true' : 'false'}
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'bg-slate-800 text-slate-100 shadow-sm'
          : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

// ─── Templates list ──────────────────────────────────────────────────────────

function TemplatesList({
  templates,
  onOpen,
  onEdit,
  onArchive,
}: {
  templates: TemplateTreinamento[];
  onOpen: (t: TemplateTreinamento) => void;
  onEdit: (t: TemplateTreinamento) => void;
  onArchive: (t: TemplateTreinamento) => void;
}) {
  if (templates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-800 py-12 text-center text-sm text-slate-400">
        Nenhum template encontrado.
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {templates.map((t) => (
        <li
          key={t.id}
          className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3"
        >
          <button
            type="button"
            onClick={() => onOpen(t)}
            className="flex-1 text-left"
          >
            <p className="truncate text-sm font-semibold text-slate-100 hover:text-emerald-300">
              {t.titulo}
            </p>
            <p className="truncate text-xs text-slate-400">{t.tema}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <span className="rounded-full border border-slate-700 bg-slate-800/40 px-1.5 py-0.5 text-[10px] text-slate-400">
                v{t.versao}
              </span>
              <span className="rounded-full border border-slate-700 bg-slate-800/40 px-1.5 py-0.5 text-[10px] text-slate-400">
                {t.periodicidade} · {t.cargaHoraria}h
              </span>
              {t.materialDidatico.length > 0 && (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">
                  {t.materialDidatico.length} material(is)
                </span>
              )}
              {t.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-slate-700 bg-slate-800/40 px-1.5 py-0.5 text-[10px] text-slate-400"
                >
                  #{tag}
                </span>
              ))}
              {t.tags.length > 3 && (
                <span className="text-[10px] text-slate-500">
                  +{t.tags.length - 3}
                </span>
              )}
            </div>
          </button>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit(t)}
              className="rounded px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => onArchive(t)}
              className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
            >
              Arquivar
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─── Template detail ─────────────────────────────────────────────────────────

function TemplateDetail({
  template,
  onBack,
  onEdit,
}: {
  template: TemplateTreinamento;
  onBack: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded px-2 py-1 text-sm text-slate-300 hover:bg-slate-800"
        >
          ← Voltar
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
        >
          Editar template
        </button>
      </div>

      <dl className="grid grid-cols-1 gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4 sm:grid-cols-2">
        <DetailRow label="Tema" value={template.tema} />
        <DetailRow label="Carga horária" value={`${template.cargaHoraria}h`} />
        <DetailRow label="Modalidade" value={template.modalidade} />
        <DetailRow label="Periodicidade" value={template.periodicidade} />
        <DetailRow label="Versão" value={`v${template.versao}`} />
        <DetailRow label="Status" value={template.ativo ? 'Ativo' : 'Inativo'} />
      </dl>

      <section className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Objetivo
        </h3>
        <p className="whitespace-pre-wrap text-sm text-slate-200">{template.objetivo}</p>
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Pauta padrão
        </h3>
        <p className="whitespace-pre-wrap text-sm text-slate-200">{template.pauta}</p>
      </section>

      {template.tags.length > 0 && (
        <section className="flex flex-wrap gap-1.5">
          {template.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-slate-700 bg-slate-800/40 px-2 py-0.5 text-xs text-slate-300"
            >
              #{tag}
            </span>
          ))}
        </section>
      )}

      {template.materialDidatico.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Materiais ({template.materialDidatico.length})
          </h3>
          <ul className="flex flex-col gap-4">
            {template.materialDidatico.map((m) => (
              <li key={m.id} className="flex flex-col gap-2">
                <p className="text-sm font-medium text-slate-200">
                  {m.titulo}{' '}
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">
                    {m.tipo}
                  </span>
                </p>
                <MaterialViewer material={m} height={360} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-xs uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-200">{value}</dd>
    </>
  );
}

// ─── Kits list ───────────────────────────────────────────────────────────────

function KitsList({
  kits,
  onEdit,
  onArchive,
}: {
  kits: KitIntegracao[];
  onEdit: (k: KitIntegracao) => void;
  onArchive: (k: KitIntegracao) => void;
}) {
  if (kits.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-800 py-12 text-center text-sm text-slate-400">
        Nenhum kit encontrado.
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {kits.map((k) => (
        <li
          key={k.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-100">{k.nome}</p>
            <p className="truncate text-xs text-slate-400">
              {k.cargo} · {k.templateIds.length} template(s)
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit(k)}
              className="rounded px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => onArchive(k)}
              className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
            >
              Arquivar
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
