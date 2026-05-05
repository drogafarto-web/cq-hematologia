import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useCIQRuns } from '../hooks/useCIQRuns';
import { CIQCard } from '../components/CIQCard';
import { OfflineIndicator } from '../components/OfflineIndicator';

interface CIQScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

/**
 * CIQScreen — Lists CIQ runs for the authenticated lab.
 *
 * Data flow: useCIQRuns → Firestore onSnapshot → run list
 * Navigation: tap CIQCard → CIQDetail stack screen
 */
export function CIQScreen({ navigation }: CIQScreenProps): React.JSX.Element {
  const { runs, loading, error } = useCIQRuns();
  const [refreshing, setRefreshing] = useState(false);

  /**
   * onSnapshot provides real-time updates; pull-to-refresh is a UX affordance
   * to signal "data is fresh" — the listener already keeps data current.
   */
  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  const handleRunPress = (runId: string) => {
    navigation.navigate('CIQDetail', { runId });
  };

  if (error && runs.length === 0) {
    return (
      <View style={styles.container}>
        <OfflineIndicator />
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Erro ao carregar corridas</Text>
          <Text style={styles.errorDetail}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <OfflineIndicator />
      <ScrollView
        style={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#6366f1"
            colors={['#6366f1']}
          />
        }
      >
        <View style={styles.content}>
          <Text style={styles.title}>Corridas CIQ</Text>

          {loading && runs.length === 0 ? (
            <ActivityIndicator
              color="#6366f1"
              size="large"
              style={styles.loader}
              testID="activity-indicator"
            />
          ) : null}

          {!loading && runs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Nenhuma corrida encontrada</Text>
              <Text style={styles.emptySubtitle}>
                Corridas registradas aparecerão aqui em tempo real
              </Text>
            </View>
          ) : null}

          {runs.map((run) => (
            <CIQCard key={run.id} run={run} onPress={handleRunPress} />
          ))}

          {/* Bottom spacing */}
          <View style={styles.bottomPad} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  loader: {
    marginTop: 40,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorDetail: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 48,
  },
  emptyTitle: {
    color: '#888',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#555',
    fontSize: 12,
    textAlign: 'center',
  },
  bottomPad: {
    height: 24,
  },
});
