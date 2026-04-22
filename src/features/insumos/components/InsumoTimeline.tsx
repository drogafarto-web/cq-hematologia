/**
 * InsumoTimeline — linha do tempo auditável de um insumo.
 *
 * Narrativa:
 *   1. Quando entrou (createdAt)
 *   2. Abertura(s) — do log imutável insumo-movimentacoes
 *   3. Ativações no EquipmentSetup (virou ativo / saiu de ativo)
 *   4. Corridas que consumiram (contagem agregada — detalhe fica pro FR-10)
 *   5. Fechamento / Descarte, se houver
 *
 * Eixo temporal vertical, stroke violeta no rail, marcador por evento.
 * Pensado pra leitura de auditor — se um evento for relevante, o auditor
 * precisa identificar em 5s. Pt-BR, datas completas, operador explícito.
 *
 * Fonte de dados: duas subscriptions (movimentacoes + transitions filtradas
 * pelo insumoId). Render cliente-side ordenada ascendente por timestamp.
 */

import React, { useMemo } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { subscribeToMovimentacoes } from '../services/insumosFirebaseService';
import { subscribeToTransitions } from '../services/insumoTransitionService';
import { useEffect, useState } from 'react';
import type {
  Insumo,
  InsumoMovimentacao,
  InsumoMovimentacaoTipo,
} from '../types/Insumo';
import type { InsumoTransition, InsumoTransitionType } from '../types/InsumoTransition';
import type { Timestamp } from 'firebase/firestore';

// ─── Event model ─────────────────────────────────────────────────────────────

type TimelineEventKind =
  | 'movimentacao'
  | 'transition'
  | 'creation'
  | 'summary';

interface TimelineEvent {
  kind: TimelineEventKind;
  timestamp: Date;
  title: string;
  subtitle?: string;
  actor?: string;
  tone: 'neutral' | 'ok' | 'warn' | 'bad';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDateTime(d: Date): string {
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const MOV_LABEL: Record<InsumoMovimentacaoTipo, { title: string; tone: TimelineEvent['tone'] }> = {
  entrada: { title: 'Cadastrado no estoque', tone: 'neutral' },
  abertura: { title: 'Abertura / reconstituição', tone: 'ok' },
  fechamento: { title: 'Fechado', tone: 'neutral' },
  descarte: { title: 'Descartado', tone: 'bad' },
};

const TRANS_LABEL: Record<
  InsumoTransitionType,
  { titleAtivou: string; titleSaiu: string; tone: TimelineEvent['tone'] }
> = {
  activation: {
    titleAtivou: 'Virou ativo no setup',
    titleSaiu: 'Saiu do setup',
    tone: 'ok',
  },
  swap: {
    titleAtivou: 'Entrou no setup (troca)',
    titleSaiu: 'Substituído no setup',
    tone: 'neutral',
  },
  correction: {
    titleAtivou: 'Entrou no setup (correção)',
    titleSaiu: 'Removido por correção',
    tone: 'warn',
  },
  'override-vencido': {
    titleAtivou: 'Ativado com override (vencido)',
    titleSaiu: 'Removido após override',
    tone: 'bad',
  },
  'override-qc-pendente': {
    titleAtivou: 'Ativado com override (CQ pendente)',
    titleSaiu: 'Removido após override',
    tone: 'warn',
  },
};

function tsToDate(ts: Timestamp | null | undefined): Date | null {
  if (!ts) return null;
  try {
    return ts.toDate();
  } catch {
    return null;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

interface InsumoTimelineProps {
  insumo: Insumo;
}

export function InsumoTimeline({ insumo }: InsumoTimelineProps) {
  const labId = useActiveLabId();
  const [movs, setMovs] = useState<InsumoMovimentacao[]>([]);
  const [transitions, setTransitions] = useState<InsumoTransition[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!labId) return;
    const unsubMovs = subscribeToMovimentacoes(
      labId,
      insumo.id,
      setMovs,
      (err) => setError(err.message),
    );
    // Subscription de transitions com filtro cliente por insumoId — não há
    // index por insumoId em transitions. Custo: até maxResults*docs. Ajustável
    // para indexar por insumoId se ficar caro.
    const unsubTrans = subscribeToTransitions(
      labId,
      { maxResults: 200 },
      (incoming) => {
        setTransitions(
          incoming.filter(
            (t) => t.fromInsumoId === insumo.id || t.toInsumoId === insumo.id,
          ),
        );
      },
      (err) => setError(err.message),
    );
    return () => {
      unsubMovs();
      unsubTrans();
    };
  }, [labId, insumo.id]);

  const events = useMemo<TimelineEvent[]>(() => {
    const out: TimelineEvent[] = [];

    // 1. Criação sempre existe.
    out.push({
      kind: 'creation',
      timestamp: insumo.createdAt.toDate(),
      title: 'Insumo cadastrado',
      subtitle: `Lote ${insumo.lote} · ${insumo.fabricante} · ${insumo.nomeComercial}`,
      actor: insumo.createdBy,
      tone: 'neutral',
    });

    // 2. Movimentações — pulamos entrada pra não duplicar com creation.
    for (const m of movs) {
      if (m.tipo === 'entrada') continue;
      const ts = tsToDate(m.timestamp);
      if (!ts) continue;
      const meta = MOV_LABEL[m.tipo];
      out.push({
        kind: 'movimentacao',
        timestamp: ts,
        title: meta.title,
        ...(m.motivo && { subtitle: m.motivo }),
        actor: m.operadorName,
        tone: meta.tone,
      });
    }

    // 3. Transições do setup.
    for (const t of transitions) {
      const ts = tsToDate(t.timestamp);
      if (!ts) continue;
      const meta = TRANS_LABEL[t.type];
      const isEntering = t.toInsumoId === insumo.id;
      out.push({
        kind: 'transition',
        timestamp: ts,
        title: `${isEntering ? meta.titleAtivou : meta.titleSaiu} · ${t.module}`,
        ...(t.motivo && { subtitle: t.motivo }),
        actor: t.operadorName,
        tone: meta.tone,
      });
    }

    // 4. Resumo — não é evento, mas ancora no agora.
    out.push({
      kind: 'summary',
      timestamp: new Date(),
      title: `Usado em ${insumo.runCount ?? 0} corridas`,
      subtitle:
        (insumo.activationsCount ?? 0) > 0
          ? `Ativado ${insumo.activationsCount}x no setup`
          : 'Ainda não ativado no setup',
      tone: 'neutral',
    });

    // Ordenação ascendente — narrativa cronológica.
    return out.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [insumo, movs, transitions]);

  const toneClass: Record<TimelineEvent['tone'], string> = {
    neutral: 'bg-slate-400 dark:bg-white/30',
    ok: 'bg-emerald-500',
    warn: 'bg-amber-500',
    bad: 'bg-red-500',
  };

  return (
    <div>
      {error && (
        <div className="mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <ol className="relative border-l-2 border-slate-200 dark:border-white/[0.08] pl-5 space-y-4 ml-2">
        {events.map((e, idx) => (
          <li key={idx} className="relative">
            <span
              className={`absolute -left-[1.65rem] top-1.5 w-3 h-3 rounded-full ring-4 ring-white dark:ring-[#0F1318] ${toneClass[e.tone]}`}
              aria-hidden
            />
            <div>
              <p className="text-[11px] uppercase tracking-widest text-slate-400 dark:text-white/30 font-medium">
                {fmtDateTime(e.timestamp)}
              </p>
              <p className="text-sm font-medium text-slate-900 dark:text-white/85 mt-0.5">
                {e.title}
              </p>
              {e.subtitle && (
                <p className="text-xs text-slate-500 dark:text-white/45 mt-0.5">
                  {e.subtitle}
                </p>
              )}
              {e.actor && (
                <p className="text-[11px] text-slate-400 dark:text-white/30 mt-0.5">
                  por {e.actor}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
