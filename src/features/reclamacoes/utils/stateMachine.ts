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
    Nova: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    Analisando: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    RCA: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
    Resolvida: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    Comunicada: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    Fechada: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400',
  };
  return colors[status];
}
