'use client'

import { Pill } from '@/components/ui/pill'
import { formatDecimal, formatDate, formatTime, dentroDoRange } from '@/lib/utils'

interface Registro {
  id: string
  valorProtrombina: number
  valorRni: number
  valorTtppa: number
  observacao: string | null
  registradoEm: string
  operador: { nome: string }
}

interface Controle {
  id: string
  nome: string
  lote: string
  protrombinaMin: number
  protrombinaMax: number
  rniMin: number
  rniMax: number
  ttppaMin: number
  ttppaMax: number
  registros: Registro[]
}

interface Props {
  controles: Controle[]
}

type StatusValor = 'ok' | 'fora' | '—'

function statusDe(valor: number, min: number, max: number): StatusValor {
  return dentroDoRange(valor, min, max) ? 'ok' : 'fora'
}

function PillStatus({ s }: { s: StatusValor }) {
  if (s === '—') return null
  if (s === 'ok') return <Pill variant="success" size="sm">ok</Pill>
  return <Pill variant="error" size="sm">fora</Pill>
}

export function HistoricoRegistros({ controles }: Props) {
  const todosRegistros: Array<Registro & { controle: { nome: string; lote: string; protrombinaMin: number; protrombinaMax: number; rniMin: number; rniMax: number; ttppaMin: number; ttppaMax: number } }> = []

  for (const c of controles) {
    for (const r of c.registros) {
      todosRegistros.push({
        ...r,
        controle: {
          nome: c.nome,
          lote: c.lote,
          protrombinaMin: c.protrombinaMin,
          protrombinaMax: c.protrombinaMax,
          rniMin: c.rniMin,
          rniMax: c.rniMax,
          ttppaMin: c.ttppaMin,
          ttppaMax: c.ttppaMax,
        },
      })
    }
  }

  todosRegistros.sort((a, b) => new Date(b.registradoEm).getTime() - new Date(a.registradoEm).getTime())

  if (todosRegistros.length === 0) {
    return <p className="text-sm text-on-surface-variant py-6">Nenhum registro ainda.</p>
  }

  return (
    <div className="overflow-x-auto border border-border rounded">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-variant">
            <th className="text-xs uppercase tracking-wider text-on-surface-variant text-left px-4 py-3 font-semibold">Controle</th>
            <th className="text-xs uppercase tracking-wider text-on-surface-variant text-left px-4 py-3 font-semibold">Data</th>
            <th className="text-xs uppercase tracking-wider text-on-surface-variant text-left px-4 py-3 font-semibold">Hora</th>
            <th className="text-xs uppercase tracking-wider text-on-surface-variant text-right px-4 py-3 font-semibold">Protrombina</th>
            <th className="text-xs uppercase tracking-wider text-on-surface-variant text-center px-2 py-3 font-semibold"></th>
            <th className="text-xs uppercase tracking-wider text-on-surface-variant text-right px-4 py-3 font-semibold">RNI</th>
            <th className="text-xs uppercase tracking-wider text-on-surface-variant text-center px-2 py-3 font-semibold"></th>
            <th className="text-xs uppercase tracking-wider text-on-surface-variant text-right px-4 py-3 font-semibold">TTPA</th>
            <th className="text-xs uppercase tracking-wider text-on-surface-variant text-center px-2 py-3 font-semibold"></th>
            <th className="text-xs uppercase tracking-wider text-on-surface-variant text-left px-4 py-3 font-semibold">Operador</th>
          </tr>
        </thead>
        <tbody>
          {todosRegistros.map((r) => {
            const sProt = statusDe(Number(r.valorProtrombina), r.controle.protrombinaMin, r.controle.protrombinaMax)
            const sRni = statusDe(Number(r.valorRni), r.controle.rniMin, r.controle.rniMax)
            const sTtppa = statusDe(Number(r.valorTtppa), r.controle.ttppaMin, r.controle.ttppaMax)
            return (
              <tr key={r.id} className="border-t border-border hover:bg-surface-variant/40">
                <td className="px-4 py-3 font-mono text-xs">{r.controle.nome}<span className="text-on-surface-variant"> · {r.controle.lote}</span></td>
                <td className="px-4 py-3 font-mono text-xs">{formatDate(r.registradoEm)}</td>
                <td className="px-4 py-3 font-mono text-xs">{formatTime(r.registradoEm)}</td>
                <td className="px-4 py-3 font-mono text-right">{formatDecimal(r.valorProtrombina)}</td>
                <td className="px-2 py-3"><PillStatus s={sProt} /></td>
                <td className="px-4 py-3 font-mono text-right">{formatDecimal(r.valorRni)}</td>
                <td className="px-2 py-3"><PillStatus s={sRni} /></td>
                <td className="px-4 py-3 font-mono text-right">{formatDecimal(r.valorTtppa)}</td>
                <td className="px-2 py-3"><PillStatus s={sTtppa} /></td>
                <td className="px-4 py-3 text-xs">{r.operador.nome}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
