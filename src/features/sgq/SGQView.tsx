/**
 * SGQView — entry point do módulo Sistema de Gestão da Qualidade.
 *
 * MVP cobre Documentos da Qualidade (DICQ 4.3). v2 adiciona NCs cross-domain,
 * indicadores agregados, plano de riscos e análise crítica da direção.
 *
 * Decisão de IA: o MVP é deliberadamente focado. Cobertura de 4.3 inteiro é
 * o multiplicador. Empilhar NC + Riscos + Indicadores aqui na primeira versão
 * dilui qualidade. Cada um merece módulo próprio com seu próprio CLAUDE.md.
 */

import { useMemo, useState } from 'react';

import { useAppStore } from '../../store/useAppStore';
import { DocumentoFormModal } from './components/DocumentoFormModal';
import { DocumentosListView } from './components/DocumentosListView';
import { ImportarLM01Modal } from './components/ImportarLM01Modal';
import POPsList from './pops/components/POPsList';
import { useDocumentos } from './hooks/useDocumentos';
import {
  isVencido,
  isProximoVencimento,
  sugerirProximoCodigo,
  TIPO_LABEL,
  type Documento,
  type DocumentoInput,
  type StatusDocumento,
  type TipoDocumento,
} from './types/Documento';

type FiltroTipo = TipoDocumento | 'todos';
type FiltroStatus = StatusDocumento | 'todos';
type SGQTab = 'documentos' | 'procedimentos';

interface ConfirmacaoState {
  doc: Documento;
  toStatus: StatusDocumento;
  motivoPlaceholder: string;
}

export function SGQView() {
  const setCurrentView = useAppStore((s) => s.setCurrentView);

  const [tab, setTab] = useState<SGQTab>('documentos');
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [incluirObsoletos, setIncluirObsoletos] = useState(false);

  // Busca todos os documentos (incluindo obsoletos), filtra no client.
  // Volume esperado por lab: dezenas a poucas centenas de documentos.
  const { documentos, isLoading, criar, atualizar, mudarStatus, emitirRevisao, remover } =
    useDocumentos({ filters: { includeObsoletos: true } });

  const documentosFiltrados = useMemo(() => {
    return documentos.filter((d) => {
      if (filtroTipo !== 'todos' && d.tipo !== filtroTipo) return false;
      if (filtroStatus !== 'todos' && d.status !== filtroStatus) return false;
      if (!incluirObsoletos && d.status === 'obsoleto') return false;
      return true;
    });
  }, [documentos, filtroTipo, filtroStatus, incluirObsoletos]);

  // KPIs do header
  const kpis = useMemo(() => {
    const vigentes = documentos.filter((d) => d.status === 'vigente');
    const emRevisao = documentos.filter((d) => d.status === 'em_revisao');
    const vencidos = vigentes.filter((d) => isVencido(d));
    const proximos = vigentes.filter(
      (d) => !isVencido(d) && isProximoVencimento(d),
    );
    return {
      total: documentos.filter((d) => d.status !== 'obsoleto').length,
      vigentes: vigentes.length,
      emRevisao: emRevisao.length,
      vencidos: vencidos.length,
      proximos: proximos.length,
    };
  }, [documentos]);

  const [editando, setEditando] = useState<Documento | null>(null);
  const [revisaoDe, setRevisaoDe] = useState<Documento | null>(null);
  const [criando, setCriando] = useState<TipoDocumento | null>(null);
  const [importing, setImporting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<ConfirmacaoState | null>(null);
  const [motivoConfirmacao, setMotivoConfirmacao] = useState('');

  const codigoSugerido = useMemo(() => {
    if (!criando) return undefined;
    return sugerirProximoCodigo(criando, documentos);
  }, [criando, documentos]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleSubmit = async (
    input: DocumentoInput,
    mode: 'criar' | 'editar' | 'revisao',
  ) => {
    setErro(null);
    if (mode === 'criar') {
      await criar(input);
      setCriando(null);
    } else if (mode === 'editar' && editando) {
      await atualizar(editando.id, input);
      setEditando(null);
    } else if (mode === 'revisao' && revisaoDe) {
      await emitirRevisao(revisaoDe.id, input);
      setRevisaoDe(null);
    }
  };

  const handleMudarStatus = (doc: Documento, toStatus: StatusDocumento) => {
    // Publicação direta (em_revisao → vigente) não exige motivo.
    if (doc.status === 'em_revisao' && toStatus === 'vigente') {
      mudarStatus(doc.id, toStatus).catch((e) => {
        setErro(e instanceof Error ? e.message : 'Erro ao publicar.');
      });
      return;
    }
    // Demais transições (volta a rascunho, descontinuação) abrem confirmação.
    setMotivoConfirmacao('');
    setConfirmacao({
      doc,
      toStatus,
      motivoPlaceholder:
        toStatus === 'obsoleto'
          ? 'Motivo da descontinuação (≥10 caracteres)…'
          : 'Motivo da volta a rascunho (≥10 caracteres)…',
    });
  };

  const confirmarMudancaStatus = async () => {
    if (!confirmacao) return;
    setErro(null);
    try {
      await mudarStatus(confirmacao.doc.id, confirmacao.toStatus, motivoConfirmacao);
      setConfirmacao(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao mudar status.');
    }
  };

  const handleRemover = async (doc: Documento) => {
    setErro(null);
    if (!confirm(`Remover ${doc.codigo} (rascunho)? Esta ação é reversível via auditoria.`)) {
      return;
    }
    try {
      await remover(doc.id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao remover.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F14] text-white">
      {/* ── Topbar ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#0B0F14]/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6">
          <div className="h-14 flex items-center gap-4 border-b border-white/[0.06]">
            <button
              type="button"
              onClick={() => setCurrentView('hub')}
              className="text-xs text-white/50 hover:text-white/85"
            >
              ← Hub
            </button>
            <h1 className="text-base font-semibold">Gestão Documental</h1>
            <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              DICQ 4.3
            </span>
            <div className="flex-1" />
            {tab === 'documentos' && (
              <>
                <button
                  type="button"
                  onClick={() => setImporting(true)}
                  className="px-3 py-1.5 rounded-md text-sm font-medium text-white/65 hover:text-white/90 hover:bg-white/[0.05] transition-all"
                  title="Importa LM-01 (Lista Mestra) do Drive em bulk via TSV"
                >
                  Importar LM-01
                </button>
                <details className="relative">
                  <summary className="list-none cursor-pointer px-3 py-1.5 rounded-md bg-emerald-500 text-slate-950 text-sm font-semibold hover:bg-emerald-400">
                    + Novo documento
                  </summary>
                  <div className="absolute right-0 top-10 z-30 w-56 rounded-xl bg-[#151d2a] border border-white/[0.1] shadow-2xl py-1">
                    {(['MQ', 'PQ', 'IT', 'FR', 'POL'] as TipoDocumento[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setCriando(t)}
                        className="w-full text-left px-4 py-2 text-sm text-white/70 hover:bg-white/[0.05] hover:text-white"
                      >
                        <span className="font-mono text-emerald-400 mr-2">{t}</span>
                        <span className="text-white/60">{TIPO_LABEL[t]}</span>
                      </button>
                    ))}
                  </div>
                </details>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            {(['documentos', 'procedimentos'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t
                    ? 'border-emerald-500 text-white'
                    : 'border-transparent text-white/50 hover:text-white/70'
                }`}
              >
                {t === 'documentos' ? 'Documentos' : 'Procedimentos'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {tab === 'documentos' && (
        <>
        {/* ── KPIs ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Kpi label="Documentos" value={kpis.total} />
          <Kpi label="Vigentes" value={kpis.vigentes} tone="emerald" />
          <Kpi label="Em revisão" value={kpis.emRevisao} tone="slate" />
          <Kpi
            label="Próximos do prazo"
            value={kpis.proximos}
            tone={kpis.proximos > 0 ? 'amber' : 'slate'}
          />
          <Kpi
            label="Vencidos"
            value={kpis.vencidos}
            tone={kpis.vencidos > 0 ? 'red' : 'slate'}
          />
        </div>
        </>
        )}

        {/* ── Aviso de bootstrapping ───────────────────────────────── */}
        {documentos.length === 0 && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
            <h3 className="text-sm font-semibold text-emerald-300">
              Comece pela base da pirâmide documental
            </h3>
            <p className="text-xs text-white/60 mt-1.5 leading-relaxed">
              Auditor DICQ pede 3 evidências para 4.3: hierarquia documental,
              controle de versão e segregação de obsoletos. O caminho recomendado:
            </p>
            <ol className="text-xs text-white/55 mt-3 space-y-1.5 list-decimal list-inside">
              <li>
                <span className="text-emerald-300 font-mono">MQ-001</span> Manual da Qualidade — escopo, política, estrutura.
              </li>
              <li>
                <span className="text-emerald-300 font-mono">PQ-001</span> Procedimento de elaboração e aprovação de documentos.
              </li>
              <li>
                <span className="text-emerald-300 font-mono">PQ-002</span> Política de retenção e descarte (cobre 4.13).
              </li>
              <li>
                ITs (Instruções de Trabalho) por módulo analítico, conforme rotina.
              </li>
            </ol>
          </div>
        )}

        {tab === 'documentos' && (
        <>
        {erro && (
          <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {erro}
          </div>
        )}

        {/* ── Lista mestra ─────────────────────────────────────────── */}
        <DocumentosListView
          documentos={documentosFiltrados}
          isLoading={isLoading}
          filtroTipo={filtroTipo}
          filtroStatus={filtroStatus}
          incluirObsoletos={incluirObsoletos}
          onFiltroTipo={setFiltroTipo}
          onFiltroStatus={setFiltroStatus}
          onToggleObsoletos={() => setIncluirObsoletos((v) => !v)}
          onEditar={(d) => setEditando(d)}
          onRevisar={(d) => setRevisaoDe(d)}
          onMudarStatus={handleMudarStatus}
          onRemover={handleRemover}
        />
        </>
        )}

        {tab === 'procedimentos' && (
          <POPsList />
        )}
      </main>

      {/* ── Modais ─────────────────────────────────────────────────── */}
      {(criando || editando || revisaoDe) && (
        <DocumentoFormModal
          documento={editando ?? undefined}
          revisaoDe={revisaoDe ?? undefined}
          codigoSugerido={codigoSugerido}
          onClose={() => {
            setCriando(null);
            setEditando(null);
            setRevisaoDe(null);
          }}
          onSubmit={handleSubmit}
        />
      )}

      {importing && (
        <ImportarLM01Modal
          onClose={() => setImporting(false)}
        />
      )}

      {/* ── Confirmação de mudança de status com motivo ───────────── */}
      {confirmacao && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#141417] border border-white/[0.08] shadow-2xl">
            <div className="px-6 py-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">
                {confirmacao.toStatus === 'obsoleto'
                  ? `Descontinuar ${confirmacao.doc.codigo}?`
                  : `Voltar ${confirmacao.doc.codigo} a rascunho?`}
              </h3>
              <p className="text-xs text-white/50">
                Esta ação fica registrada no audit log com seu nome e timestamp.
              </p>
              <textarea
                value={motivoConfirmacao}
                onChange={(e) => setMotivoConfirmacao(e.target.value)}
                rows={3}
                placeholder={confirmacao.motivoPlaceholder}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-sm text-white/85 outline-none focus:border-emerald-500/50"
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmacao(null)}
                  className="px-4 py-2 rounded-md text-sm text-white/60 hover:bg-white/[0.05]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarMudancaStatus}
                  disabled={motivoConfirmacao.trim().length < 10}
                  className="px-4 py-2 rounded-md bg-emerald-500 text-slate-950 text-sm font-semibold hover:bg-emerald-400 disabled:opacity-40"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── KPI tile ────────────────────────────────────────────────────────────────

type KpiTone = 'emerald' | 'amber' | 'red' | 'slate';

function Kpi({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: number;
  tone?: KpiTone;
}) {
  const palette: Record<KpiTone, string> = {
    emerald: 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300',
    amber: 'border-amber-500/20 bg-amber-500/[0.06] text-amber-300',
    red: 'border-red-500/20 bg-red-500/[0.06] text-red-300',
    slate: 'border-white/[0.06] bg-white/[0.02] text-white/60',
  };

  return (
    <div className={`rounded-xl border p-4 ${palette[tone]}`}>
      <p className="text-[10px] uppercase tracking-wider font-semibold opacity-80">
        {label}
      </p>
      <p className="text-2xl font-semibold mt-1 tabular-nums">{value}</p>
    </div>
  );
}
