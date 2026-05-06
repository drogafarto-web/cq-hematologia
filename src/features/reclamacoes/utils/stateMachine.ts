export type ReclamacaoStatus = 'Nova' | 'Analisando' | 'RCA' | 'Resolvida' | 'Comunicada' | 'Fechada';

const transicoes: Record<ReclamacaoStatus, ReclamacaoStatus[]> = {
  Nova: ['Analisando'],
  Analisando: ['RCA'],
  RCA: ['Resolvida'],
  Resolvida: ['Comunicada'],
  Comunicada: ['Fechada'],
  Fechada: [],
};

export function validateTransition(
  statusAtual: ReclamacaoStatus,
  novoStatus: ReclamacaoStatus
): boolean {
  return transicoes[statusAtual]?.includes(novoStatus) ?? false;
}

export function getNextStates(statusAtual: ReclamacaoStatus): ReclamacaoStatus[] {
  return transicoes[statusAtual] ?? [];
}

export function getStatusLabel(status: ReclamacaoStatus): string {
  const labels: Record<ReclamacaoStatus, string> = {
    Nova: 'Nova',
    Analisando: 'Analisando',
    RCA: 'RCA em andamento',
    Resolvida: 'Resolvida',
    Comunicada: 'Comunicada',
    Fechada: 'Fechada',
  };
  return labels[status];
}

export function getStatusColor(status: ReclamacaoStatus): string {
  const colors: Record<ReclamacaoStatus, string> = {
    Nova: 'blue',
    Analisando: 'yellow',
    RCA: 'orange',
    Resolvida: 'green',
    Comunicada: 'purple',
    Fechada: 'gray',
  };
  return colors[status];
}
