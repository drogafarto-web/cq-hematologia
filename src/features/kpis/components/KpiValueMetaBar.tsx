import { useId, type ReactElement } from 'react';

import type { KPIMetaUnidade } from '../types/KPIMeta';

export type KpiValueMetaBarMode = 'lower-is-better' | 'higher-is-better';

export interface KpiValueMetaBarProps {
  readonly label: string;
  readonly value: number;
  readonly valueSuffix: string;
  readonly mode: KpiValueMetaBarMode;
  /** Meta numérica (mesma unidade que `value`); se omitida, só o valor é destacado. */
  readonly metaValor?: number;
  /** Unidade da meta no Firestore — usada só para omitir barra se incompatível. */
  readonly metaUnidade?: KPIMetaUnidade;
  readonly expectedUnidade: KPIMetaUnidade;
  /** Texto curto para tooltip (ex.: "Meta RT: 12h"). */
  readonly metaLabel: string;
  /** Fallback quando não há meta ou unidade incompatível (ex.: SLA do dia). */
  readonly fallbackReference?: number;
  readonly fallbackLabel?: string;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Faixa visual 0–1 no eixo: valor e meta posicionados; zona “boa” depende do modo.
 */
export function KpiValueMetaBar({
  label,
  value,
  valueSuffix,
  mode,
  metaValor,
  metaUnidade,
  expectedUnidade,
  metaLabel,
  fallbackReference,
  fallbackLabel,
}: KpiValueMetaBarProps): ReactElement {
  const uid = useId().replace(/:/g, '');
  const metaOk = typeof metaValor === 'number' && Number.isFinite(metaValor) && metaUnidade === expectedUnidade;
  const ref = metaOk ? metaValor : fallbackReference;

  const maxScale =
    expectedUnidade === 'hours'
      ? Math.max(value, ref ?? 0, 1) * 1.12
      : Math.max(100, value, ref ?? 0) * 1.02;

  const vPct = clamp(value / maxScale, 0, 1);
  const mPct =
    typeof ref === 'number' && Number.isFinite(ref) ? clamp(ref / maxScale, 0, 1) : null;

  const success =
    mode === 'lower-is-better'
      ? typeof ref === 'number' && Number.isFinite(ref)
        ? value <= ref
        : true
      : typeof ref === 'number' && Number.isFinite(ref)
        ? value >= ref
        : true;

  const dotFill = success ? '#34d399' : '#fbbf24';
  const trackTitle = [
    `${label}: ${value.toFixed(expectedUnidade === 'hours' ? 1 : 1)}${valueSuffix}`,
    metaOk ? `${metaLabel} (${metaValor!.toFixed(expectedUnidade === 'hours' ? 1 : 1)}${valueSuffix})` : null,
    !metaOk && fallbackLabel && typeof ref === 'number'
      ? `${fallbackLabel}: ${ref.toFixed(expectedUnidade === 'hours' ? 1 : 1)}${valueSuffix}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-white/45">
        <span>{label}</span>
        {metaOk ? (
          <span className="text-violet-300/90" title={metaLabel}>
            Meta
          </span>
        ) : (
          <span className="text-white/35" title={fallbackLabel ?? ''}>
            {fallbackLabel ? 'Ref.' : ''}
          </span>
        )}
      </div>
      <svg
        width="100%"
        height="36"
        viewBox="0 0 240 36"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={trackTitle}
        className="text-white/10"
      >
        <title>{trackTitle}</title>
        {/* track */}
        <rect x="8" y="14" width="224" height="8" rx="4" fill="currentColor" />
        {/* good zone hint */}
        {mode === 'lower-is-better' && mPct !== null ? (
          <rect
            x="8"
            y="14"
            width={224 * mPct}
            height="8"
            rx="4"
            fill={`url(#gradLow-${uid})`}
            opacity={0.35}
          />
        ) : null}
        {mode === 'higher-is-better' && mPct !== null ? (
          <rect
            x={8 + 224 * mPct}
            y="14"
            width={224 * (1 - mPct)}
            height="8"
            rx="4"
            fill={`url(#gradHigh-${uid})`}
            opacity={0.35}
          />
        ) : null}
        {/* meta tick */}
        {mPct !== null ? (
          <line
            x1={8 + 224 * mPct}
            y1="8"
            x2={8 + 224 * mPct}
            y2="28"
            stroke={metaOk ? '#a78bfa' : 'rgba(255,255,255,0.35)'}
            strokeWidth="2"
            strokeDasharray="4 3"
          >
            <title>
              {metaOk
                ? metaLabel
                : fallbackLabel && typeof ref === 'number'
                  ? `${fallbackLabel}: ${ref.toFixed(expectedUnidade === 'hours' ? 1 : 1)}${valueSuffix}`
                  : trackTitle}
            </title>
          </line>
        ) : null}
        {/* value */}
        <circle cx={8 + 224 * vPct} cy="18" r="5" fill={dotFill} stroke="#0b0b0c" strokeWidth="1.5" />
        <defs>
          <linearGradient id={`gradLow-${uid}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`gradHigh-${uid}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.5" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
