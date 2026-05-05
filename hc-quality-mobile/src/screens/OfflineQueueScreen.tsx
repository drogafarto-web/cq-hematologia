import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useOfflineQueue } from '../hooks/useOfflineQueue';
import { useNetInfo } from '../hooks/useNetInfo';
import { MAX_RETRY_LIMIT } from '../services/offlineQueueService';

interface OfflineQueueScreenProps {
  navigation?: {
    goBack?: () => void;
  };
}

const ACTION_LABEL: Record<string, string> = {
  submitCIQComment: 'Comentário CIQ',
  updateNCStatus: 'Atualização NC',
  submitReading: 'Leitura manual',
  submitTrainingSignature: 'Assinatura de treinamento',
};

/**
 * OfflineQueueScreen — Shows all queued offline actions.
 *
 * Useful for operators to understand what is pending sync.
 * Actions at MAX_RETRIES are flagged as requiring manual review.
 */
export function OfflineQueueScreen({ navigation }: OfflineQueueScreenProps): React.JSX.Element {
  const { queue, queueLength, refresh } = useOfflineQueue();
  const { isOnline } = useNetInfo();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Fila Offline</Text>
        <View style={styles.statusRow}>
          <View style={[styles.dot, isOnline ? styles.dotOnline : styles.dotOffline]} />
          <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
        </View>
      </View>

      {queueLength === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>✓</Text>
          <Text style={styles.emptyTitle}>Fila vazia</Text>
          <Text style={styles.emptySubtitle}>Todas as ações foram sincronizadas com sucesso.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll}>
          <View style={styles.content}>
            <Text style={styles.queueCount}>
              {queueLength} {queueLength === 1 ? 'ação pendente' : 'ações pendentes'}
            </Text>
            {queue.map((item) => {
              const isMaxRetry = item.retryCount >= MAX_RETRY_LIMIT;
              return (
                <View
                  key={item.id}
                  style={[styles.card, isMaxRetry && styles.cardError]}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.actionLabel}>
                      {ACTION_LABEL[item.action] ?? item.action}
                    </Text>
                    {isMaxRetry ? (
                      <View style={styles.errorBadge}>
                        <Text style={styles.errorBadgeText}>Falhou</Text>
                      </View>
                    ) : (
                      <Text style={styles.retryCount}>
                        {item.retryCount}/{MAX_RETRY_LIMIT}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.timestamp}>
                    Enfileirado: {new Date(item.timestamp).toLocaleString('pt-BR')}
                  </Text>
                  <Text style={styles.labId}>Lab: {item.labId}</Text>
                  {item.lastError ? (
                    <Text style={styles.lastError}>
                      Último erro: {item.lastError}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      <TouchableOpacity style={styles.refreshButton} onPress={refresh}>
        <Text style={styles.refreshText}>Atualizar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e22',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOnline: {
    backgroundColor: '#10b981',
  },
  dotOffline: {
    backgroundColor: '#ef4444',
  },
  statusText: {
    color: '#888',
    fontSize: 12,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  queueCount: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#141417',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#222',
  },
  cardError: {
    borderColor: '#7f1d1d',
    backgroundColor: '#150a0a',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  retryCount: {
    color: '#888',
    fontSize: 11,
  },
  errorBadge: {
    backgroundColor: '#7f1d1d',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  errorBadgeText: {
    color: '#fca5a5',
    fontSize: 10,
    fontWeight: '600',
  },
  timestamp: {
    color: '#555',
    fontSize: 11,
    marginBottom: 2,
  },
  labId: {
    color: '#555',
    fontSize: 11,
  },
  lastError: {
    color: '#ef4444',
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    fontSize: 40,
    color: '#10b981',
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#555',
    fontSize: 12,
    textAlign: 'center',
  },
  refreshButton: {
    margin: 16,
    backgroundColor: '#1c1c20',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  refreshText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
  },
});
