import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

export interface ReadingData {
  parameterName: string;
  value: string;
  unit: string;
  timestamp: number;
}

interface ReadingFormProps {
  onSubmit: (data: ReadingData) => Promise<void>;
  loading: boolean;
}

const UNIT_OPTIONS = ['°C', '°F', '%', 'mg/dL', 'g/dL', 'mmol/L', 'Pa'];

/**
 * ReadingForm — Manual parameter reading entry form.
 *
 * Used in ReadingsScreen for operators to register temperature,
 * pressure or other parameter readings offline-first.
 */
export function ReadingForm({ onSubmit, loading }: ReadingFormProps): React.JSX.Element {
  const [parameter, setParameter] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState<string>('°C');
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);

  const isValid = parameter.trim().length > 0 && value.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid || loading) return;

    await onSubmit({
      parameterName: parameter.trim(),
      value: value.trim(),
      unit,
      timestamp: Date.now(),
    });

    // Reset on success (caller controls loading state)
    setParameter('');
    setValue('');
  };

  return (
    <View style={styles.form}>
      <Text style={styles.label}>Parâmetro *</Text>
      <TextInput
        style={[styles.input, loading && styles.disabled]}
        placeholder="Ex: Temperatura do freezer -80°C"
        placeholderTextColor="#555"
        value={parameter}
        onChangeText={setParameter}
        editable={!loading}
        maxLength={100}
        returnKeyType="next"
        autoCapitalize="sentences"
        accessibilityLabel="Nome do parâmetro"
        accessibilityHint="Digite o nome do parâmetro a ser medido"
        testID="parameter-input"
      />

      <Text style={styles.label}>Valor Medido *</Text>
      <TextInput
        style={[styles.input, loading && styles.disabled]}
        placeholder="Ex: -20.5"
        placeholderTextColor="#555"
        value={value}
        onChangeText={setValue}
        keyboardType="decimal-pad"
        editable={!loading}
        maxLength={20}
        returnKeyType="done"
        accessibilityLabel="Valor medido"
        accessibilityHint="Digite o valor numérico da leitura"
        testID="value-input"
      />

      <Text style={styles.label}>Unidade</Text>
      <TouchableOpacity
        style={[styles.unitSelector, loading && styles.disabled]}
        onPress={() => setUnitPickerOpen(!unitPickerOpen)}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={`Unidade selecionada: ${unit}`}
      >
        <Text style={styles.unitSelected}>{unit}</Text>
        <Text style={styles.unitChevron}>{unitPickerOpen ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {unitPickerOpen ? (
        <View style={styles.unitDropdown}>
          {UNIT_OPTIONS.map((u) => (
            <TouchableOpacity
              key={u}
              style={[styles.unitOption, u === unit && styles.unitOptionActive]}
              onPress={() => {
                setUnit(u);
                setUnitPickerOpen(false);
              }}
            >
              <Text style={[styles.unitOptionText, u === unit && styles.unitOptionTextActive]}>
                {u}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.submitButton, (!isValid || loading) && styles.submitDisabled]}
        onPress={handleSubmit}
        disabled={!isValid || loading}
        accessibilityRole="button"
        accessibilityLabel="Registrar leitura"
        accessibilityHint="Duplo toque para salvar a leitura do parâmetro"
        testID="submit-reading-button"
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.submitText}>Registrar Leitura</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    marginTop: 8,
  },
  label: {
    color: '#ccc',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#141417',
    borderColor: '#2a2a2e',
    borderWidth: 1,
    borderRadius: 8,
    color: '#fff',
    padding: 12,
    fontSize: 14,
  },
  disabled: {
    opacity: 0.5,
  },
  unitSelector: {
    backgroundColor: '#141417',
    borderColor: '#2a2a2e',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unitSelected: {
    color: '#fff',
    fontSize: 14,
  },
  unitChevron: {
    color: '#888',
    fontSize: 11,
  },
  unitDropdown: {
    backgroundColor: '#1c1c20',
    borderColor: '#2a2a2e',
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
  },
  unitOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2e',
  },
  unitOptionActive: {
    backgroundColor: '#1e1e40',
  },
  unitOptionText: {
    // Upgraded #aaa (3.7:1) → #b3b3b3 (4.5:1 on #1c1c20) — WCAG AA
    color: '#b3b3b3',
    fontSize: 14,
  },
  unitOptionTextActive: {
    color: '#6366f1',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  submitDisabled: {
    opacity: 0.4,
  },
  submitText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
