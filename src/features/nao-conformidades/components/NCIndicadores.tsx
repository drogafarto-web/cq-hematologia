/**
 * NCIndicadores.tsx
 *
 * Dashboard executivo de Não Conformidades.
 * Lê de AMBAS as coleções: naoConformidades (legado) + capa (novo).
 *
 * RDC 978/2025 Art. 134 — Indicadores de qualidade
 */

import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';

interface NCIndicadoresProps {
  labId: string;
}

interface Stats {
  abertas: number;
  fechadasMes: number;
  prazoMedio: number;
  vencidas: number;
  reincidencias: number;
  total: number;
}

function toDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return null;
}

export function NCIndicadores({ labId }: NCIndicadoresProps) {
  const [stats, setStats] = useState<Stats>({
    abertas: 0,
    fechadasMes: 0,
    prazoMedio: 0,
    vencidas: 0,
    reincidencias: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!labId) return;

    let ncData: any[] = [];
    let capaData: any[] = [];
    let ncLoaded = false;
    let capaLoaded = false;

    function recalculate() {
      if (!ncLoaded || !capaLoaded) return;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const allItems = [
        ...ncData.map((nc) => ({
          status: nc.capaStatus || 'nao_iniciada',
          abertaEm: toDate(nc.abertaEm),
          fechadaEm: toDate(nc.fechadaEm),
          prazoClosure: toDate(nc.prazoClosure),
        })),
        ...capaData.map((capa) => ({
          status: capa.status || 'aberta',
          abertaEm: toDate(capa.criadoEm),
          fechadaEm: null as Date | null,
          prazoClosure: toDate(capa.dataPrazo),
        })),
      ];

      const isClosed = (s: string) => ['fechada', 'cancelada'].includes(s);

      const abertas = allItems.filter((i) => !isClosed(i.status)).length;

      const fechadasMes = allItems.filter((i) => {
        if (!isClosed(i.status) || !i.fechadaEm) return false;
        return i.fechadaEm >= startOfMonth;
      }).length;

      const vencidas = allItems.filter((i) => {
        if (isClosed(i.status) || !i.prazoClosure) return false;
        return i.prazoClosure < now;
      }).length;

      const reincidencias = allItems.filter((i) => i.status === 'reaberta').length;

      const fechadas = allItems.filter((i) => isClosed(i.status) && i.abertaEm && i.fechadaEm);
      let prazoMedio = 0;
      if (fechadas.length > 0) {
        const totalDias = fechadas.reduce((sum, i) => {
          return sum + (i.fechadaEm!.getTime() - i.abertaEm!.getTime()) / (1000 * 60 * 60 * 24);
        }, 0);
        prazoMedio = Math.round(totalDias / fechadas.length);
      }

      setStats({
        abertas,
        fechadasMes,
        prazoMedio,
        vencidas,
        reincidencias,
        total: allItems.length,
      });
      setLoading(false);
    }

    // Subscribe to naoConformidades (legacy)
    const ncRef = collection(db, 'labs', labId, 'naoConformidades');
    const ncQuery = query(ncRef, where('deletadoEm', '==', null));
    const unsubNC = onSnapshot(
      ncQuery,
      (snap) => {
        ncData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        ncLoaded = true;
        recalculate();
      },
      () => {
        ncLoaded = true;
        recalculate();
      },
    );

    // Subscribe to capa (new)
    const capaRef = collection(db, 'labs', labId, 'capa');
    const capaQuery = query(capaRef, where('deletadoEm', '==', null));
    const unsubCAPA = onSnapshot(
      capaQuery,
      (snap) => {
        capaData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        capaLoaded = true;
        recalculate();
      },
      () => {
        capaLoaded = true;
        recalculate();
      },
    );

    return () => {
      unsubNC();
      unsubCAPA();
    };
  }, [labId]);

  if (loading) {
    return (
      <div className="bg-[#141417] rounded-xl border border-white/[0.08] p-12 text-center">
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <p className="text-sm text-white/50">Calculando indicadores...</p>
        </div>
      </div>
    );
  }

  const cards = [
    {
      label: 'NCs Abertas',
      value: stats.abertas,
      color: stats.abertas > 0 ? 'text-red-400' : 'text-emerald-400',
      sublabel: 'aguardando tratamento',
    },
    {
      label: 'Fechadas no Mês',
      value: stats.fechadasMes,
      color: 'text-emerald-400',
      sublabel: 'resolvidas este mês',
    },
    {
      label: 'Prazo Médio',
      value: `${stats.prazoMedio}d`,
      color: stats.prazoMedio > 30 ? 'text-amber-400' : 'text-white',
      sublabel: 'dias para resolução',
    },
    {
      label: 'Vencidas',
      value: stats.vencidas,
      color: stats.vencidas > 0 ? 'text-red-400' : 'text-emerald-400',
      sublabel: 'prazo expirado',
    },
    {
      label: 'Reincidências',
      value: stats.reincidencias,
      color: stats.reincidencias > 0 ? 'text-amber-400' : 'text-emerald-400',
      sublabel: 'NCs reabertas',
    },
  ];

  const taxaConformidade =
    stats.total > 0 ? Math.round(((stats.total - stats.abertas) / stats.total) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-[#141417] rounded-xl border border-white/[0.08] p-4">
            <p className="text-xs font-medium text-white/50 uppercase tracking-wide">
              {card.label}
            </p>
            <p className={`text-2xl font-bold mt-2 ${card.color}`}>{card.value}</p>
            <p className="text-[10px] text-white/30 mt-1">{card.sublabel}</p>
          </div>
        ))}
      </div>

      {/* Taxa de Conformidade */}
      <div className="bg-[#141417] rounded-xl border border-white/[0.08] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Taxa de Conformidade</h3>
            <p className="text-xs text-white/40 mt-0.5">NCs resolvidas / total</p>
          </div>
          <p
            className={`text-3xl font-bold ${
              taxaConformidade >= 80
                ? 'text-emerald-400'
                : taxaConformidade >= 60
                  ? 'text-amber-400'
                  : 'text-red-400'
            }`}
          >
            {taxaConformidade}%
          </p>
        </div>
        <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              taxaConformidade >= 80
                ? 'bg-emerald-500'
                : taxaConformidade >= 60
                  ? 'bg-amber-500'
                  : 'bg-red-500'
            }`}
            style={{ width: `${taxaConformidade}%` }}
          />
        </div>
      </div>

      {/* Resumo por Severidade */}
      <div className="bg-[#141417] rounded-xl border border-white/[0.08] p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Visão Geral</h3>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs text-white/50">Total de NCs</p>
            <p className="text-xl font-bold text-white mt-1">{stats.total}</p>
          </div>
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs text-white/50">Em Tratamento</p>
            <p className="text-xl font-bold text-amber-400 mt-1">{stats.abertas}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
