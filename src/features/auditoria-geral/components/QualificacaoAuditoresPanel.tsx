import { useMemo } from 'react';
import type { AuditoriaGeral, QualificacaoAuditor } from '../types';
import type { Timestamp } from 'firebase/firestore';

interface Props {
  auditorias: AuditoriaGeral[];
}

function getStatusBadge(status: QualificacaoAuditor['status']) {
  switch (status) {
    case 'qualificado':
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Qualificado</span>;
    case 'em_treinamento':
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20">Em Treinamento</span>;
    case 'inativo':
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-white/40 border border-white/10">Inativo</span>;
  }
}

function computeStatus(count: number, media: number, ultimaAuditoria: Timestamp | null): QualificacaoAuditor['status'] {
  if (ultimaAuditoria) {
    const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
    if (ultimaAuditoria.toMillis() < sixMonthsAgo) return 'inativo';
  }
  if (count >= 3 && media >= 70) return 'qualificado';
  return 'em_treinamento';
}

export function QualificacaoAuditoresPanel({ auditorias }: Props) {
  const qualificacoes = useMemo(() => {
    const map = new Map<string, { nome: string; count: number; totalScore: number; ultima: Timestamp | null }>();

    auditorias.forEach((a) => {
      const existing = map.get(a.auditor.uid) ?? { nome: a.auditor.nome, count: 0, totalScore: 0, ultima: null };
      existing.count += 1;
      existing.totalScore += a.scoreTotal;
      if (!existing.ultima || a.dataFim && a.dataFim.toMillis() > (existing.ultima?.toMillis() ?? 0)) {
        existing.ultima = a.dataFim;
      }
      map.set(a.auditor.uid, existing);
    });

    return Array.from(map.entries()).map(([uid, data]): QualificacaoAuditor => {
      const media = Math.round(data.totalScore / data.count);
      return {
        uid,
        nome: data.nome,
        email: '',
        totalAuditorias: data.count,
        mediaScore: media,
        ultimaAuditoria: data.ultima,
        certificacoes: [],
        status: computeStatus(data.count, media, data.ultima),
      };
    });
  }, [auditorias]);

  if (qualificacoes.length === 0) return null;

  return (
    <section className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-6">
      <h2 className="text-sm font-medium text-white/60 mb-4">Qualificacao de Auditores</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left py-2 text-white/40 font-medium text-xs">Auditor</th>
              <th className="text-center py-2 text-white/40 font-medium text-xs">Auditorias</th>
              <th className="text-center py-2 text-white/40 font-medium text-xs">Media</th>
              <th className="text-center py-2 text-white/40 font-medium text-xs">Ultima</th>
              <th className="text-center py-2 text-white/40 font-medium text-xs">Status</th>
            </tr>
          </thead>
          <tbody>
            {qualificacoes.map((q) => (
              <tr key={q.uid} className="border-b border-white/[0.03] last:border-0">
                <td className="py-3 text-white/80">{q.nome}</td>
                <td className="py-3 text-center font-mono text-white/60">{q.totalAuditorias}</td>
                <td className="py-3 text-center">
                  <span className={`font-mono font-medium ${q.mediaScore >= 70 ? 'text-emerald-400' : q.mediaScore >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                    {q.mediaScore}%
                  </span>
                </td>
                <td className="py-3 text-center text-white/40 text-xs">
                  {q.ultimaAuditoria?.toDate().toLocaleDateString('pt-BR') ?? '—'}
                </td>
                <td className="py-3 text-center">{getStatusBadge(q.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
