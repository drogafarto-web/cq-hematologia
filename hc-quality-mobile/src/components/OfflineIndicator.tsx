import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetInfo } from '../hooks/useNetInfo';
import { getQueue } from '../services/offlineQueueService';

/**
 * Displays a banner when the device is offline or when there are
 * pending actions in the AsyncStorage offline queue.
 *
 * Shows nothing when online AND queue is empty (zero-footprint for happy path).
 */
export function OfflineIndicator(): React.JSX.Element | null {
  const { isOnline } = useNetInfo();
  const [queueLength, setQueueLength] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const q = await getQueue();
      if (!cancelled) setQueueLength(q.length);
    };

    refresh();

    // Poll every 3 s to pick up changes from sync hook
    const interval = setInterval(refresh, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isOnline]);

  // Happy path: online + nothing queued → render nothing
  if (isOnline && queueLength === 0) return null;

  const message = isOnline
    ? `${queueLength} ${queueLength === 1 ? 'ação pendente' : 'ações pendentes'} — sincronizando...`
    : 'Sem conexão — ações salvas localmente';

  return (
    <View
      style={[styles.container, isOnline ? styles.syncing : styles.offline]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={message}
    >
      <Text style={[styles.text, isOnline ? styles.textSyncing : styles.textOffline]}>
        {isOnline ? '⟳ ' : '⚠ '}{message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  offline: {
    backgroundColor: '#7f1d1d',
    borderBottomColor: '#991b1b',
  },
  syncing: {
    backgroundColor: '#78350f',
    borderBottomColor: '#92400e',
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  textOffline: {
    color: '#fca5a5',
  },
  textSyncing: {
    color: '#fef3c7',
  },
});
