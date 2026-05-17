import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../config/firebase.config';
import { useActiveLab } from '../../../store/useAuthStore';

export interface CEQMonthSummary {
  month: string;
  total: number;
  satisfatorios: number;
  questionaveis: number;
  insatisfatorios: number;
  avgZScore: number;
}

export interface CEQEspecialidadeSummary {
  esquema: string;
  rodadas: number;
  resultados: number;
  pctConformidade: number;
  worstZ: number;
  conceitoGeral: 'B' | 'A' | 'I';
}

export interface CEQNaoConformeItem {
  resultadoId: string;
  analyteName: string;
  esquema: string;
  zScore: number;
  interpretacao: 'questionavel' | 'insatisfatoria';
  conceito: string;
  rodada: number;
  ano: number;
  ncId: string | null;
  ncTratada: boolean;
  criadoEm: Date;
}

export interface CEQOverviewData {
  totalResultados: number;
  satisfatorios: number;
  questionaveis: number;
  insatisfatorios: number;
  pctConformidade: number;
  monthlyTrend: CEQMonthSummary[];
  especialidades: CEQEspecialidadeSummary[];
  insatisfatoriosPendentes: number;
  naoConformes: CEQNaoConformeItem[];
  loading: boolean;
}

export function useCEQOverview(): CEQOverviewData {
  const activeLab = useActiveLab();
  const [data, setData] = useState<CEQOverviewData>({
    totalResultados: 0, satisfatorios: 0, questionaveis: 0, insatisfatorios: 0,
    pctConformidade: 100, monthlyTrend: [], especialidades: [],
    insatisfatoriosPendentes: 0, naoConformes: [], loading: true,
  });

  useEffect(() => {
    if (!activeLab) return;
    const labId = activeLab.id;

    async function load() {
      const [resultSnap, participSnap, amostraSnap, ncSnap] = await Promise.all([
        getDocs(query(collection(db, 'labs', labId, 'ceq-resultados'), where('deletadoEm', '==', null))),
        getDocs(query(collection(db, 'labs', labId, 'ceq-participacoes'), where('deletadoEm', '==', null))),
        getDocs(query(collection(db, 'labs', labId, 'ceq-amostras'), where('deletadoEm', '==', null))),
        getDocs(query(collection(db, 'labs', labId, 'naoConformidades'), where('moduloOrigem', '==', 'ceq'))),
      ]);

      const resultados = resultSnap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, any>));
      const participacoes = participSnap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, any>));
      const amostras = amostraSnap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, any>));

      // NC lookup: ncId → status
      const ncMap = new Map<string, { status: string }>();
      ncSnap.docs.forEach(d => ncMap.set(d.id, { status: d.data().status }));

      const total = resultados.length;
      const sat = resultados.filter(r => r.interpretacao === 'satisfatoria').length;
      const quest = resultados.filter(r => r.interpretacao === 'questionavel').length;
      const insat = resultados.filter(r => r.interpretacao === 'insatisfatoria').length;
      const pendentes = resultados.filter(r => r.interpretacao === 'insatisfatoria' && !r.ncAutomaticaCriadaId).length;

      const byMonth = new Map<string, { total: number; sat: number; quest: number; insat: number; zSum: number }>();
      for (const r of resultados) {
        const ts = r.criadoEm?.toDate?.() ?? new Date((r.criadoEm?.seconds ?? 0) * 1000);
        const key = ts.getFullYear() + '-' + String(ts.getMonth() + 1).padStart(2, '0');
        if (!byMonth.has(key)) byMonth.set(key, { total: 0, sat: 0, quest: 0, insat: 0, zSum: 0 });
        const m = byMonth.get(key)!;
        m.total++;
        m.zSum += Math.abs(r.zScore ?? 0);
        if (r.interpretacao === 'satisfatoria') m.sat++;
        else if (r.interpretacao === 'questionavel') m.quest++;
        else m.insat++;
      }

      const monthlyTrend: CEQMonthSummary[] = [...byMonth.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, m]) => ({
          month, total: m.total, satisfatorios: m.sat,
          questionaveis: m.quest, insatisfatorios: m.insat,
          avgZScore: m.total > 0 ? Math.round((m.zSum / m.total) * 100) / 100 : 0,
        }));

      const pidToEsquema = new Map<string, string>();
      for (const p of participacoes) pidToEsquema.set(p.id, p.esquema);

      // Amostra lookup: amostraId → { rodada, ano }
      const amostraMap = new Map<string, { rodada: number; ano: number }>();
      for (const a of amostras) amostraMap.set(a.id, { rodada: a.rodada, ano: a.ano });

      const byEsp = new Map<string, { rodadas: Set<string>; total: number; sat: number; worstZ: number }>();
      for (const r of resultados) {
        const esquema = pidToEsquema.get(r.ceqParticipacaoId) || 'desconhecido';
        if (!byEsp.has(esquema)) byEsp.set(esquema, { rodadas: new Set(), total: 0, sat: 0, worstZ: 0 });
        const e = byEsp.get(esquema)!;
        e.total++;
        e.rodadas.add(r.ceqAmostraId);
        if (r.interpretacao !== 'insatisfatoria') e.sat++;
        const absZ = Math.abs(r.zScore ?? 0);
        if (absZ > e.worstZ) e.worstZ = absZ;
      }

      const especialidades: CEQEspecialidadeSummary[] = [...byEsp.entries()].map(([esquema, e]) => ({
        esquema,
        rodadas: e.rodadas.size,
        resultados: e.total,
        pctConformidade: e.total > 0 ? Math.round((e.sat / e.total) * 100) : 100,
        worstZ: Math.round(e.worstZ * 100) / 100,
        conceitoGeral: e.worstZ >= 3 ? 'I' as const : e.worstZ >= 2 ? 'A' as const : 'B' as const,
      }));

      // Build naoConformes list (only truly non-conforming: |Z| >= 2)
      const naoConformes: CEQNaoConformeItem[] = resultados
        .filter(r => Math.abs(r.zScore ?? 0) >= 2)
        .map(r => {
          const ncId = r.ncAutomaticaCriadaId || null;
          const ncInfo = ncId ? ncMap.get(ncId) : null;
          const amostraInfo = amostraMap.get(r.ceqAmostraId);
          const ts = r.criadoEm?.toDate?.() ?? new Date((r.criadoEm?.seconds ?? 0) * 1000);
          return {
            resultadoId: r.id,
            analyteName: r.analyteName || r.constituinte || '',
            esquema: pidToEsquema.get(r.ceqParticipacaoId) || 'desconhecido',
            zScore: r.zScore ?? 0,
            interpretacao: r.interpretacao as 'questionavel' | 'insatisfatoria',
            conceito: r.interpretacao === 'insatisfatoria' ? 'I' : 'A',
            rodada: amostraInfo?.rodada ?? 0,
            ano: amostraInfo?.ano ?? 0,
            ncId,
            ncTratada: ncInfo?.status === 'fechada' || ncInfo?.status === 'resolvida',
            criadoEm: ts,
          };
        })
        .sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime());

      setData({
        totalResultados: total, satisfatorios: sat, questionaveis: quest, insatisfatorios: insat,
        pctConformidade: total > 0 ? Math.round((sat / total) * 100) : 100,
        monthlyTrend, especialidades, insatisfatoriosPendentes: pendentes,
        naoConformes, loading: false,
      });
    }

    load().catch(() => setData(prev => ({ ...prev, loading: false })));
  }, [activeLab]);

  return data;
}