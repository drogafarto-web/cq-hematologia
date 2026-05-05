import React from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useOpenNCs } from '../hooks/useOpenNCs';
import { NCCard } from '../components/NCCard';
import { OfflineIndicator } from '../components/OfflineIndicator';

interface NCScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

/**
 * NCScreen — Lists active (open/investigating) non-conformities for the lab.
 *
 * Data: useOpenNCs → Firestore onSnapshot → filtered by status + soft delete
 * Navigation: tap NCCard → NCDetail screen
 */
export function NCScreen({ navigation }: NCScreenProps): React.JSX.Element {
  const { ncs, loading, error } = useOpenNCs();

  const handleNCPress = (ncId: string) => {
    navigation.navigate('NCDetail', { ncId });
  };

  return (
    <View style={styles.container}>
      <OfflineIndicator />
      <ScrollView style={styles.scroll}>
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Não-Conformidades</Text>
            {ncs.length > 0 ? (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{ncs.length}</Text>
              </View>
            ) : null}
          </View>

          {loading ? (
            <ActivityIndicator
              color="#6366f1"
              size="large"
              style={styles.loader}
            />
          ) : null}

          {error && !loading ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Erro ao carregar NCs</Text>
              <Text style={styles.errorDetail}>{error}</Text>
            </View>
          ) : null}

          {!loading && !error && ncs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>✓</Text>
              <Text style={styles.emptyTitle}>Nenhuma NC aberta</Text>
              <Text style={styles.emptySubtitle}>
                Todas as não-conformidades foram resolvidas
              </Text>
            </View>
          ) : null}

          {ncs.map((nc) => (
            <NCCard key={nc.id} nc={nc} onPress={handleNCPress} />
          ))}

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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    letterSpacing: -0.3,
  },
  countBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  loader: {
    marginTop: 40,
  },
  errorContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  errorDetail: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
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
  bottomPad: {
    height: 24,
  },
});
