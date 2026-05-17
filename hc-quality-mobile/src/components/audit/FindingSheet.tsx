import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme/darkTheme';

export type Severity = 'critica' | 'grave' | 'moderada' | 'leve' | 'observacao';

export interface Finding {
  id: string;
  description: string;
  severity: Severity;
  photoUri?: string;
  createdAt: string;
}

interface FindingSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (finding: Omit<Finding, 'id' | 'createdAt'>) => void;
  onTakePhoto: () => void;
  photoUri?: string;
}

const SEVERITY_OPTIONS: { value: Severity; label: string; color: string }[] = [
  { value: 'critica', label: 'Crítica', color: '#dc2626' },
  { value: 'grave', label: 'Grave', color: colors.accent.red },
  { value: 'moderada', label: 'Moderada', color: colors.accent.amber },
  { value: 'leve', label: 'Leve', color: '#60a5fa' },
  { value: 'observacao', label: 'Observação', color: '#6b7280' },
];

export const FindingSheet = React.memo(function FindingSheet({
  visible,
  onClose,
  onSave,
  onTakePhoto,
  photoUri,
}: FindingSheetProps): React.JSX.Element {
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Severity>('moderada');

  const handleSave = useCallback(() => {
    if (!description.trim()) return;
    onSave({
      description: description.trim(),
      severity,
      photoUri,
    });
    setDescription('');
    setSeverity('moderada');
  }, [description, severity, photoUri, onSave]);

  const handleClose = useCallback(() => {
    setDescription('');
    setSeverity('moderada');
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {/* Handle */}
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.sheetTitle}>Registrar Achado (NC)</Text>

            {/* Description */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Descrição</Text>
              <TextInput
                style={styles.textInput}
                value={description}
                onChangeText={setDescription}
                placeholder="Descreva a não conformidade encontrada..."
                placeholderTextColor={colors.text.placeholder}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                accessibilityLabel="Descrição da não conformidade"
              />
            </View>

            {/* Severity picker */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Severidade</Text>
              <View style={styles.severityRow}>
                {SEVERITY_OPTIONS.map((opt) => {
                  const isActive = severity === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.severityChip,
                        isActive && { backgroundColor: opt.color },
                      ]}
                      onPress={() => setSeverity(opt.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isActive }}
                      accessibilityLabel={`Severidade ${opt.label}`}
                    >
                      <Text
                        style={[
                          styles.severityText,
                          isActive && styles.severityTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Photo capture */}
            <View style={styles.fieldGroup}>
              <TouchableOpacity
                style={styles.photoButton}
                onPress={onTakePhoto}
                accessibilityRole="button"
                accessibilityLabel="Capturar foto da não conformidade"
              >
                <Text style={styles.photoIcon}>📷</Text>
                <Text style={styles.photoLabel}>
                  {photoUri ? 'Foto capturada ✓' : 'Capturar Foto'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveButton, !description.trim() && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!description.trim()}
            accessibilityRole="button"
            accessibilityLabel="Salvar achado"
            accessibilityState={{ disabled: !description.trim() }}
          >
            <Text style={styles.saveText}>Salvar Achado</Text>
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
    maxHeight: '80%',
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
    marginBottom: spacing.lg,
  },
  fieldGroup: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    color: colors.text.muted,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.bg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text.primary,
    fontSize: typography.sizes.base,
    padding: spacing.md,
    minHeight: 100,
  },
  severityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  severityChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 36,
    justifyContent: 'center',
  },
  severityText: {
    color: colors.text.muted,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  severityTextActive: {
    color: '#fff',
    fontWeight: typography.weights.bold,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 56,
  },
  photoIcon: {
    fontSize: 20,
    marginRight: spacing.md,
  },
  photoLabel: {
    color: colors.text.secondary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
  },
  saveButton: {
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent.violet,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveText: {
    color: '#fff',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
});
