import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors, spacing, typography, borderRadius } from '../theme/darkTheme';
import { Severity } from '../components/audit/FindingSheet';

interface AuditSummaryScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    goBack: () => void;
  };
  route: {
    params: {
      auditId?: string;
      findings?: string;
      totalItems?: number;
      conformeCount?: number;
      ncCount?: number;
      naCount?: number;
    };
  };
}

interface FindingSummary {
  id: string;
  description: string;
  severity: Severity;
}

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string }> = {
  critica: { label: 'Crítica', color: '#fff', bg: '#dc2626' },
  grave: { label: 'Grave', color: '#fff', bg: colors.accent.red },
  moderada: { label: 'Moderada', color: '#000', bg: colors.accent.amber },
  leve: { label: 'Leve', color: '#fff', bg: colors.accent.blue },
  observacao: { label: 'Observação', color: '#fff', bg: '#6b7280' },
};

export function AuditSummaryScreen({
  navigation,
  route,
}: AuditSummaryScreenProps): React.JSX.Element {
  const {
    totalItems = 57,
    conformeCount = 45,
    ncCount = 8,
    naCount = 4,
  } = route.params;

  const findingsList: FindingSummary[] = useMemo(() => {
    if (route.params.findings) {
      try {
        return JSON.parse(route.params.findings);
      } catch {
        return [];
      }
    }
    // Mock findings for display
    return [
      { id: '1', description: 'Reagente vencido na bancada de bioquímica', severity: 'grave' as Severity },
      { id: '2', description: 'Ausência de registro de temperatura às 14h', severity: 'moderada' as Severity },
      { id: '3', description: 'EPI sem identificação do colaborador', severity: 'leve' as Severity },
    ];
  }, [route.params.findings]);

  const respondedItems = conformeCount + ncCount + naCount;
  const score = respondedItems > 0
    ? Math.round((conformeCount / (conformeCount + ncCount)) * 100)
    : 0;

  const scoreColor = score >= 80
    ? colors.accent.emerald
    : score >= 60
      ? colors.accent.amber
      : colors.accent.red;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Circular score display */}
      <View style={styles.scoreSection}>
        <View style={[styles.scoreCircle, { borderColor: scoreColor }]}>
          <Text style={[styles.scoreValue, { color: scoreColor }]}>{score}%</Text>
          <Text style={styles.scoreLabel}>Conformidade</Text>
        </View>
      </View>

      {/* Breakdown */}
      <View style={styles.breakdownSection}>
        <Text style={styles.sectionTitle}>Resumo</Text>
        <View style={styles.breakdownRow}>
          <View style={styles.breakdownItem}>
            <View style={[styles.breakdownDot, { backgroundColor: colors.accent.emerald }]} />
            <Text style={styles.breakdownValue}>{conformeCount}</Text>
            <Text style={styles.breakdownLabel}>Conforme</Text>
          </View>
          <View style={styles.breakdownItem}>
            <View style={[styles.breakdownDot, { backgroundColor: colors.accent.red }]} />
            <Text style={styles.breakdownValue}>{ncCount}</Text>
            <Text style={styles.breakdownLabel}>NC</Text>
          </View>
          <View style={styles.breakdownItem}>
            <View style={[styles.breakdownDot, { backgroundColor: '#6b7280' }]} />
            <Text style={styles.breakdownValue}>{naCount}</Text>
            <Text style={styles.breakdownLabel}>N/A</Text>
          </View>
          <View style={styles.breakdownItem}>
            <View style={[styles.breakdownDot, { backgroundColor: colors.accent.violet }]} />
            <Text style={styles.breakdownValue}>{totalItems}</Text>
            <Text style={styles.breakdownLabel}>Total</Text>
          </View>
        </View>
      </View>

      {/* Findings list */}
      <View style={styles.findingsSection}>
        <Text style={styles.sectionTitle}>
          Achados ({findingsList.length})
        </Text>
        {findingsList.length === 0 ? (
          <Text style={styles.noFindings}>Nenhuma não conformidade registrada</Text>
        ) : (
          findingsList.map((finding) => {
            const sevCfg = SEVERITY_CONFIG[finding.severity];
            return (
              <View key={finding.id} style={styles.findingCard}>
                <View style={styles.findingHeader}>
                  <View style={[styles.severityBadge, { backgroundColor: sevCfg.bg }]}>
                    <Text style={[styles.severityText, { color: sevCfg.color }]}>
                      {sevCfg.label}
                    </Text>
                  </View>
                </View>
                <Text style={styles.findingDescription} numberOfLines={3}>
                  {finding.description}
                </Text>
              </View>
            );
          })
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.actionsSection}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            // Generate report placeholder
          }}
          accessibilityRole="button"
          accessibilityLabel="Gerar relatório"
          testID="btn-generate-report"
        >
          <Text style={styles.primaryButtonText}>Gerar Relatório</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => {
            // Navigate to action plan placeholder
          }}
          accessibilityRole="button"
          accessibilityLabel="Ver plano de ação"
          testID="btn-action-plan"
        >
          <Text style={styles.secondaryButtonText}>Ver Plano de Ação</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tertiaryButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          testID="btn-back"
        >
          <Text style={styles.tertiaryButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  scoreSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  scoreCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: typography.weights.bold,
  },
  scoreLabel: {
    color: colors.text.muted,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    marginTop: spacing.xs,
  },
  breakdownSection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.md,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  breakdownItem: {
    alignItems: 'center',
  },
  breakdownDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: spacing.xs,
  },
  breakdownValue: {
    color: colors.text.primary,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  breakdownLabel: {
    color: colors.text.muted,
    fontSize: typography.sizes.xs,
    marginTop: spacing.xs,
  },
  findingsSection: {
    marginBottom: spacing.xl,
  },
  noFindings: {
    color: colors.text.muted,
    fontSize: typography.sizes.base,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  findingCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent.red,
  },
  findingHeader: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  severityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  severityText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  findingDescription: {
    color: colors.text.secondary,
    fontSize: typography.sizes.base,
    lineHeight: typography.sizes.base * typography.lineHeights.normal,
  },
  actionsSection: {
    gap: spacing.md,
  },
  primaryButton: {
    height: 52,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  secondaryButton: {
    height: 52,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.accent.violet,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  tertiaryButton: {
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tertiaryButtonText: {
    color: colors.text.muted,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
  },
});
