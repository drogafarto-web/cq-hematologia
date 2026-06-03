import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../theme/darkTheme';

export type FilterChip = 'Todos' | 'Pendentes' | 'NC' | 'Conforme';

interface ProgressHeaderProps {
  current: number;
  total: number;
  activeFilter: FilterChip;
  onFilterChange: (filter: FilterChip) => void;
  isOffline: boolean;
}

const FILTERS: FilterChip[] = ['Todos', 'Pendentes', 'NC', 'Conforme'];

export const ProgressHeader = React.memo(function ProgressHeader({
  current,
  total,
  activeFilter,
  onFilterChange,
  isOffline,
}: ProgressHeaderProps): React.JSX.Element {
  const progress = total > 0 ? current / total : 0;

  return (
    <View style={styles.container}>
      {isOffline && (
        <View style={styles.offlineBanner} accessibilityRole="alert">
          <Text style={styles.offlineText}>Modo offline — respostas serão sincronizadas</Text>
        </View>
      )}

      <View style={styles.progressRow}>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressLabel}>
          {current}/{total} itens
        </Text>
      </View>

      <View style={styles.chipRow}>
        {FILTERS.map((filter) => {
          const isActive = activeFilter === filter;
          return (
            <TouchableOpacity
              key={filter}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => onFilterChange(filter)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Filtrar por ${filter}`}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{filter}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
  },
  offlineBanner: {
    backgroundColor: colors.accent.amber,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  offlineText: {
    color: '#000',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: borderRadius.pill,
    overflow: 'hidden',
    marginRight: spacing.sm,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accent.violet,
    borderRadius: borderRadius.pill,
  },
  progressLabel: {
    color: colors.text.muted,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    minWidth: 70,
    textAlign: 'right',
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.bg,
    minHeight: 32,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.accent.violet,
  },
  chipText: {
    color: colors.text.muted,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: typography.weights.semibold,
  },
});
