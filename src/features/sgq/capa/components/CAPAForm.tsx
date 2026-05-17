/**
 * CAPAForm — Create new CAPA with validation
 *
 * Fields: titulo, descricao, setor, origem, prioridade, dataPrazo
 * Setor/Origem populated from labs/{labId}/nc-config/settings
 * Dark-first design: bg-[#141417], text-white/90, violet accents
 * WCAG AA: contrast ≥4.5:1, focus rings, keyboard navigation
 *
 * RDC 978/2025 Art. 86 (PGQ) + DICQ 4.9/4.10
 */

import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../../shared/services/firebase';
import { useActiveLabId } from '../../../../store/useAuthStore';
import { useUser } from '../../../../store/useAuthStore';
import { createCAPA } from '../services/capaService';
import type { CreateCAPAInput } from '../types';

interface NCConfig {
  setores: string[];
  origens: string[];
  prazos: Record<string, number>;
}

const DEFAULT_CONFIG: NCConfig = {
  setores: ['Hematologia', 'Bioquímica', 'Coagulação', 'Uroanálise', 'Imunologia', 'Microbiologia', 'Recepção', 'Coleta', 'Administrativo'],
  origens: ['Auditoria interna', 'Reclamação de cliente', 'Controle de qualidade', 'Desvio de processo', 'Inspeção', 'Evento adverso', 'Indicador fora da meta'],
  prazos: { critica: 7, grave: 15, moderada: 30, leve: 60 },
};

function useNCConfig(labId: string | null): NCConfig {
  const [config, setConfig] = useState<NCConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    if (!labId) return;
    const configRef = doc(db, 'labs', labId, 'nc-config', 'settings');
    getDoc(configRef).then((snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<NCConfig>;
        setConfig({
          setores: data.setores || DEFAULT_CONFIG.setores,
          origens: data.origens || DEFAULT_CONFIG.origens,
          prazos: data.prazos || DEFAULT_CONFIG.prazos,
        });
      }
    }).catch(() => {});
  }, [labId]);

  return config;
}

interface CAPAFormProps {
  onSuccess?: (capaId: string) => void;
  onCancel?: () => void;
}

export default function CAPAForm({ onSuccess, onCancel }: CAPAFormProps) {
  const labId = useActiveLabId();
  const user = useUser();
  const ncConfig = useNCConfig(labId);

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [setor, setSetor] = useState('');
  const [origem, setOrigem] = useState('');
  const [prioridade, setPrioridade] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [dataPrazo, setDataPrazo] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-suggest deadline based on priority + configured prazos
  useEffect(() => {
    if (dataPrazo) return; // don't override manual selection
    const prazoMap: Record<number, string> = { 5: 'critica', 4: 'grave', 3: 'moderada', 2: 'leve', 1: 'leve' };
    const key = prazoMap[prioridade];
    const dias = ncConfig.prazos[key] ?? 30;
    const target = new Date();
    target.setDate(target.getDate() + dias);
    setDataPrazo(target.toISOString().split('T')[0]);
  }, [prioridade, ncConfig.prazos]);

  const isValid =
    titulo.trim().length >= 5 &&
    descricao.trim().length >= 10 &&
    setor.length > 0 &&
    origem.length > 0 &&
    dataPrazo.length > 0;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!labId) {
      setError('Sem lab ativo');
      return;
    }

    if (!isValid) {
      setError('Preencha todos os campos obrigatórios');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const date = new Date(dataPrazo);
      const timestamp = {
        seconds: Math.floor(date.getTime() / 1000),
        nanoseconds: 0,
      };

      const input: CreateCAPAInput = {
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        setor,
        origem,
        prioridade,
        dataPrazo: timestamp as any,
        status: 'aberta',
        encontroId: null,
      };

      const capaId = await createCAPA(labId, input, user?.uid);
      setTitulo('');
      setDescricao('');
      setSetor('');
      setOrigem('');
      setPrioridade(3);
      setDataPrazo('');

      onSuccess?.(capaId);
    } catch (err: any) {
      setError(err.message || 'Erro ao criar CAPA');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 p-6 bg-[#141417] text-white rounded-lg border border-white/10"
      role="form"
      aria-label="Formulário de criação de CAPA"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <h2 className="text-xl font-semibold text-white">Nova CAPA</h2>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-white/60 hover:text-white/90 focus:ring-2 focus:ring-violet-500 rounded p-1"
            aria-label="Fechar formulário"
          >
            ✕
          </button>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="px-4 py-3 bg-red-900/20 border border-red-700/50 rounded text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Título Field */}
      <div className="flex flex-col gap-2">
        <label htmlFor="titulo" className="text-sm font-medium text-white/90">
          Título <span className="text-red-400">*</span>
        </label>
        <input
          id="titulo"
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ex: Desempenho inadequado do analisador"
          className="px-3 py-2 bg-white/5 border border-white/10 rounded text-white placeholder:text-white/40 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          aria-describedby="titulo-hint"
          disabled={isSubmitting}
        />
        <p id="titulo-hint" className="text-xs text-white/50">
          Mínimo 5 caracteres
        </p>
      </div>

      {/* Descrição Field */}
      <div className="flex flex-col gap-2">
        <label htmlFor="descricao" className="text-sm font-medium text-white/90">
          Descrição <span className="text-red-400">*</span>
        </label>
        <textarea
          id="descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Descreva a não-conformidade encontrada..."
          rows={4}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded text-white placeholder:text-white/40 focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
          aria-describedby="descricao-hint"
          disabled={isSubmitting}
        />
        <p id="descricao-hint" className="text-xs text-white/50">
          Mínimo 10 caracteres
        </p>
      </div>

      {/* Setor + Origem (2 cols) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="setor" className="text-sm font-medium text-white/90">
            Setor <span className="text-red-400">*</span>
          </label>
          <select
            id="setor"
            value={setor}
            onChange={(e) => setSetor(e.target.value)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            disabled={isSubmitting}
          >
            <option value="" disabled>Selecione o setor</option>
            {ncConfig.setores.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="origem" className="text-sm font-medium text-white/90">
            Origem <span className="text-red-400">*</span>
          </label>
          <select
            id="origem"
            value={origem}
            onChange={(e) => setOrigem(e.target.value)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            disabled={isSubmitting}
          >
            <option value="" disabled>Selecione a origem</option>
            {ncConfig.origens.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Prioridade Field */}
      <div className="flex flex-col gap-2">
        <label htmlFor="prioridade" className="text-sm font-medium text-white/90">
          Prioridade <span className="text-red-400">*</span>
        </label>
        <select
          id="prioridade"
          value={prioridade}
          onChange={(e) => {
            setPrioridade(parseInt(e.target.value) as any);
            setDataPrazo(''); // reset to trigger auto-calc
          }}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          disabled={isSubmitting}
        >
          <option value="5">5 — Crítica (prazo: {ncConfig.prazos.critica ?? 7} dias)</option>
          <option value="4">4 — Grave (prazo: {ncConfig.prazos.grave ?? 15} dias)</option>
          <option value="3">3 — Moderada (prazo: {ncConfig.prazos.moderada ?? 30} dias)</option>
          <option value="2">2 — Leve (prazo: {ncConfig.prazos.leve ?? 60} dias)</option>
          <option value="1">1 — Informativa</option>
        </select>
        <p className="text-xs text-white/40">
          Prazo sugerido automaticamente conforme configuração
        </p>
      </div>

      {/* Data Prazo Field */}
      <div className="flex flex-col gap-2">
        <label htmlFor="dataPrazo" className="text-sm font-medium text-white/90">
          Data de Prazo <span className="text-red-400">*</span>
        </label>
        <input
          id="dataPrazo"
          type="date"
          value={dataPrazo}
          onChange={(e) => setDataPrazo(e.target.value)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          disabled={isSubmitting}
          min={new Date().toISOString().split('T')[0]}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-white/10">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/[0.15] text-white rounded focus:ring-2 focus:ring-violet-500 transition-colors"
            disabled={isSubmitting}
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-600/50 disabled:cursor-not-allowed text-white rounded focus:ring-2 focus:ring-violet-400 transition-colors font-medium"
          disabled={!isValid || isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? 'Criando...' : 'Criar CAPA'}
        </button>
      </div>
    </form>
  );
}
