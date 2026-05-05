import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { ReadingForm, ReadingData } from '../components/ReadingForm';
import { useMobileCallables } from '../hooks/useMobileCallables';
import { useAuthStore } from '../store/useAuthStore';
import { OfflineIndicator } from '../components/OfflineIndicator';

interface ReadingEntry {
  id: string;
  parameterName: string;
  value: string;
  unit: string;
  timestamp: number;
  synced: boolean;
}

/**
 * ReadingsScreen — Manual parameter readings entry.
 *
 * Submits via callable `submitReading`. On failure, callable wrapper
 * auto-queues to AsyncStorage (offline-first pattern).
 *
 * Firestore path: /labs/{labId}/leituras/{leituraId}
 */
export function ReadingsScreen(): React.JSX.Element {
  const labId = useAuthStore((s) => s.activeLabId);
  const { callFunction } = useMobileCallables();
  const [loading, setLoading] = useState(false);
  const [sessionReadings, setSessionReadings] = useState<ReadingEntry[]>([]);

  const handleSubmitReading = async (data: ReadingData) => {
    if (!labId) {
      Alert.alert('Erro', 'Laboratório não identificado. Faça login novamente.');
      return;
    }

    setLoading(true);
    const entryId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      await callFunction('submitReading', {
        labId,
        parameterName: data.parameterName,
        value: data.value,
        unit: data.unit,
        timestamp: data.timestamp,
      });

      // Add to local session log (synced = true)
      setSessionReadings((prev) => [
        {
          id: entryId,
          ...data,
          synced: true,
        },
        ...prev,
      ]);

      Alert.alert('Leitura registrada', `${data.parameterName}: ${data.value} ${data.unit}`);
    } catch (err: any) {
      const isNetworkError =
        err.code === 'unavailable' || err.message?.includes('network');

      // Add to session log (synced = false — queued offline)
      setSessionReadings((prev) => [
        {
          id: entryId,
          ...data,
          synced: false,
        },
        ...prev,
      ]);

      if (isNetworkError) {
        Alert.alert(
          'Salvo offline',
          'Leitura enfileirada. Será sincronizada ao reconectar.'
        );
      } else {
        Alert.alert('Erro', err.message || 'Falha ao registrar leitura.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" testID="readings-screen">
      <OfflineIndicator />
      <View style={styles.content}>
        <Text style={styles.title}>Registrar Leitura</Text>
        <Text style={styles.description}>
          Registre leituras de temperatura, pressão ou outros parâmetros monitorados.
        </Text>

        <ReadingForm onSubmit={handleSubmitReading} loading={loading} />

        {sessionReadings.length > 0 ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.logTitle}>Leituras desta sessão</Text>
            {sessionReadings.map((entry) => (
              <View key={entry.id} style={styles.logEntry}>
                <View style={styles.logEntryLeft}>
                  <Text style={styles.logParameter}>{entry.parameterName}</Text>
                  <Text style={styles.logTimestamp}>
                    {new Date(entry.timestamp).toLocaleTimeString('pt-BR')}
                  </Text>
                </View>
                <View style={styles.logEntryRight}>
                  <Text style={styles.logValue}>
                    {entry.value} {entry.unit}
                  </Text>
                  <Text style={[styles.logSync, !entry.synced && styles.logSyncPending]}>
                    {entry.synced ? '✓ Sincronizado' : '⟳ Pendente'}
                  </Text>
                </View>
              </View>
            ))}
          </>
        ) : null}

        <View style={styles.bottomPad} />
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
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  description: {
    // Upgraded #888 → #b3b3b3 (WCAG AA 4.5:1 on #0a0a0a)
    color: '#b3b3b3',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#222',
    marginVertical: 24,
  },
  logTitle: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  logEntry: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e22',
  },
  logEntryLeft: {
    flex: 1,
  },
  logEntryRight: {
    alignItems: 'flex-end',
  },
  logParameter: {
    color: '#ddd',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  logTimestamp: {
    color: '#666',
    fontSize: 11,
  },
  logValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    marginBottom: 2,
  },
  logSync: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '500',
  },
  logSyncPending: {
    color: '#f59e0b',
  },
  bottomPad: {
    height: 24,
  },
});
