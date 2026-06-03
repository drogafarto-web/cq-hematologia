'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';

interface Controle {
  id: string;
  nome: string;
  lote: string;
  ativo: boolean;
  protrombinaMin: number;
  protrombinaMax: number;
  rniMin: number;
  rniMax: number;
  ttppaMin: number;
  ttppaMax: number;
  _count: { registros: number };
}

interface Props {
  controles: Controle[];
}

export function HubControles({ controles }: Props) {
  const router = useRouter();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [novo, setNovo] = useState({
    nome: '',
    lote: '',
    protrombinaMin: 80,
    protrombinaMax: 120,
    rniMin: 0.83,
    rniMax: 1.11,
    ttppaMin: 27,
    ttppaMax: 39,
  });

  async function criarControle(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/controles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...novo, ativo: true }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? 'Falha ao criar');
        return;
      }
      toast.success('Controle criado');
      setMostrarForm(false);
      setNovo({
        nome: '',
        lote: '',
        protrombinaMin: 80,
        protrombinaMax: 120,
        rniMin: 0.83,
        rniMax: 1.11,
        ttppaMin: 27,
        ttppaMax: 39,
      });
      router.refresh();
    } catch {
      toast.error('Falha ao criar');
    }
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    try {
      const res = await fetch(`/api/controles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !ativo }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? 'Falha');
        return;
      }
      toast.success(ativo ? 'Controle desativado' : 'Controle ativado');
      router.refresh();
    } catch {
      toast.error('Falha');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-on-surface">Hub de Controles</h1>
        <Button onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? 'Cancelar' : '+ Novo Controle'}
        </Button>
      </div>

      {mostrarForm && (
        <form
          onSubmit={criarControle}
          className="bg-surface border border-border p-6 flex flex-col gap-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Nome
              </label>
              <input
                type="text"
                value={novo.nome}
                onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
                className="h-12 px-4 border border-border-variant bg-white"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Lote
              </label>
              <input
                type="text"
                value={novo.lote}
                onChange={(e) => setNovo({ ...novo, lote: e.target.value })}
                className="h-12 px-4 border border-border-variant bg-white"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Protrombina min
              </label>
              <input
                type="number"
                step="any"
                value={novo.protrombinaMin}
                onChange={(e) => setNovo({ ...novo, protrombinaMin: Number(e.target.value) })}
                className="h-12 px-4 border border-border-variant bg-white"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Protrombina max
              </label>
              <input
                type="number"
                step="any"
                value={novo.protrombinaMax}
                onChange={(e) => setNovo({ ...novo, protrombinaMax: Number(e.target.value) })}
                className="h-12 px-4 border border-border-variant bg-white"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                RNI min
              </label>
              <input
                type="number"
                step="0.01"
                value={novo.rniMin}
                onChange={(e) => setNovo({ ...novo, rniMin: Number(e.target.value) })}
                className="h-12 px-4 border border-border-variant bg-white"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                RNI max
              </label>
              <input
                type="number"
                step="0.01"
                value={novo.rniMax}
                onChange={(e) => setNovo({ ...novo, rniMax: Number(e.target.value) })}
                className="h-12 px-4 border border-border-variant bg-white"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                TTPA min
              </label>
              <input
                type="number"
                step="any"
                value={novo.ttppaMin}
                onChange={(e) => setNovo({ ...novo, ttppaMin: Number(e.target.value) })}
                className="h-12 px-4 border border-border-variant bg-white"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                TTPA max
              </label>
              <input
                type="number"
                step="any"
                value={novo.ttppaMax}
                onChange={(e) => setNovo({ ...novo, ttppaMax: Number(e.target.value) })}
                className="h-12 px-4 border border-border-variant bg-white"
              />
            </div>
          </div>

          <Button type="submit">Criar Controle</Button>
        </form>
      )}

      <div className="flex flex-col gap-2">
        {controles.map((c) => (
          <div key={c.id} className="border border-border p-4 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-on-surface">{c.nome}</span>
                <Pill variant={c.ativo ? 'success' : 'neutral'} size="sm">
                  {c.ativo ? 'Ativo' : 'Inativo'}
                </Pill>
              </div>
              <div className="text-xs text-on-surface-variant font-mono">
                Lote {c.lote} · {c._count.registros} registros
              </div>
              <div className="text-xs text-on-surface-variant">
                Prot: {c.protrombinaMin}–{c.protrombinaMax}% · RNI: {c.rniMin}–{c.rniMax} · TTPA:{' '}
                {c.ttppaMin}–{c.ttppaMax}s
              </div>
            </div>
            <Button
              variant={c.ativo ? 'outline' : 'primary'}
              onClick={() => toggleAtivo(c.id, c.ativo)}
            >
              {c.ativo ? 'Desativar' : 'Ativar'}
            </Button>
          </div>
        ))}
        {controles.length === 0 && (
          <div className="text-center text-on-surface-variant py-12">
            Nenhum controle cadastrado.
          </div>
        )}
      </div>
    </div>
  );
}
