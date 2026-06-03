import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDecimal(v: number | string | bigint, decimals = 2): string {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'bigint' ? Number(v) : v;
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function dentroDoRange(valor: number, min: number, max: number): boolean {
  return valor >= min && valor <= max;
}

export function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
