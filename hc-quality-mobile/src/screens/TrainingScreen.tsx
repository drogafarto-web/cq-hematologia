import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SignatureModal } from '../components/SignatureModal';
import { useMobileCallables } from '../hooks/useMobileCallables';
import { useAuthStore } from '../store/useAuthStore';
import { OfflineIndicator } from '../components/OfflineIndicator';

interface TrainingRecord {
  id: string;
  title: string;
  moduleName: string;
  dueDate?: number;
  lastSignedAt?: number;
  status: 'pending' | 'signed' | 'overdue';
}

interface TrainingScreenProps {
  route?: {
    params?: {
      trainingId?: string;
    };
  };
}

/** Placeholder until Firestore subscription is wired in Phase 3.2 Plan 02 */
const MOCK_TRAININGS: TrainingRecord[] = [
  {
    id: 'training-001',
    title: 'Procedimento de Coleta de Sangue',
    moduleName: 'POP-0042',
    dueDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
    status: 'pending',
  },
  {
    id: 'training-002',
    title: 'Controle de Qualidade Interno — Fase III',
    moduleName: 'POP-0018',
    lastSignedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    status: 'signed',
  },
];

const STATUS_CONFIG = {
  pending: { color: '#f59e0b', label: 'Pendente' },
  signed: { color: '#10b981', label: 'Assinado' },
  overdue: { color: '#ef4444', label: 'Atrasado' },
};

/**
 * TrainingScreen — Lists training records and allows electronic signature.
 *
 * Signature via SignatureModal → callable `submitTrainingSignature`.
 * Firestore path: /labs/{labId}/treinamentos/{treinamentoId}
 *
 * STRIDE T-03.2-05: PIN + timestamp + user identity → audit log callable.
 */
export function TrainingScreen({ route }: TrainingScreenProps): React.JSX.Element {
  const labId = useAuthStore((s) => s.activeLabId);
  const { callFunction } = useMobileCallables();

  const [selectedTraining, setSelectedTraining] = useState<TrainingRecord | null>(null);
  const [signatureModalVisible, setSignatureModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [trainings, setTrainings] = useState<TrainingRecord[]>(MOCK_TRAININGS);

  // If a specific trainingId is passed via route, auto-select it
  useEffect(() => {
    const trainingId = route?.params?.trainingId;
    if (trainingId) {
      const found = trainings.find((t) => t.id === trainingId);
      if (found) setSelectedTraining(found);
    }
  }, [route?.params?.trainingId, trainings]);

  const handleOpenSignature = (training: TrainingRecord) => {
    if (training.status === 'signed') {
      Alert.alert(
        'Já assinado',
        `Este treinamento foi assinado em ${
          training.lastSignedAt
            ? new Date(training.lastSignedAt).toLocaleDateString('pt-BR')
            : 'data desconhecida'
        }.`
      );
      return;
    }
    setSelectedTraining(training);
    setSignatureModalVisible(true);
  };

  const handleSign = async (pin: string) => {
    if (!selectedTraining || !labId) return;

    setLoading(true);
    try {
      await callFunction('submitTrainingSignature', {
        labId,
        trainingId: selectedTraining.id,
        signatureMethod: 'pin',
        // PIN is hashed server-side — never stored in plain text
        pin,
        timestamp: Date.now(),
      });

      // Update local state optimistically
      setTrainings((prev) =>
        prev.map((t) =>
          t.id === selectedTraining.id
            ? { ...t, status: 'signed', lastSignedAt: Date.now() }
            : t
        )
      );

      setSignatureModalVisible(false);
      Alert.alert('Sucesso', `Treinamento "${selectedTraining.title}" assinado com sucesso.`);
    } catch (err: any) {
      const isNetworkError =
        err.code === 'unavailable' || err.message?.includes('network');

      setSignatureModalVisible(false);

      if (isNetworkError) {
        Alert.alert(
          'Assinatura enfileirada',
          'Sem conexão. A assinatura será enviada automaticamente ao reconectar.'
        );
      } else {
        Alert.alert('Erro', err.message || 'Falha ao assinar treinamento.');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDueDate = (ts?: number) => {
    if (!ts) return null;
    const d = new Date(ts);
    const isPast = ts < Date.now();
    return { label: d.toLocaleDateString('pt-BR'), isPast };
  };

  return (
    <ScrollView style={styles.container}>
      <OfflineIndicator />
      <View style={styles.content}>
        <Text style={styles.title}>Treinamentos</Text>
        <Text style={styles.subtitle}>
          Assine os treinamentos pendentes para manter sua certificação em dia.
        </Text>

        {trainings.map((training) => {
          const config = STATUS_CONFIG[training.status];
          const due = formatDueDate(training.dueDate);

          return (
            <View key={training.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitles}>
                  <Text style={styles.trainingTitle} numberOfLines={2}>
                    {training.title}
                  </Text>
                  <Text style={styles.moduleName}>{training.moduleName}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: config.color }]}>
                  <Text style={styles.statusLabel}>{config.label}</Text>
                </View>
              </View>

              {due ? (
                <Text style={[styles.dueDate, due.isPast && styles.dueDateOverdue]}>
                  {due.isPast ? 'Venceu em ' : 'Vence em '}{due.label}
                </Text>
              ) : null}

              {training.lastSignedAt ? (
                <Text style={styles.lastSigned}>
                  Assinado em {new Date(training.lastSignedAt).toLocaleDateString('pt-BR')}
                </Text>
              ) : null}

              {training.status !== 'signed' ? (
                <TouchableOpacity
                  style={[styles.signButton, loading && styles.signButtonDisabled]}
                  onPress={() => handleOpenSignature(training)}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel={`Assinar treinamento ${training.title}`}
                >
                  {loading && selectedTraining?.id === training.id ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.signButtonText}>Assinar</Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}

        <View style={styles.bottomPad} />
      </View>

      <SignatureModal
        isVisible={signatureModalVisible}
        onSign={handleSign}
        onCancel={() => {
          setSignatureModalVisible(false);
          setSelectedTraining(null);
        }}
        loading={loading}
        context={selectedTraining?.title}
      />
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
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subtitle: {
    color: '#888',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#141417',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#222',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitles: {
    flex: 1,
    marginRight: 10,
  },
  trainingTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 3,
    lineHeight: 18,
  },
  moduleName: {
    color: '#6366f1',
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  dueDate: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  dueDateOverdue: {
    color: '#ef4444',
    fontWeight: '600',
  },
  lastSigned: {
    color: '#555',
    fontSize: 11,
    marginBottom: 4,
  },
  signButton: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  signButtonDisabled: {
    opacity: 0.5,
  },
  signButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  bottomPad: {
    height: 24,
  },
});
