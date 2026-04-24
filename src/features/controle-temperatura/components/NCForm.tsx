import { useState } from 'react';

import { useNCs } from '../hooks/useNCs';
import type { NaoConformidadeTemp } from '../types/ControlTemperatura';
import { Button, Field, Modal, TextArea } from './_shared';

export interface NCFormProps {
  open: boolean;
  onClose: () => void;
  nc: NaoConformidadeTemp;
}

/**
 * Edição e resolução de NC. Não permite criar NC manualmente — NCs nascem
 * exclusivamente a partir de leituras fora dos limites (RN-01). Edita
 * campos de tratamento: descrição, ação imediata, ação corretiva, status.
 */
export function NCForm({ open, onClose, nc }: NCFormProps) {
  const { update, resolver } = useNCs();
  const [descricao, setDescricao] = useState(nc.descricao);
  const [acaoImediata, setAcaoImediata] = useState(nc.acaoImediata);
  const [acaoCorretiva, setAcaoCorretiva] = useState(nc.acaoCorretiva ?? '');
  const [responsavel, setResponsavel] = useState(nc.responsavelAcao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      await update(nc.id, {
        descricao,
        acaoImediata,
        acaoCorretiva: acaoCorretiva.trim() || undefined,
        responsavelAcao: responsavel,
        status: nc.status === 'aberta' ? 'em_andamento' : nc.status,
      });
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  async function resolverNC() {
    setErro(null);
    if (acaoCorretiva.trim().length < 5) {
      setErro('Ação corretiva é obrigatória para resolver a NC.');
      return;
    }
    setSalvando(true);
    try {
      await resolver(nc.id, acaoCorretiva.trim());
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`NC — ${nc.limiteViolado === 'umidade' ? 'umidade' : `T. ${nc.limiteViolado}`}`}
      subtitle={`Registrada ${nc.dataAbertura.toDate().toLocaleString('pt-BR')}`}
      maxWidthClass="max-w-lg"
      footer={
        <>
          <Button tone="secondary" onClick={onClose} disabled={salvando} className="flex-1">
            Cancelar
          </Button>
          <Button tone="ghost" onClick={salvar} disabled={salvando || nc.status === 'resolvida'}>
            Salvar tratamento
          </Button>
          <Button onClick={resolverNC} disabled={salvando || nc.status === 'resolvida'}>
            Resolver
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          <strong>Valor registrado:</strong>{' '}
          {nc.temperaturaRegistrada.toFixed(1)}°C — violou limite de{' '}
          <strong>{nc.limiteViolado}</strong>.
        </div>
        <Field label="Descrição do desvio">
          <TextArea value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </Field>
        <Field label="Ação imediata">
          <TextArea value={acaoImediata} onChange={(e) => setAcaoImediata(e.target.value)} />
        </Field>
        <Field
          label="Ação corretiva"
          hint="Obrigatória para resolver a NC — descreva a causa raiz e a correção."
        >
          <TextArea
            value={acaoCorretiva}
            onChange={(e) => setAcaoCorretiva(e.target.value)}
            placeholder="Ex: regulagem do termostato a cada 7 dias; substituição do equipamento."
          />
        </Field>
        <Field label="Responsável pela ação">
          <input
            type="text"
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
        </Field>
        {erro ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {erro}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
