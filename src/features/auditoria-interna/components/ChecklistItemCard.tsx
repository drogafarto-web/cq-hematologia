import React, { useState } from 'react';
import type { ChecklistItem } from '../types';
import { AchadoForm } from './AchadoForm';

interface ChecklistResponse {
  resposta: string;
  severidade?: string;
  timestamp: number;
}

interface ChecklistItemCardProps {
  item: ChecklistItem;
  response?: ChecklistResponse;
  onChange: (itemId: string, resposta: string, severidade?: string) => void;
}

export function ChecklistItemCard({ item, response, onChange }: ChecklistItemCardProps) {
  const [showAchadoForm, setShowAchadoForm] = useState(false);

  const handleResposta = (resposta: string) => {
    onChange(item.id, resposta);
    if (resposta === 'não-conforme') {
      setShowAchadoForm(true);
    }
  };

  const handleSeveridade = (severidade: string) => {
    onChange(item.id, response?.resposta || 'não-conforme', severidade);
  };

  return (
    <div className="border border-white/10 rounded-lg p-4 space-y-3 bg-white/5 hover:bg-white/10 transition">
      {/* Item number + description */}
      <div className="space-y-1">
        <div className="text-sm text-violet-500 font-mono">{item.numeroDICQ}</div>
        <h3 className="text-base font-medium">{item.descricao}</h3>
        {item.categoria && <p className="text-sm text-white/60">{item.categoria}</p>}
      </div>

      {/* Response radio buttons — large touch targets */}
      <div className="space-y-2">
        <label className="flex items-center space-x-3 cursor-pointer p-2 rounded hover:bg-white/5 transition min-h-[48px]">
          <input
            type="radio"
            name={`item-${item.id}`}
            value="conforme"
            checked={response?.resposta === 'conforme'}
            onChange={() => handleResposta('conforme')}
            className="w-5 h-5 cursor-pointer"
          />
          <span className="flex-1 flex items-center space-x-2">
            <span className="text-emerald-500">✓</span>
            <span>Conforme</span>
          </span>
        </label>

        <label className="flex items-center space-x-3 cursor-pointer p-2 rounded hover:bg-white/5 transition min-h-[48px]">
          <input
            type="radio"
            name={`item-${item.id}`}
            value="não-conforme"
            checked={response?.resposta === 'não-conforme'}
            onChange={() => handleResposta('não-conforme')}
            className="w-5 h-5 cursor-pointer"
          />
          <span className="flex-1 flex items-center space-x-2">
            <span className="text-red-500">✗</span>
            <span>Não conforme</span>
          </span>
        </label>

        <label className="flex items-center space-x-3 cursor-pointer p-2 rounded hover:bg-white/5 transition min-h-[48px]">
          <input
            type="radio"
            name={`item-${item.id}`}
            value="N/A"
            checked={response?.resposta === 'N/A'}
            onChange={() => handleResposta('N/A')}
            className="w-5 h-5 cursor-pointer"
          />
          <span>N/A</span>
        </label>
      </div>

      {/* Severity selector (shown if "não conforme") */}
      {response?.resposta === 'não-conforme' && (
        <div className="border-t border-white/10 pt-3">
          <div className="text-sm text-white/70 mb-2">Severidade:</div>
          <div className="space-y-2">
            {['crítica', 'grave', 'moderada', 'leve', 'observação'].map((sev) => (
              <label
                key={sev}
                className="flex items-center space-x-3 cursor-pointer p-2 rounded hover:bg-white/5 transition min-h-[40px]"
              >
                <input
                  type="radio"
                  name={`severity-${item.id}`}
                  value={sev}
                  checked={response?.severidade === sev}
                  onChange={() => handleSeveridade(sev)}
                  className="w-4 h-4 cursor-pointer"
                />
                <span className="text-sm capitalize">{sev}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Achado form (shown if severity >= grave) */}
      {response?.resposta === 'não-conforme' &&
        ['crítica', 'grave'].includes(response?.severidade || '') &&
        showAchadoForm && (
          <AchadoForm
            itemId={item.id}
            severity={response.severidade || ''}
            onSave={() => setShowAchadoForm(false)}
          />
        )}
    </div>
  );
}
