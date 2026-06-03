import { useState } from 'react';

interface JustificativaNAProps {
  value: string | null;
  onChange: (justificativa: string) => void;
}

const OPCOES_PADRAO = [
  'Não aplicável ao tipo de laboratório (fixo)',
  'Serviço não realizado neste EAC',
  'Item em fase de implementação',
  'Indicador exclusivo para Tipo III',
  'Outro (especificar)',
];

export function JustificativaNA({ value, onChange }: JustificativaNAProps) {
  const isCustom = value !== null && !OPCOES_PADRAO.slice(0, -1).includes(value);
  const [showCustom, setShowCustom] = useState(isCustom);
  const [customText, setCustomText] = useState(isCustom ? (value ?? '') : '');

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (selected === 'Outro (especificar)') {
      setShowCustom(true);
      onChange(customText || '');
    } else {
      setShowCustom(false);
      onChange(selected);
    }
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomText(e.target.value);
  };

  const handleCustomBlur = () => {
    if (customText.trim()) {
      onChange(customText.trim());
    }
  };

  const currentDropdownValue = showCustom
    ? 'Outro (especificar)'
    : value && OPCOES_PADRAO.slice(0, -1).includes(value)
      ? value
      : '';

  return (
    <div className="space-y-2 pl-1 border-l-2 border-violet-300 dark:border-violet-500/40 ml-1">
      <p className="text-[11px] font-medium text-violet-600 dark:text-violet-400 uppercase tracking-wide">
        Justificativa N/A
      </p>
      <select
        value={currentDropdownValue}
        onChange={handleSelect}
        className="w-full bg-slate-50 border border-slate-200 dark:bg-white/[0.03] dark:border-white/[0.08] rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-white/70 focus:outline-none focus:border-violet-500/40"
      >
        <option value="" disabled>
          Selecione a justificativa...
        </option>
        {OPCOES_PADRAO.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>

      {showCustom && (
        <input
          type="text"
          placeholder="Descreva a justificativa..."
          value={customText}
          onChange={handleCustomChange}
          onBlur={handleCustomBlur}
          autoFocus
          className="w-full bg-slate-50 border border-slate-200 dark:bg-white/[0.03] dark:border-white/[0.08] rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-white/70 placeholder:text-slate-400 dark:placeholder:text-white/20 focus:outline-none focus:border-violet-500/40"
        />
      )}

      {!value && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400">
          ⚠ Justificativa recomendada para itens N/A
        </p>
      )}
    </div>
  );
}
