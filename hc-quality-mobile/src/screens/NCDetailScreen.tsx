import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useMobileCallables } from '../hooks/useMobileCallables';
import { useAuthStore } from '../store/useAuthStore';
import { OfflineIndicator } from '../components/OfflineIndicator';

interface NCDetailScreenProps {
  route: {
    params: {
      ncId: string;
      description?: string;
    };
  };
  navigation: {
    goBack: () => void;
  };
}

type NCStatus = 'investigating' | 'resolved';

interface StatusOption {
  status: NCStatus;
  label: string;
  description: string;
  color: string;
}

const STATUS_OPTIONS: StatusOption[] = [
  {
    status: 'investigating',
    label: 'Em Investigação',
    description: 'Iniciar investigação da causa raiz',
    color: '#f59e0b',
  },
  {
    status: 'resolved',
    label: 'Resolvida',
    description: 'Causa identificada e ação corretiva aplicada',
    color: '#10b981',
  },
];

/**
 * NCDetailScreen — Allows updating NC status via Cloud Callable.
 *
 * Updates submitted via callable `updateNCStatus`.
 * On network failure, callable wrapper queues action to AsyncStorage.
 *
 * STRIDE T-03.2-06: NC status update requires labMember role.
 * The server-side callable validates this — mobile only provides UI.
 */
export function NCDetailScreen({ route, navigation }: NCDetailScreenProps): React.JSX.Element {
  const { ncId, description } = route.params;
  const labId = useAuthStore((s) => s.activeLabId);
  const { callFunction } = useMobileCallables();

  const [loading, setLoading] = useState(false);
  const [justification, setJustification] = useState('');

  const handleUpdateStatus = async (newStatus: NCStatus) => {
    if (!labId) {
      Alert.alert('Erro', 'Laboratório não identificado. Faça login novamente.');
      return;
    }

    if (newStatus === 'resolved' && !justification.trim()) {
      Alert.alert(
        'Justificativa obrigatória',
        'Para marcar como resolvida, informe a ação corretiva aplicada.'
      );
      return;
    }

    Alert.alert(
      'Confirmar atualização',
      `Confirma a atualização do status para "${newStatus === 'investigating' ? 'Em Investigação' : 'Resolvida'}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            setLoading(true);
            try {
              await callFunction('updateNCStatus', {
                labId,
                ncId,
                status: newStatus,
                justification: justification.trim() || undefined,
              });

              Alert.alert('Sucesso', 'Status da NC atualizado.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (err: any) {
              const isNetworkError =
                err.code === 'unavailable' || err.message?.includes('network');

              if (isNetworkError) {
                Alert.alert(
                  'Salvo offline',
                  'Sem conexão no momento. A atualização será sincronizada ao reconectar.',
                  [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
              } else {
                Alert.alert('Erro', err.message || 'Falha ao atualizar NC.');
              }
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <OfflineIndicator />
      <View style={styles.content}>
        <Text style={styles.idLabel}>ID da NC</Text>
        <Text style={styles.idValue}>{ncId}</Text>

        {description ? (
          <>
            <Text style={styles.fieldLabel}>Descrição</Text>
            <View style={styles.descriptionBox}>
              <Text style={styles.descriptionText}>{description}</Text>
            </View>
          </>
        ) : null}

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Atualizar Status</Text>

        <Text style={styles.fieldLabel}>Justificativa / Ação Corretiva</Text>
        <TextInput
          style={[styles.input, loading && styles.inputDisabled]}
          placeholder="Descreva a causa raiz identificada ou ação corretiva aplicada..."
          placeholderTextColor="#555"
          multiline
          numberOfLines={4}
          value={justification}
          onChangeText={setJustification}
          editable={!loading}
          maxLength={300}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{justification.length}/300</Text>

        <View style={styles.buttonGroup}>
          {STATUS_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.status}
              style={[
                styles.button,
                { backgroundColor: option.color },
                loading && styles.buttonDisabled,
              ]}
              onPress={() => handleUpdateStatus(option.status)}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={option.label}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.buttonTitle}>{option.label}</Text>
                  <Text style={styles.buttonDescription}>{option.description}</Text>
                </>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    padding: 16,
  },
  idLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  idValue: {
    color: '#6366f1',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  fieldLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 8,
  },
  descriptionBox: {
    backgroundColor: '#141417',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  descriptionText: {
    color: '#ddd',
    fontSize: 13,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: '#222',
    marginVertical: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#141417',
    borderColor: '#2a2a2e',
    borderWidth: 1,
    borderRadius: 8,
    color: '#fff',
    padding: 12,
    marginBottom: 6,
    minHeight: 100,
    fontSize: 13,
    lineHeight: 20,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  charCount: {
    color: '#555',
    fontSize: 11,
    textAlign: 'right',
    marginBottom: 20,
  },
  buttonGroup: {
    gap: 12,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  buttonDescription: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
  },
});
