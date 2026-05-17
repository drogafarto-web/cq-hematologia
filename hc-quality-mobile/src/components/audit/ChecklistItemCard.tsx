import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../theme/darkTheme';

export type ResponseType = 'conforme' | 'nc' | 'na' | null;

export interface ChecklistItem {
  id: string;
  number: number;
  indicatorName: string;
  description?: string;
  response: ResponseType;
}

interface ChecklistItemCardProps {
  item: ChecklistItem;
  onPress: (itemId: string) => void;
  isExpanded: boolean;
  onToggleExpand: (itemId: string) => void;
}

const RESPONSE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  conforme: { label: 'C', color: '#fff', bg: colors.accent.emerald },
  nc: { label: 'NC', color: '#fff', bg: colors.accent.red },
  na: { label: 'N/A', color: '#fff', bg: '#6b7280' },
};

export const ChecklistItemCard = React.memo(function ChecklistItemCard({
  item,
  onPress,
  isExpanded,
  onToggleExpand,
}: ChecklistItemCardProps): React.JSX.Element {
  const handlePress = useCallback(() => {
    onPress(item.id);
  }, [onPress, item.id]);

  const handleToggleExpand = useCallback(() => {
    onToggleExpand(item.id);
  }, [onToggleExpand, item.id]);

  const responseConfig = item.response ? RESPONSE_CONFIG[item.response] : null;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      onLongPress={handleToggleExpand}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Item ${item.number}: ${item.indicatorName}. Status: ${item.response ?? 'pendente'}`}
      accessibilityHint="Toque para selecionar, pressione longo para expandir detalhes"
      testID={`checklist-item-${item.id}`}
    >
      <View style={styles.row}>
        <View style={styles.numberBadge}>
          <Text style={styles.numberText}>{item.number}</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.indicatorName} numberOfLines={isExpanded ? undefined : 2}>
            {item.indicatorName}
          </Text>
        </View>

        {responseConfig ? (
          <View style={[styles.responseBadge, { backgroundColor: responseConfig.bg }]}>
            <Text style={[styles.responseText, { color: responseConfig.color }]}>
              {responseConfig.label}
            </Text>
          </View>
        ) : (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>—</Text>
          </View>
        )}
      </View>

      {isExpanded && item.description && (
        <View style={styles.expandedContent}>
          <Text style={styles.descriptionTitle}>Níveis de conformidade:</Text>
          <Text style={styles.descriptionText}>{item.description}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    minHeight: 72,
    justifyContent: 'center',
    borderLeftWidth: 3,
    borderLeftColor: colors.accent.violet,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  numberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  numberText: {
    color: colors.accent.violet,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  content: {
    flex: 1,
    marginRight: spacing.sm,
  },
  indicatorName: {
    color: colors.text.primary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    lineHeight: typography.sizes.base * typography.lineHeights.normal,
  },
  responseBadge: {
    minWidth: 36,
    height: 28,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs + 2,
  },
  responseText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  pendingBadge: {
    minWidth: 36,
    height: 28,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs + 2,
  },
  pendingText: {
    color: colors.text.disabled,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
  },
  expandedContent: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted,
    paddingLeft: 32 + spacing.md, // align with content after badge
  },
  descriptionTitle: {
    color: colors.text.muted,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  descriptionText: {
    color: colors.text.secondary,
    fontSize: typography.sizes.sm,
    lineHeight: typography.sizes.sm * typography.lineHeights.relaxed,
  },
});
