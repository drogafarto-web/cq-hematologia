import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../theme/darkTheme';
import { ProgressHeader, FilterChip } from '../components/audit/ProgressHeader';
import {
  ChecklistItemCard,
  ChecklistItem,
  ResponseType,
} from '../components/audit/ChecklistItemCard';
import { FindingSheet, Finding, Severity } from '../components/audit/FindingSheet';

interface AuditExecutionScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    goBack: () => void;
  };
  route: {
    params: {
      auditId?: string;
    };
  };
}

// Mock checklist data
const MOCK_ITEMS: ChecklistItem[] = Array.from({ length: 57 }, (_, i) => ({
  id: `item-${i + 1}`,
  number: i + 1,
  indicatorName: getIndicatorName(i),
  description: `Nível 1: Não atende\nNível 2: Atende parcialmente\nNível 3: Atende\nNível 4: Supera\nNível 5: Excelência`,
  response: null,
}));

function getIndicatorName(index: number): string {
  const names = [
    'Identificação do paciente em todas as amostras',
    'Rastreabilidade dos reagentes utilizados',
    'Calibração dos equipamentos dentro da validade',
    'Registro de temperatura dos refrigeradores',
    'Controle interno de qualidade realizado',
    'Procedimentos operacionais padrão atualizados',
    'Descarte adequado de resíduos biológicos',
    'EPI disponível e em bom estado',
    'Limpeza e desinfecção da bancada',
    'Registro de manutenção preventiva',
  ];
  return names[index % names.length];
}

export function AuditExecutionScreen({
  navigation,
  route,
}: AuditExecutionScreenProps): React.JSX.Element {
  const [items, setItems] = useState<ChecklistItem[]>(MOCK_ITEMS);
  const [activeFilter, setActiveFilter] = useState<FilterChip>('Todos');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [findingSheetVisible, setFindingSheetVisible] = useState(false);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [isOffline] = useState(false);
  const [pendingNCItemId, setPendingNCItemId] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);

  const respondedCount = useMemo(() => items.filter((i) => i.response !== null).length, [items]);

  const filteredItems = useMemo(() => {
    switch (activeFilter) {
      case 'Pendentes':
        return items.filter((i) => i.response === null);
      case 'NC':
        return items.filter((i) => i.response === 'nc');
      case 'Conforme':
        return items.filter((i) => i.response === 'conforme');
      default:
        return items;
    }
  }, [items, activeFilter]);

  const allResponded = respondedCount === items.length;

  const setResponse = useCallback((itemId: string, response: ResponseType) => {
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, response } : item)));
    // Trigger haptic feedback placeholder
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      // expo-haptics or react-native-haptic-feedback would be called here
    }
  }, []);

  const handleConforme = useCallback(() => {
    const currentItem = filteredItems[currentIndex];
    if (currentItem) {
      setResponse(currentItem.id, 'conforme');
      if (currentIndex < filteredItems.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        flatListRef.current?.scrollToIndex({
          index: currentIndex + 1,
          animated: true,
        });
      }
    }
  }, [filteredItems, currentIndex, setResponse]);

  const handleNC = useCallback(() => {
    const currentItem = filteredItems[currentIndex];
    if (currentItem) {
      setPendingNCItemId(currentItem.id);
      setFindingSheetVisible(true);
    }
  }, [filteredItems, currentIndex]);

  const handleNA = useCallback(() => {
    const currentItem = filteredItems[currentIndex];
    if (currentItem) {
      setResponse(currentItem.id, 'na');
      if (currentIndex < filteredItems.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        flatListRef.current?.scrollToIndex({
          index: currentIndex + 1,
          animated: true,
        });
      }
    }
  }, [filteredItems, currentIndex, setResponse]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      flatListRef.current?.scrollToIndex({
        index: currentIndex - 1,
        animated: true,
      });
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < filteredItems.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    }
  }, [currentIndex, filteredItems.length]);

  const handleItemPress = useCallback(
    (itemId: string) => {
      const idx = filteredItems.findIndex((i) => i.id === itemId);
      if (idx >= 0) {
        setCurrentIndex(idx);
      }
    },
    [filteredItems],
  );

  const handleToggleExpand = useCallback((itemId: string) => {
    setExpandedId((prev) => (prev === itemId ? null : itemId));
  }, []);

  const handleSaveFinding = useCallback(
    (findingData: Omit<Finding, 'id' | 'createdAt'>) => {
      const newFinding: Finding = {
        ...findingData,
        id: `finding-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      setFindings((prev) => [...prev, newFinding]);
      if (pendingNCItemId) {
        setResponse(pendingNCItemId, 'nc');
        setPendingNCItemId(null);
      }
      setFindingSheetVisible(false);
      // Advance to next
      if (currentIndex < filteredItems.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      }
    },
    [pendingNCItemId, setResponse, currentIndex, filteredItems.length],
  );

  const handleFinalize = useCallback(() => {
    navigation.navigate('AuditSummary', {
      auditId: route.params.auditId,
      findings: JSON.stringify(findings),
      totalItems: items.length,
      conformeCount: items.filter((i) => i.response === 'conforme').length,
      ncCount: items.filter((i) => i.response === 'nc').length,
      naCount: items.filter((i) => i.response === 'na').length,
    });
  }, [navigation, route.params.auditId, findings, items]);

  const renderItem = useCallback(
    ({ item, index }: { item: ChecklistItem; index: number }) => (
      <ChecklistItemCard
        item={item}
        onPress={handleItemPress}
        isExpanded={expandedId === item.id}
        onToggleExpand={handleToggleExpand}
      />
    ),
    [handleItemPress, expandedId, handleToggleExpand],
  );

  const keyExtractor = useCallback((item: ChecklistItem) => item.id, []);

  const getItemLayout = useCallback(
    (_data: unknown, index: number) => ({
      length: 80,
      offset: 80 * index,
      index,
    }),
    [],
  );

  return (
    <View style={styles.container}>
      <ProgressHeader
        current={respondedCount}
        total={items.length}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        isOffline={isOffline}
      />

      <FlatList
        ref={flatListRef}
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
      />

      {/* Bottom action bar */}
      <View style={styles.actionBar}>
        {allResponded ? (
          <TouchableOpacity
            style={styles.finalizeButton}
            onPress={handleFinalize}
            accessibilityRole="button"
            accessibilityLabel="Finalizar auditoria"
            testID="btn-finalize"
          >
            <Text style={styles.finalizeText}>Finalizar</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={handlePrevious}
              disabled={currentIndex === 0}
              accessibilityRole="button"
              accessibilityLabel="Item anterior"
            >
              <Text style={[styles.navText, currentIndex === 0 && styles.navTextDisabled]}>←</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.responseButton, styles.conformeButton]}
              onPress={handleConforme}
              accessibilityRole="button"
              accessibilityLabel="Marcar como conforme"
              testID="btn-conforme"
            >
              <Text style={styles.responseButtonText}>Conforme</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.responseButton, styles.ncButton]}
              onPress={handleNC}
              accessibilityRole="button"
              accessibilityLabel="Marcar como não conforme"
              testID="btn-nc"
            >
              <Text style={styles.responseButtonText}>NC</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.responseButton, styles.naButton]}
              onPress={handleNA}
              accessibilityRole="button"
              accessibilityLabel="Marcar como não aplicável"
              testID="btn-na"
            >
              <Text style={styles.responseButtonText}>N/A</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButton}
              onPress={handleNext}
              disabled={currentIndex >= filteredItems.length - 1}
              accessibilityRole="button"
              accessibilityLabel="Próximo item"
            >
              <Text
                style={[
                  styles.navText,
                  currentIndex >= filteredItems.length - 1 && styles.navTextDisabled,
                ]}
              >
                →
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <FindingSheet
        visible={findingSheetVisible}
        onClose={() => {
          setFindingSheetVisible(false);
          setPendingNCItemId(null);
        }}
        onSave={handleSaveFinding}
        onTakePhoto={() => {
          // Camera integration placeholder
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  listContent: {
    paddingVertical: spacing.md,
    paddingBottom: 100,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  navButton: {
    width: 44,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    color: colors.text.primary,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  navTextDisabled: {
    color: colors.text.disabled,
  },
  responseButton: {
    flex: 1,
    height: 52,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
  },
  conformeButton: {
    backgroundColor: colors.accent.emerald,
  },
  ncButton: {
    backgroundColor: colors.accent.red,
  },
  naButton: {
    backgroundColor: '#6b7280',
  },
  responseButtonText: {
    color: '#fff',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  finalizeButton: {
    height: 52,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finalizeText: {
    color: '#fff',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
});
