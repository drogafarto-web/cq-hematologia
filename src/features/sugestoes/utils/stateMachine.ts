export type SugestaoStatus = 'aberta' | 'analisada' | 'implementada' | 'rejeitada';

const transicoes: Record<SugestaoStatus, SugestaoStatus[]> = {
  aberta: ['analisada'],
  analisada: ['implementada', 'rejeitada'],
  implementada: [],
  rejeitada: [],
};

export function validateTransition(
  statusAtual: SugestaoStatus,
  novoStatus: SugestaoStatus
): boolean {
  return transicoes[statusAtual]?.includes(novoStatus) ?? false;
}

export function getNextStates(statusAtual: SugestaoStatus): SugestaoStatus[] {
  return transicoes[statusAtual] ?? [];
}

export function getStatusLabel(status: SugestaoStatus): string {
  const labels: Record<SugestaoStatus, string> = {
    aberta: 'Aberta',
    analisada: 'Sendo analisada',
    implementada: 'Implementada',
    rejeitada: 'Rejeitada',
  };
  return labels[status];
}

export function getStatusColor(status: SugestaoStatus): string {
  const colors: Record<SugestaoStatus, string> = {
    aberta: 'blue',
    analisada: 'yellow',
    implementada: 'green',
    rejeitada: 'red',
  };
  return colors[status];
}
