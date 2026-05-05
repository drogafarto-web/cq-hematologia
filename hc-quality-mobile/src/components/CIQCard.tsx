import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CIQRun } from '../hooks/useCIQRuns';

interface CIQCardProps {
  run: CIQRun;
  onPress: (runId: string) => void;
}

const STATUS_COLOR: Record<CIQRun['status'], string> = {
  valid: '#10b981',   // emerald-500
  invalid: '#ef4444', // red-500
  pending: '#f59e0b', // amber-500
};

const STATUS_ICON: Record<CIQRun['status'], string> = {
  valid: '✓',
  invalid: '✗',
  pending: '⟳',
};

export function CIQCard({ run, onPress }: CIQCardProps): React.JSX.Element {
  const color = STATUS_COLOR[run.status] ?? '#6b7280';
  const icon = STATUS_ICON[run.status] ?? '?';

  const date = new Date(run.startedAt).toLocaleDateString('pt-BR');
  const time = new Date(run.startedAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(run.id)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Corrida ${run.equipmentId} — ${run.status}`}
      accessibilityHint="Duplo toque para ver detalhes da corrida"
      testID="ciq-card"
    >
      <View style={styles.header}>
        <Text style={styles.equipment} numberOfLines={1}>
          {run.equipmentId}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: color }]}>
          <Text style={styles.statusIcon}>{icon}</Text>
        </View>
      </View>

      <Text style={styles.timestamp}>
        {date} às {time}
      </Text>

      {run.runType === 'VALIDATION' && (
        <Text style={styles.typeTag}>Validação</Text>
      )}

      {run.comments ? (
        <Text style={styles.comment} numberOfLines={2}>
          {run.comments}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#141417',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  equipment: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIcon: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  timestamp: {
    // Upgraded #888 → #b3b3b3 (WCAG AA 4.5:1 on #141417)
    color: '#b3b3b3',
    fontSize: 11,
    marginBottom: 4,
  },
  typeTag: {
    color: '#6366f1',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  comment: {
    color: '#bbb',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
});
