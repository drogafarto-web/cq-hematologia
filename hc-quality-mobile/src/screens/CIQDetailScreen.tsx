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

interface CIQDetailScreenProps {
  route: {
    params: {
      runId: string;
      equipmentId?: string;
    };
  };
  navigation: {
    goBack: () => void;
  };
}

/**
 * CIQDetailScreen — Displays CIQ run detail and allows adding a comment.
 *
 * Comments submitted via Cloud Callable `submitCIQComment`.
 * If offline, callable wrapper queues the action to AsyncStorage automatically.
 */
export function CIQDetailScreen({ route, navigation }: CIQDetailScreenProps): React.JSX.Element {
  const { runId, equipmentId } = route.params;
  const labId = useAuthStore((s) => s.activeLabId);
  const { callFunction } = useMobileCallables();

  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);
  const [submittedOffline, setSubmittedOffline] = useState(false);

  const validateComment = (): string | null => {
    const trimmed = comments.trim();
    if (!trimmed) return 'Adicione um comentário antes de enviar.';
    if (trimmed.length < 3) return 'Comentário deve ter no mínimo 3 caracteres.';
    if (trimmed.length > 500) return 'Comentário não pode exceder 500 caracteres.';
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateComment();
    if (validationError) {
      Alert.alert('Validação', validationError);
      return;
    }

    if (!labId) {
      Alert.alert('Erro', 'Laboratório não identificado. Faça login novamente.');
      return;
    }

    setLoading(true);
    try {
      await callFunction('submitCIQComment', {
        labId,
        runId,
        comments: comments.trim(),
      });
      Alert.alert('Sucesso', 'Comentário salvo com sucesso.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      // callFunction auto-queues on network failure
      // so we inform the user it will sync later
      const isNetworkError =
        err.code === 'unavailable' || err.message?.includes('network');

      if (isNetworkError) {
        setSubmittedOffline(true);
        setComments('');
        Alert.alert(
          'Salvo offline',
          'Sem conexão no momento. O comentário será enviado automaticamente quando o dispositivo reconectar.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('Erro', err.message || 'Falha ao enviar comentário.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <OfflineIndicator />
      <View style={styles.content}>
        {equipmentId ? (
          <View style={styles.runHeader}>
            <Text style={styles.runLabel}>Equipamento</Text>
            <Text style={styles.runValue}>{equipmentId}</Text>
          </View>
        ) : null}

        <Text style={styles.runIdLabel}>ID da Corrida</Text>
        <Text style={styles.runId}>{runId}</Text>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Adicionar Comentário</Text>
        <Text style={styles.sectionHint}>
          Registre observações sobre esta corrida para fins de auditoria.
        </Text>

        <TextInput
          style={[styles.input, loading && styles.inputDisabled]}
          placeholder="Ex: Reagente lote 2024-08 — controle dentro do limite aceitável..."
          placeholderTextColor="#555"
          multiline
          numberOfLines={6}
          value={comments}
          onChangeText={setComments}
          editable={!loading}
          maxLength={500}
          textAlignVertical="top"
          autoFocus={false}
        />

        <Text style={styles.charCount}>{comments.length}/500</Text>

        {submittedOffline ? (
          <View style={styles.offlineConfirm}>
            <Text style={styles.offlineConfirmText}>
              Comentário enfileirado — será sincronizado ao reconectar.
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Salvar comentário"
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Salvar Comentário</Text>
            )}
          </TouchableOpacity>
        )}
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
  runHeader: {
    marginBottom: 8,
  },
  runLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  runValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  runIdLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 2,
  },
  runId: {
    color: '#6366f1',
    fontSize: 12,
    fontFamily: 'monospace',
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
    marginBottom: 6,
  },
  sectionHint: {
    color: '#666',
    fontSize: 12,
    marginBottom: 16,
    lineHeight: 18,
  },
  input: {
    backgroundColor: '#141417',
    borderColor: '#2a2a2e',
    borderWidth: 1,
    borderRadius: 8,
    color: '#fff',
    padding: 12,
    marginBottom: 6,
    minHeight: 120,
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
  button: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  offlineConfirm: {
    backgroundColor: '#78350f',
    borderRadius: 8,
    padding: 12,
  },
  offlineConfirmText: {
    color: '#fef3c7',
    fontSize: 13,
    textAlign: 'center',
  },
});
