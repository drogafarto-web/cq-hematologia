import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NC } from '../hooks/useOpenNCs';

interface NCCardProps {
  nc: NC;
  onPress: (ncId: string) => void;
}

const STATUS_COLOR: Record<NC['status'], string> = {
  open: '#ef4444', // red-500 — urgent
  investigating: '#f59e0b', // amber-500 — in progress
  resolved: '#10b981', // emerald-500
  closed: '#6b7280', // gray-500
};

const STATUS_LABEL: Record<NC['status'], string> = {
  open: 'Aberta',
  investigating: 'Investigando',
  resolved: 'Resolvida',
  closed: 'Fechada',
};

function daysOpen(detectadoEm: number): number {
  return Math.floor((Date.now() - detectadoEm) / (1000 * 60 * 60 * 24));
}

export function NCCard({ nc, onPress }: NCCardProps): React.JSX.Element {
  const color = STATUS_COLOR[nc.status] ?? '#6b7280';
  const label = STATUS_LABEL[nc.status] ?? nc.status;
  const days = daysOpen(nc.detectadoEm);

  return (
    <TouchableOpacity
      style={[styles.container, { borderLeftColor: color }]}
      onPress={() => onPress(nc.id)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Não-conformidade: ${nc.description}, status: ${label}`}
      accessibilityHint="Duplo toque para ver detalhes e atualizar status"
      testID="nc-card"
    >
      <View style={styles.header}>
        <Text style={styles.description} numberOfLines={2}>
          {nc.description}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: color }]}>
          <Text style={styles.daysText}>{days}d</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{nc.equipmentId}</Text>
          {nc.moduleId ? <Text style={styles.metaSeparator}> · </Text> : null}
          {nc.moduleId ? <Text style={styles.metaText}>{nc.moduleId}</Text> : null}
        </View>
        <Text style={[styles.statusLabel, { color }]}>{label}</Text>
      </View>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  description: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
    lineHeight: 18,
  },
  statusBadge: {
    minWidth: 32,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: 'center',
  },
  daysText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    // Upgraded #888 → #b3b3b3 (WCAG AA 4.5:1 on #141417)
    color: '#b3b3b3',
    fontSize: 11,
  },
  metaSeparator: {
    // Decorative separator — non-interactive
    color: '#666666',
    fontSize: 11,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
