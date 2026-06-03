import type { FC } from 'react';

export type UroLoteTipo = 'tira' | 'controle';

export interface UroLoteTipoSelectorProps {
  value: UroLoteTipo;
  onChange: (tipo: UroLoteTipo) => void;
  disabled?: boolean;
}

export const UroLoteTipoSelector: FC<UroLoteTipoSelectorProps> = ({
  value,
  onChange,
  disabled,
}) => {
  return (
    <fieldset className="flex gap-3" disabled={disabled}>
      <legend className="text-sm font-medium text-slate-300 mb-2">Tipo de insumo</legend>
      {(['tira', 'controle'] as const).map((t) => (
        <label
          key={t}
          className={[
            'flex-1 cursor-pointer rounded-md border px-4 py-3 transition-colors',
            value === t
              ? 'border-violet-500 bg-violet-500/10 text-violet-200'
              : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600',
            disabled && 'pointer-events-none opacity-50',
          ].join(' ')}
        >
          <input
            type="radio"
            name="uro-lote-tipo"
            value={t}
            checked={value === t}
            onChange={() => onChange(t)}
            disabled={disabled}
            className="sr-only"
            aria-label={t === 'tira' ? 'Tira reagente' : 'Material de controle'}
          />
          <span className="block text-sm font-semibold uppercase tracking-wide">
            {t === 'tira' ? 'Tira reagente' : 'Material de controle'}
          </span>
          <span className="block text-xs text-slate-500 mt-1">
            {t === 'tira' ? 'Combur, Multistix, etc.' : 'Bio-Rad, Randox, etc.'}
          </span>
        </label>
      ))}
    </fieldset>
  );
};
