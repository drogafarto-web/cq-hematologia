/**
 * LabApoioForm.tsx — multi-step form (4 steps) stub.
 * Step 1: Dados gerais + disclaimer banner (P0-R1 mitigation)
 * Step 2: Exames
 * Step 3: Certificações + Contatos
 * Step 4: Upload contrato PDF
 */

import React, { useState } from 'react';
import type { ContratoInput } from '../types/LabApoio';

interface LabApoioFormProps {
  onSubmit?: (input: ContratoInput) => Promise<void>;
  onCancel?: () => void;
}

export function LabApoioForm({ onSubmit, onCancel }: LabApoioFormProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      if (onSubmit) {
        // Stub: pass minimal input
        await onSubmit({
          nome: 'Laboratório de Apoio',
          razaoSocial: 'Laborat de Apoio LTDA',
          cnpj: '00000000000191', // Valid test CNPJ
          habilitacaoAnvisa: 'AVS-12345678',
          vigenciaInicio: new Date().toISOString().split('T')[0],
          vigenciaFim: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          criticidade: 'media',
          exames: [{ codigo: '01001', descricao: 'Glicose', tat: 24 }],
          endereco: {
            logradouro: 'Rua Test',
            numero: '123',
            bairro: 'Centro',
            cidade: 'São Paulo',
            estado: 'SP',
            cep: '01234567',
          },
        });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white/5 rounded-lg border border-white/10 p-8">
      {/* Disclaimer (Step 1) */}
      {step === 1 && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm text-amber-200">
            <strong>Aviso Legal:</strong> Template de contrato baseado em RDC 978 Arts. 36–39.
            Não substitui revisão jurídica. Revisão prevista para Phase 1 semana 2.
          </p>
        </div>
      )}

      {/* Steps */}
      <div className="mb-6">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded transition-colors ${
                s <= step ? 'bg-violet-500' : 'bg-white/10'
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-white/50 mt-2">Passo {step} de 4</p>
      </div>

      {/* Content */}
      <div className="min-h-[300px] mb-6">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Dados Gerais</h2>
            <input
              type="text"
              placeholder="Nome do laboratório"
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white placeholder:text-white/30"
            />
            <input
              type="text"
              placeholder="CNPJ (XX.XXX.XXX/0001-YY)"
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white placeholder:text-white/30 font-tabular-nums"
            />
            <input
              type="text"
              placeholder="AVS Anvisa"
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white placeholder:text-white/30"
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Exames Terceirizados</h2>
            <p className="text-white/50">Adicionar lista de exames...</p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Certificações e Contatos</h2>
            <p className="text-white/50">Adicionar certificações e contatos...</p>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Upload do Contrato</h2>
            <p className="text-white/50">Selecionar PDF (máx 10MB)...</p>
          </div>
        )}
      </div>

      {error && <div className="text-red-400 text-sm mb-4">{error}</div>}

      {/* Navigation */}
      <div className="flex gap-3 justify-end">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-white/50 hover:text-white transition-colors"
          >
            Cancelar
          </button>
        )}
        {step > 1 && (
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded transition-colors"
          >
            Anterior
          </button>
        )}
        {step < 4 && (
          <button
            onClick={handleNext}
            className="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded transition-colors"
          >
            Próximo
          </button>
        )}
        {step === 4 && (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded transition-colors disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Registrar Contrato'}
          </button>
        )}
      </div>
    </div>
  );
}
