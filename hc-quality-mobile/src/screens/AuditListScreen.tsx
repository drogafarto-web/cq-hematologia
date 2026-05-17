import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { colors, spacing, typography, borderRadius } from '../theme/darkTheme';

type AuditStatus = 'planejada' | 'em_execucao' | 'finalizada';
type TabFilter = 'Planejadas' | 'Em Execução' | 'Finalizadas';

interface AuditSession {
  id: string;
  title: string;
  date: string;
  progress: number; // 0-100
  status: AuditStatus;
  totalItems: number;
  respondedItems: number;
}

interface AuditListScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

const STATUS_CONFIG: Record<AuditStatus, { label: string; color: string; bg: string }> = {
  planejada: { label: 'Planejada', color: '#fff', bg: colors.accent.blue },
  em_execucao: { label: 'Em Execução', color: '#000', bg: colors.accent.amber },
  finalizada: { label: 'Finalizada', color: '#fff', bg: colors.accent.emerald },
};

const TAB_TO_STATUS: Record<TabFilter, AuditStatus> = {
  'Planejadas': 'planejada',
  'Em Execução': 'em_execucao',
  'Finalizadas': 'finalizada',
};

const TABS: TabFilter[] = ['Planejadas', 'Em Execução', 'Finalizadas'];

// Mock data for development
const MOCK_AUDITS: AuditSession[] = [
  {
    id: '1',
    title: 'Auditoria Hematologia - Setor A',
    date: '2026-05-10',
    progress: 0,
    status: 'planejada',
    totalItems: 57,
    respondedItems: 0,
  },
  {
    id: '2',
    title: 'Auditoria Bioquímica - Turno Noturno',
    date: '2026-05-08',
    progress: 45,
    status: 'em_execucao',
    totalItems: 57,
    respondedItems: 26,
  },
  {
    id: '3',
    title: 'Auditoria Microbiologia - Mensal',
    date: '2026-05-01',
    progress: 100,
    status: 'finalizada',
    totalItems: 57,
    respondedItems: 57,
  },
];

export function AuditListScreen({ navigation }: AuditListScreenProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabFilter>('Planejadas');
  const [refreshing, setRefreshing] = useState(false);
  const [audits] = useState<AuditSession[]>(MOCK_AUDITS);

  const filteredAudits = useMemo(
    () => audits.filter((a) => a.status === TAB_TO_STATUS[activeTab]),
    [audits, activeTab]
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleAuditPress = useCallback(
    (audit: AuditSession) => {
      if (audit.status === 'finalizada') {
        navigation.navigate('AuditSummary', { auditId: audit.id });
      } else {
        navigation.navigate('AuditExecution', { auditId: audit.id });
      }
    },
    [navigation]
  );

  const handleNewAudit = useCallback(() => {
    navigation.navigate('AuditExecution', { auditId: 'new' });
  }, [navigation]);

  const renderAuditCard = useCallback(
    ({ item }: { item: AuditSession }) => {
      const statusCfg = STATUS_CONFIG[item.status];
      const dateFormatted = new Date(item.date).toLocaleDateString('pt-BR');

      return (
        <TouchableOpacity
          style={styles.card}
          onPress={() => handleAuditPress(item)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${item.title}, ${statusCfg.label}, ${item.progress}% concluído`}
          accessibilityHint="Toque para abrir a auditoria"
          testID={`audit-card-${item.id}`}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
              <Text style={[styles.statusText, { color: statusCfg.color }]}>
                {statusCfg.label}
              </Text>
            </View>
          </View>

          <Text style={styles.cardDate}>{dateFormatted}</Text>

          <View style={styles.progressRow}>
            <View style={styles.progressBarBg}>
              <View
                style={[styles.progressBarFill, { width: `${item.progress}%` }]}
              />
            </View>
            <Text style={styles.progressText}>{item.progress}%</Text>
          </View>

          <Text style={styles.itemsText}>
            {item.respondedItems}/{item.totalItems} itens respondidos
          </Text>
        </TouchableOpacity>
      );
    },
    [handleAuditPress]
  );

  const keyExtractor = useCallback((item: AuditSession) => item.id, []);

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filteredAudits}
        renderItem={renderAuditCard}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent.violet}
            colors={[colors.accent.violet]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              Nenhuma auditoria {activeTab.toLowerCase()}
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={handleNewAudit}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Iniciar nova auditoria"
        testID="fab-new-audit"
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
    minHeight: 40,
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: colors.accent.violet,
  },
  tabText: {
    color: colors.text.muted,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: typography.weights.bold,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent.violet,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    color: colors.text.primary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    flex: 1,
    marginRight: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  cardDate: {
    color: colors.text.muted,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.sm,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: borderRadius.pill,
    overflow: 'hidden',
    marginRight: spacing.sm,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accent.emerald,
    borderRadius: borderRadius.pill,
  },
  progressText: {
    color: colors.text.muted,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    minWidth: 32,
    textAlign: 'right',
  },
  itemsText: {
    color: colors.text.muted,
    fontSize: typography.sizes.xs,
  },
  emptyState: {
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: typography.sizes.base,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent.violet,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  fabIcon: {
    color: '#fff',
    fontSize: 28,
    fontWeight: typography.weights.bold,
    lineHeight: 30,
  },
});
