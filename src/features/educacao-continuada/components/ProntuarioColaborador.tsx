import { useMemo, useState } from 'react';

import { useAvaliacaoCompetencia } from '../hooks/useAvaliacaoCompetencia';
import { useCertificados } from '../hooks/useCertificados';
import { useExecucoes } from '../hooks/useExecucoes';
import { useParticipantes } from '../hooks/useParticipantes';
import { useTreinamentos } from '../hooks/useTreinamentos';
import type {
  AvaliacaoCompetencia,
  Certificado,
  Colaborador,
  Execucao,
  MetodoAvaliacaoCompetencia,
  Participante,
  ResultadoCompetencia,
  Treinamento,
} from '../types/EducacaoContinuada';

import { CertificadoViewer } from './CertificadoViewer';
import { TrilhaProgressoView } from './TrilhaProgressoView';

export interface ProntuarioColaboradorProps {
  colaborador: Colaborador;
  onClose: () => void;
}

const METODO_LABEL: Record<MetodoAvaliacaoCompetencia, string> = {
  observacao_direta: 'Observação direta',
  teste_escrito: 'Teste escrito',
  simulacao_pratica: 'Simulação prática',
  revisao_registro: 'Revisão de registro',
};

const RESULTADO_LABEL: Record<ResultadoCompetencia, string> = {
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  requer_retreinamento: 'Requer retreinamento',
};

/**
 * Prontuário do colaborador: histórico de participações, avaliações de
 * competência, **trilhas de aprendizado** (Fase 7) e **certificados emitidos**
 * (Fase 9). Flag visual (RN-04) quando houver AvaliacaoCompetencia com
 * resultado 'reprovado' sem reavaliação aprovada posterior.
 *
 * Avaliações com resultado 'aprovado' mostram botão "Gerar certificado"
 * quando ainda não houver certificado associado (Fase 9 via `ec_gerarCertificado`).
 */
export function ProntuarioColaborador({ colaborador, onClose }: ProntuarioColaboradorProps) {
  const { participantes, isLoading: loadingPart } = useParticipantes({
    colaboradorId: colaborador.id,
  });
  const { avaliacoes, isLoading: loadingAval } = useAvaliacaoCompetencia({
    colaboradorId: colaborador.id,
  });
  const { execucoes, isLoading: loadingExec } = useExecucoes({ includeDeleted: true });
  const { treinamentos } = useTreinamentos({ includeDeleted: true });
  const { certificados, gerar: gerarCertificado } = useCertificados({
    colaboradorId: colaborador.id,
  });

  const execMap = useMemo(() => {
    const m = new Map<string, Execucao>();
    for (const e of execucoes) m.set(e.id, e);
    return m;
  }, [execucoes]);

  const treinamentoMap = useMemo(() => {
    const m = new Map<string, Treinamento>();
    for (const t of treinamentos) m.set(t.id, t);
    return m;
  }, [treinamentos]);

  /** Índice avaliacaoCompetenciaId → Certificado (se já foi emitido). */
  const certificadoPorAvaliacao = useMemo(() => {
    const m = new Map<string, Certificado>();
    for (const c of certificados) m.set(c.avaliacaoCompetenciaId, c);
    return m;
  }, [certificados]);

  const requerAlerta = useMemo<boolean>(() => {
    const porTreinamento = new Map<string, AvaliacaoCompetencia>();
    for (const a of avaliacoes) {
      const exec = execMap.get(a.execucaoId);
      if (!exec) continue;
      const treinamentoId = exec.treinamentoId;
      const atual = porTreinamento.get(treinamentoId);
      if (!atual || a.dataAvaliacao.toMillis() > atual.dataAvaliacao.toMillis()) {
        porTreinamento.set(treinamentoId, a);
      }
    }
    return Array.from(porTreinamento.values()).some((a) => a.resultado === 'reprovado');
  }, [avaliacoes, execMap]);

  const historicoParticipacoes = useMemo(() => {
    return participantes
      .map((p) => {
        const exec = execMap.get(p.execucaoId);
        const treinamento = exec ? treinamentoMap.get(exec.treinamentoId) : undefined;
        return { participante: p, execucao: exec, treinamento };
      })
      .filter((item) => item.execucao)
      .sort((a, b) => {
        const da = a.execucao?.dataAplicacao?.toMillis() ?? a.execucao?.dataPlanejada.toMillis() ?? 0;
        const db = b.execucao?.dataAplicacao?.toMillis() ?? b.execucao?.dataPlanejada.toMillis() ?? 0;
        return db - da;
      });
  }, [participantes, execMap, treinamentoMap]);

  const historicoAvaliacoes = useMemo(() => {
    return avaliacoes
      .map((a) => {
        const exec = execMap.get(a.execucaoId);
        const treinamento = exec ? treinamentoMap.get(exec.treinamentoId) : undefined;
        return { avaliacao: a, execucao: exec, treinamento };
      })
      .sort((a, b) => b.avaliacao.dataAvaliacao.toMillis() - a.avaliacao.dataAvaliacao.toMillis());
  }, [avaliacoes, execMap, treinamentoMap]);

  const totalPresencas = participantes.filter((p) => p.presente).length;
  const totalAusencias = participantes.filter((p) => !p.presente).length;

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-slate-100">{colaborador.nome}</h2>
            {requerAlerta && (
              <span
                role="status"
                className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-300"
              >
                Requer retreinamento
              </span>
            )}
            {!colaborador.ativo && (
              <span className="rounded-full border border-slate-700 bg-slate-800/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Inativo
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400">
            {colaborador.cargo} · {colaborador.setor}
          </p>
          <p className="text-xs text-slate-500">
            {totalPresencas} presença(s) · {totalAusencias} ausência(s) · {avaliacoes.length} avaliação(ões) de competência · {certificados.length} certificado(s)
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
        >
          Fechar
        </button>
      </header>

      <Section title="Participações em treinamentos">
        {loadingPart || loadingExec ? (
          <Skeleton rows={3} />
        ) : historicoParticipacoes.length === 0 ? (
          <Empty text="Nenhuma participação registrada." />
        ) : (
          <ul className="flex flex-col divide-y divide-slate-800/60">
            {historicoParticipacoes.map(({ participante, execucao, treinamento }) => (
              <li key={participante.id} className="py-2.5">
                <ParticipacaoItem
                  participante={participante}
                  execucao={execucao}
                  treinamento={treinamento}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Avaliações de competência">
        {loadingAval ? (
          <Skeleton rows={2} />
        ) : historicoAvaliacoes.length === 0 ? (
          <Empty text="Nenhuma avaliação registrada." />
        ) : (
          <ul className="flex flex-col divide-y divide-slate-800/60">
            {historicoAvaliacoes.map(({ avaliacao, treinamento }) => (
              <li key={avaliacao.id} className="py-2.5">
                <AvaliacaoItem
                  avaliacao={avaliacao}
                  treinamento={treinamento}
                  certificadoExistente={certificadoPorAvaliacao.get(avaliacao.id)}
                  onGerarCertificado={gerarCertificado}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Fase 7 — Trilhas em andamento/concluídas */}
      <Section title="Trilhas de aprendizado">
        <div className="py-2">
          <TrilhaProgressoView
            colaboradorId={colaborador.id}
            colaboradorNome={colaborador.nome}
          />
        </div>
      </Section>

      {/* Fase 9 — Certificados emitidos */}
      <Section title="Certificados emitidos">
        <div className="py-2">
          <CertificadoViewer
            colaboradorId={colaborador.id}
            colaboradorNome={colaborador.nome}
          />
        </div>
      </Section>
    </div>
  );
}

// ─── Seções ───────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
      <div className="rounded-md border border-slate-800 bg-slate-900/40 px-3 py-1">
        {children}
      </div>
    </section>
  );
}

function ParticipacaoItem({
  participante,
  execucao,
  treinamento,
}: {
  participante: Participante;
  execucao: Execucao | undefined;
  treinamento: Treinamento | undefined;
}) {
  const data = execucao?.dataAplicacao ?? execucao?.dataPlanejada ?? null;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm text-slate-100">
          {treinamento?.titulo ?? 'Treinamento não encontrado'}
        </span>
        <span className="text-xs text-slate-500">
          {data ? data.toDate().toLocaleDateString('pt-BR') : 's/data'}
          {execucao && ` · ${execucao.status}`}
        </span>
      </div>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
          participante.presente
            ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            : 'border border-slate-700 bg-slate-800/40 text-slate-400'
        }`}
      >
        {participante.presente ? 'Presente' : 'Ausente'}
      </span>
    </div>
  );
}

function AvaliacaoItem({
  avaliacao,
  treinamento,
  certificadoExistente,
  onGerarCertificado,
}: {
  avaliacao: AvaliacaoCompetencia;
  treinamento: Treinamento | undefined;
  certificadoExistente: Certificado | undefined;
  onGerarCertificado: (avaliacaoCompetenciaId: string) => Promise<{
    certificadoId: string;
    pdfDownloadUrl: string;
    qrCodePayload: string;
  }>;
}) {
  const [isGerando, setIsGerando] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cor =
    avaliacao.resultado === 'aprovado'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      : avaliacao.resultado === 'reprovado'
        ? 'border-red-500/30 bg-red-500/10 text-red-300'
        : 'border-amber-500/30 bg-amber-500/10 text-amber-300';

  const handleGerar = async (): Promise<void> => {
    setErr(null);
    setIsGerando(true);
    try {
      await onGerarCertificado(avaliacao.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao gerar certificado.');
      setIsGerando(false);
    }
  };

  const podeGerar =
    avaliacao.resultado === 'aprovado' && !certificadoExistente;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm text-slate-100">
            {treinamento?.titulo ?? 'Treinamento não encontrado'}
          </span>
          <span className="text-xs text-slate-500">
            {avaliacao.dataAvaliacao.toDate().toLocaleDateString('pt-BR')} · {METODO_LABEL[avaliacao.metodo]}
            {avaliacao.proximaAvaliacaoEm &&
              ` · reavaliar em ${avaliacao.proximaAvaliacaoEm.toDate().toLocaleDateString('pt-BR')}`}
          </span>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cor}`}
        >
          {RESULTADO_LABEL[avaliacao.resultado]}
        </span>
      </div>

      {avaliacao.resultado === 'aprovado' && (
        <div className="flex flex-wrap items-center gap-2">
          {certificadoExistente ? (
            <>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                Certificado emitido
              </span>
              <a
                href={certificadoExistente.pdfDownloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800"
              >
                Baixar PDF
              </a>
              <a
                href={certificadoExistente.qrCodePayload}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800"
              >
                Verificar QR
              </a>
            </>
          ) : podeGerar ? (
            <button
              type="button"
              onClick={() => void handleGerar()}
              disabled={isGerando}
              className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              {isGerando ? 'Gerando…' : 'Gerar certificado'}
            </button>
          ) : null}
          {err && (
            <span role="alert" className="text-xs text-red-400">
              {err}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2 py-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded bg-slate-800/40" />
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-xs text-slate-500">{text}</p>;
}
