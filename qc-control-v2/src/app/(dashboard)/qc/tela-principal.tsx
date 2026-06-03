'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pill } from '@/components/ui/pill'
import { cn, formatDecimal, formatDate, formatTime, dentroDoRange } from '@/lib/utils'
import { HistoricoRegistros } from './historico'

interface Controle {
  id: string
  nome: string
  lote: string
  ativo: boolean
  protrombinaMin: number
  protrombinaMax: number
  rniMin: number
  rniMax: number
  ttppaMin: number
  ttppaMax: number
  registros: Array<{
    id: string
    valorProtrombina: number
    valorRni: number
    valorTtppa: number
    observacao: string | null
    registradoEm: string
    operador: { nome: string }
  }>
}

interface Operador {
  id: string
  nome: string
}

interface Props {
  controles: Controle[]
  operador: Operador
}

export function TelaPrincipaV2({ controles, operador }: Props) {
  const router = useRouter()
  const [carregando, setCarregando] = useState<string | null>(null)
  const [valores, setValores] = useState<Record<string, { prot: string; rni: string; ttppa: string }>>({})

  function atualizar(controleId: string, campo: 'prot' | 'rni' | 'ttppa', valor: string) {
    setValores((prev) => ({
      ...prev,
      [controleId]: { ...(prev[controleId] ?? { prot: '', rni: '', ttppa: '' }), [campo]: valor },
    }))
  }

  async function registrar(controleId: string) {
    const v = valores[controleId]
    if (!v || !v.prot || !v.rni || !v.ttppa) {
      toast.error('Preencha os 3 valores')
      return
    }

    setCarregando(controleId)
    try {
      const res = await fetch('/api/registros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          controleId,
          valorProtrombina: Number(v.prot),
          valorRni: Number(v.rni),
          valorTtppa: Number(v.ttppa),
          operadorId: operador.id,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error?.message ?? 'Falha ao registrar')
        return
      }
      toast.success('Registro salvo')
      setValores((prev) => ({ ...prev, [controleId]: { prot: '', rni: '', ttppa: '' } }))
      router.refresh()
    } catch {
      toast.error('Falha ao registrar')
    } finally {
      setCarregando(null)
    }
  }

  const ativos = controles.filter((c) => c.ativo)

  if (ativos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <h1 className="text-xl font-semibold text-on-surface">Controle Interno de Qualidade</h1>
        <p className="text-on-surface-variant">Nenhum controle ativo. Crie um no <a href="/controles" className="text-primary underline">hub</a>.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-on-surface">Controle Interno de Qualidade</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {ativos.map((controle) => {
          const v = valores[controle.id] ?? { prot: '', rni: '', ttppa: '' }
          return (
            <Card key={controle.id} padding="md" className="flex flex-col gap-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-on-surface">{controle.nome}</h2>
                  <p className="text-xs text-on-surface-variant font-mono">Lote {controle.lote}</p>
                </div>
                <Pill variant="success">Ativo</Pill>
              </div>

              <div className="flex flex-col gap-3">
                <ParamInput
                  label="Atividade de Protrombina"
                  unidade="%"
                  min={controle.protrombinaMin}
                  max={controle.protrombinaMax}
                  valor={v.prot}
                  onChange={(val) => atualizar(controle.id, 'prot', val)}
                />
                <ParamInput
                  label="RNI"
                  unidade=""
                  min={controle.rniMin}
                  max={controle.rniMax}
                  valor={v.rni}
                  onChange={(val) => atualizar(controle.id, 'rni', val)}
                  step="0.01"
                />
                <ParamInput
                  label="TTPA"
                  unidade="s"
                  min={controle.ttppaMin}
                  max={controle.ttppaMax}
                  valor={v.ttppa}
                  onChange={(val) => atualizar(controle.id, 'ttppa', val)}
                  step="0.1"
                />
              </div>

              <div className="flex gap-3 pt-2 border-t border-border">
                <Button
                  onClick={() => registrar(controle.id)}
                  loading={carregando === controle.id}
                  className="flex-1"
                >
                  Registrar
                </Button>
                <Button variant="outline" onClick={() => alert('Cancelar')}>
                  Cancelar
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      <div className="border-t border-border pt-6">
        <h2 className="text-lg font-semibold text-on-surface mb-4">Resultados recentes</h2>
        <HistoricoRegistros controles={ativos} />
      </div>
    </div>
  )
}

interface ParamInputProps {
  label: string
  unidade: string
  min: number
  max: number
  valor: string
  onChange: (v: string) => void
  step?: string
}

function ParamInput({ label, unidade, min, max, valor, onChange, step }: ParamInputProps) {
  const num = Number(valor)
  const foraDoRange = valor !== '' && !dentroDoRange(num, min, max)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
          {label} {unidade && <span className="text-outline font-normal">({unidade})</span>}
        </label>
        <span className="text-xs text-on-surface-variant font-mono">
          esperado: {formatDecimal(min)}–{formatDecimal(max)}
        </span>
      </div>
      <div className="relative">
        <input
          type="number"
          step={step ?? 'any'}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'w-full h-12 px-4 border text-lg font-mono focus:outline-none focus:border-2',
            foraDoRange
              ? 'border-error bg-error-container/30 focus:border-error'
              : 'border-border-variant focus:border-primary',
          )}
          placeholder="—"
        />
        {foraDoRange && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-error">
            fora
          </span>
        )}
      </div>
    </div>
  )
}
