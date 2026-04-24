import { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { useActiveLab } from '../../../store/useAuthStore';
import {
  formatDate,
  formatDateTime,
  type RelatorioFR001,
  type RelatorioFR013,
  type RelatorioFR027,
  type RelatorioPayload,
} from '../services/ecExportService';
import type {
  MetodoAvaliacaoCompetencia,
  Modalidade,
  Periodicidade,
  ResultadoCompetencia,
  ResultadoEficacia,
  Unidade,
} from '../types/EducacaoContinuada';

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
const METODO_LABEL: Record<MetodoAvaliacaoCompetencia, string> = {
  observacao_direta: 'Observação direta',
  teste_escrito: 'Teste escrito',
  simulacao_pratica: 'Simulação prática',
  revisao_registro: 'Revisão de registro',
};
const EFICACIA_LABEL: Record<ResultadoEficacia, string> = {
  eficaz: 'Eficaz',
  ineficaz: 'Ineficaz',
};
const COMPETENCIA_LABEL: Record<ResultadoCompetencia, string> = {
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  requer_retreinamento: 'Requer retreinamento',
};

export interface ECRelatorioPrintProps {
  payload: RelatorioPayload;
  onClose: () => void;
}

/**
 * Modal de pré-visualização + botão de impressão dos relatórios regulatórios.
 *
 * Usa `react-to-print` (mesma lib do módulo Uroanálise): o hook isola o nó
 * apontado por `contentRef` e imprime APENAS aquele conteúdo. Sem isso, o
 * `window.print()` nativo imprimia também a tela atrás do modal (tab + app
 * shell) nas primeiras páginas, quebrando o FR-001/FR-027.
 *
 * Usuário clica "Imprimir" → diálogo nativo abre com só o relatório no
 * preview → "Salvar como PDF" arquiva.
 */
export function ECRelatorioPrint({ payload, onClose }: ECRelatorioPrintProps) {
  const lab = useActiveLab();
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: documentTitlePorTipo(payload),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="relatorio-title"
        className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-950 shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex flex-col gap-0.5">
            <h2 id="relatorio-title" className="text-base font-semibold text-slate-100">
              Pré-visualização — {payload.tipo}
            </h2>
            <p className="text-xs text-slate-400">
              Clique em "Imprimir" e selecione "Salvar como PDF" para arquivar.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="rounded-md bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Imprimir
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-white text-slate-900">
          <div ref={printRef} className="p-10">
            <style>{`
              @media print {
                @page { size: A4 portrait; margin: 14mm 14mm; }
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .avoid-break { page-break-inside: avoid; break-inside: avoid; }
              }
            `}</style>
            <RelatorioHeader titulo={labelPorTipo(payload.tipo)} labNome={lab?.name ?? '—'} />
            {payload.tipo === 'FR-001' && <FR001Body payload={payload} />}
            {payload.tipo === 'FR-013' && <FR013Body payload={payload} />}
            {payload.tipo === 'FR-027' && <FR027Body payload={payload} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function documentTitlePorTipo(payload: RelatorioPayload): string {
  const hoje = new Date().toISOString().slice(0, 10);
  if (payload.tipo === 'FR-001') {
    return `FR-001_${payload.treinamento.titulo.replace(/\s+/g, '_')}_${hoje}`;
  }
  if (payload.tipo === 'FR-013') {
    return `FR-013_AcaoCorretiva_${payload.treinamento.titulo.replace(/\s+/g, '_')}_${hoje}`;
  }
  return `FR-027_Planejamento_${hoje}`;
}

function labelPorTipo(tipo: RelatorioPayload['tipo']): string {
  if (tipo === 'FR-001') return 'FR-001 — Registro de execução de treinamento';
  if (tipo === 'FR-013') return 'FR-013 — Ação corretiva';
  return 'FR-027 — Planejamento de educação continuada';
}

// ─── Layouts por tipo ─────────────────────────────────────────────────────────

function RelatorioHeader({ titulo, labNome }: { titulo: string; labNome: string }) {
  return (
    <header className="mb-6 flex items-end justify-between border-b border-slate-300 pb-4">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{labNome}</p>
        <h1 className="text-xl font-semibold text-slate-900">{titulo}</h1>
      </div>
      <div className="text-xs text-slate-500">
        Emitido em {new Date().toLocaleString('pt-BR')}
      </div>
    </header>
  );
}

function FR001Body({ payload }: { payload: RelatorioFR001 }) {
  const {
    execucao,
    treinamento,
    participantes,
    avaliacaoEficacia,
    avaliacoesCompetencia,
  } = payload;
  const presentes = participantes.filter((p) => p.presente);
  const competenciaPorColab = new Map(
    avaliacoesCompetencia.map((a) => [a.colaboradorId, a] as const),
  );
  const totalAvaliados = presentes.filter((p) =>
    competenciaPorColab.has(p.colaborador.id),
  ).length;
  return (
    <div className="flex flex-col gap-6 text-sm">
      <Section titulo="Treinamento">
        <Row label="Título" value={treinamento.titulo} />
        <Row label="Tema" value={treinamento.tema} />
        <Row label="Responsável" value={treinamento.responsavel} />
        <Row label="Carga horária" value={`${treinamento.cargaHoraria} h`} />
        <Row label="Modalidade" value={MODALIDADE_LABEL[treinamento.modalidade]} />
        <Row label="Unidade" value={UNIDADE_LABEL[treinamento.unidade]} />
        <Row
          label="Periodicidade"
          value={treinamento.periodicidade ? PERIODICIDADE_LABEL[treinamento.periodicidade] : '—'}
        />
      </Section>

      <Section titulo="Execução">
        <Row label="Data planejada" value={formatDate(execucao.dataPlanejada)} />
        <Row label="Data aplicação" value={formatDate(execucao.dataAplicacao)} />
        <Row label="Ministrante" value={execucao.ministrante || '—'} />
        <Row label="Status" value={execucao.status} />
        <Row label="Pauta" value={execucao.pauta || '—'} multiline />
        <Row label="Assinatura (hash)" value={execucao.assinatura.hash} mono />
        <Row label="Assinante" value={execucao.assinatura.operatorId} />
        <Row label="Assinado em" value={formatDateTime(execucao.assinatura.ts)} />
      </Section>

      <Section titulo={`Participantes (${presentes.length}/${participantes.length} presentes)`}>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-300 text-left text-slate-500">
              <th className="py-1 pr-2">Nome</th>
              <th className="py-1 pr-2">Cargo</th>
              <th className="py-1 pr-2">Setor</th>
              <th className="py-1">Presença</th>
            </tr>
          </thead>
          <tbody>
            {participantes.map((p) => (
              <tr key={p.colaborador.id} className="border-b border-slate-200">
                <td className="py-1.5 pr-2">{p.colaborador.nome}</td>
                <td className="py-1.5 pr-2">{p.colaborador.cargo}</td>
                <td className="py-1.5 pr-2">{p.colaborador.setor}</td>
                <td className="py-1.5">{p.presente ? 'Presente' : 'Ausente'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {avaliacaoEficacia && (
        <Section titulo="Avaliação de eficácia">
          <Row label="Resultado" value={EFICACIA_LABEL[avaliacaoEficacia.resultado]} />
          <Row label="Data avaliação" value={formatDate(avaliacaoEficacia.dataAvaliacao)} />
          <Row label="Fechamento" value={formatDate(avaliacaoEficacia.dataFechamento)} />
          <Row label="Evidência" value={avaliacaoEficacia.evidencia} multiline />
          {avaliacaoEficacia.acaoCorretiva && (
            <Row label="Ação corretiva" value={avaliacaoEficacia.acaoCorretiva} multiline />
          )}
          <Row label="Assinatura (hash)" value={avaliacaoEficacia.assinatura.hash} mono />
          <Row label="Assinante" value={avaliacaoEficacia.assinatura.operatorId} />
        </Section>
      )}

      <Section
        titulo={`Avaliação de competência individual (${totalAvaliados}/${presentes.length})`}
      >
        {presentes.length === 0 ? (
          <p className="text-xs italic text-slate-500">
            Sem participantes presentes nesta execução.
          </p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-300 text-left text-slate-500">
                <th className="py-1 pr-2">Colaborador</th>
                <th className="py-1 pr-2">Método</th>
                <th className="py-1 pr-2">Resultado</th>
                <th className="py-1">Próxima avaliação</th>
              </tr>
            </thead>
            <tbody>
              {presentes.map((p) => {
                const av = competenciaPorColab.get(p.colaborador.id);
                return (
                  <tr key={p.colaborador.id} className="border-b border-slate-200">
                    <td className="py-1.5 pr-2">{p.colaborador.nome}</td>
                    {av ? (
                      <>
                        <td className="py-1.5 pr-2">{METODO_LABEL[av.metodo]}</td>
                        <td className="py-1.5 pr-2">{COMPETENCIA_LABEL[av.resultado]}</td>
                        <td className="py-1.5">{formatDate(av.proximaAvaliacaoEm)}</td>
                      </>
                    ) : (
                      <>
                        <td className="py-1.5 pr-2 text-slate-400">—</td>
                        <td className="py-1.5 pr-2 font-semibold text-amber-700">
                          Pendente
                        </td>
                        <td className="py-1.5 text-slate-400">—</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

function FR013Body({ payload }: { payload: RelatorioFR013 }) {
  const { avaliacaoEficacia, execucao, treinamento } = payload;
  return (
    <div className="flex flex-col gap-6 text-sm">
      <Section titulo="Origem">
        <Row label="Treinamento" value={treinamento.titulo} />
        <Row label="Data aplicação" value={formatDate(execucao.dataAplicacao)} />
        <Row label="Ministrante" value={execucao.ministrante || '—'} />
      </Section>

      <Section titulo="Avaliação que gerou a ação">
        <Row label="Resultado" value={EFICACIA_LABEL[avaliacaoEficacia.resultado]} />
        <Row label="Data avaliação" value={formatDate(avaliacaoEficacia.dataAvaliacao)} />
        <Row label="Evidência" value={avaliacaoEficacia.evidencia} multiline />
      </Section>

      <Section titulo="Ação corretiva">
        <Row label="Descrição" value={avaliacaoEficacia.acaoCorretiva || '—'} multiline />
        <Row label="Data fechamento" value={formatDate(avaliacaoEficacia.dataFechamento)} />
      </Section>

      <Section titulo="Rastreabilidade">
        <Row label="Assinatura (hash)" value={avaliacaoEficacia.assinatura.hash} mono />
        <Row label="Assinante" value={avaliacaoEficacia.assinatura.operatorId} />
        <Row label="Assinado em" value={formatDateTime(avaliacaoEficacia.assinatura.ts)} />
      </Section>
    </div>
  );
}

function FR027Body({ payload }: { payload: RelatorioFR027 }) {
  const { treinamentos, periodoInicio, periodoFim } = payload;
  return (
    <div className="flex flex-col gap-6 text-sm">
      <Section titulo="Período">
        <Row label="Início" value={formatDate(periodoInicio)} />
        <Row label="Fim" value={formatDate(periodoFim)} />
        <Row label="Total de treinamentos planejados" value={String(treinamentos.length)} />
      </Section>

      <Section titulo="Treinamentos">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-300 text-left text-slate-500">
              <th className="py-1 pr-2">Título</th>
              <th className="py-1 pr-2">Tema</th>
              <th className="py-1 pr-2">Carga</th>
              <th className="py-1 pr-2">Modalidade</th>
              <th className="py-1 pr-2">Periodicidade</th>
              <th className="py-1">Responsável</th>
            </tr>
          </thead>
          <tbody>
            {treinamentos.map((t) => (
              <tr key={t.id} className="border-b border-slate-200">
                <td className="py-1.5 pr-2 font-medium">{t.titulo}</td>
                <td className="py-1.5 pr-2">{t.tema}</td>
                <td className="py-1.5 pr-2">{t.cargaHoraria} h</td>
                <td className="py-1.5 pr-2">{MODALIDADE_LABEL[t.modalidade]}</td>
                <td className="py-1.5 pr-2">
                  {t.periodicidade ? PERIODICIDADE_LABEL[t.periodicidade] : '—'}
                </td>
                <td className="py-1.5">{t.responsavel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

// ─── Primitives visuais ───────────────────────────────────────────────────────

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{titulo}</h3>
      <div className="flex flex-col gap-1 border-t border-slate-200 pt-2">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  multiline,
  mono,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  mono?: boolean;
}) {
  if (multiline) {
    return (
      <div className="flex flex-col gap-0.5 py-1">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <p className={`text-sm text-slate-900 ${mono ? 'font-mono text-xs break-all' : ''}`}>{value}</p>
      </div>
    );
  }
  return (
    <div className="flex gap-2 py-0.5">
      <span className="w-36 shrink-0 text-xs font-medium text-slate-500">{label}</span>
      <span className={`text-sm text-slate-900 ${mono ? 'font-mono text-xs break-all' : ''}`}>{value}</span>
    </div>
  );
}
