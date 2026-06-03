import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Modal, Pressable } from 'react-native';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme/darkTheme';

interface EvidenceItem {
  id: string;
  type: 'photo' | 'audio' | 'pdf' | 'document';
  title: string;
  date: string;
  status: 'aprovado' | 'pendente' | 'rejeitado';
}

interface EvidenceBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  evidences: EvidenceItem[];
  onTakePhoto: () => void;
  onRecordAudio: () => void;
  onAttachPDF: () => void;
}

const TYPE_ICONS: Record<EvidenceItem['type'], string> = {
  photo: '📷',
  audio: '🎙',
  pdf: '📄',
  document: '📋',
};

const STATUS_CONFIG: Record<EvidenceItem['status'], { label: string; color: string; bg: string }> =
  {
    aprovado: { label: 'Aprovado', color: '#fff', bg: colors.accent.emerald },
    pendente: { label: 'Pendente', color: '#000', bg: colors.accent.amber },
    rejeitado: { label: 'Rejeitado', color: '#fff', bg: colors.accent.red },
  };

export const EvidenceBottomSheet = React.memo(function EvidenceBottomSheet({
  visible,
  onClose,
  evidences,
  onTakePhoto,
  onRecordAudio,
  onAttachPDF,
}: EvidenceBottomSheetProps): React.JSX.Element {
  const renderEvidence = useCallback(({ item }: { item: EvidenceItem }) => {
    const statusCfg = STATUS_CONFIG[item.status];
    return (
      <View style={styles.evidenceRow}>
        <Text style={styles.evidenceIcon}>{TYPE_ICONS[item.type]}</Text>
        <View style={styles.evidenceContent}>
          <Text style={styles.evidenceTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.evidenceDate}>{item.date}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
          <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
        </View>
      </View>
    );
  }, []);

  const keyExtractor = useCallback((item: EvidenceItem) => item.id, []);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {/* Handle */}
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          <Text style={styles.sheetTitle}>Evidências</Text>

          {evidences.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Nenhuma evidência vinculada</Text>
            </View>
          ) : (
            <FlatList
              data={evidences}
              renderItem={renderEvidence}
              keyExtractor={keyExtractor}
              style={styles.list}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onTakePhoto}
              accessibilityRole="button"
              accessibilityLabel="Tirar foto"
            >
              <Text style={styles.actionIcon}>📷</Text>
              <Text style={styles.actionLabel}>Tirar Foto</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={onRecordAudio}
              accessibilityRole="button"
              accessibilityLabel="Gravar áudio"
            >
              <Text style={styles.actionIcon}>🎙</Text>
              <Text style={styles.actionLabel}>Gravar Áudio</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={onAttachPDF}
              accessibilityRole="button"
              accessibilityLabel="Anexar PDF"
            >
              <Text style={styles.actionIcon}>📎</Text>
              <Text style={styles.actionLabel}>Anexar PDF</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fechar evidências"
          >
            <Text style={styles.closeText}>Fechar</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '75%',
    paddingBottom: spacing.xl,
    ...shadows.modal,
  },
  handleRow: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  sheetTitle: {
    color: colors.text.primary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  list: {
    paddingHorizontal: spacing.lg,
    maxHeight: 240,
  },
  evidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
  },
  evidenceIcon: {
    fontSize: 20,
    marginRight: spacing.md,
  },
  evidenceContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  evidenceTitle: {
    color: colors.text.primary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
  },
  evidenceDate: {
    color: colors.text.muted,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  emptyState: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: typography.sizes.base,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted,
    marginTop: spacing.sm,
  },
  actionButton: {
    alignItems: 'center',
    minWidth: 80,
    minHeight: 56,
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  actionLabel: {
    color: colors.text.muted,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  closeButton: {
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.border,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  closeText: {
    color: colors.text.primary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
});
