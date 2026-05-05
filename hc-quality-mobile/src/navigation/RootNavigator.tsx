import React from 'react';
import { ActivityIndicator, View, StyleSheet, Text, TouchableOpacity } from 'react-native';

import { useAuthStore } from '../store/useAuthStore';
import { useOfflineSync } from '../hooks/useOfflineSync';

// Screens
import { AuthScreen } from '../screens/AuthScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { CIQScreen } from '../screens/CIQScreen';
import { CIQDetailScreen } from '../screens/CIQDetailScreen';
import { NCScreen } from '../screens/NCScreen';
import { NCDetailScreen } from '../screens/NCDetailScreen';
import { ReadingsScreen } from '../screens/ReadingsScreen';
import { TrainingScreen } from '../screens/TrainingScreen';
import { OfflineQueueScreen } from '../screens/OfflineQueueScreen';

/**
 * NavigationContainer, createNativeStackNavigator, createBottomTabNavigator
 * are imported from @react-navigation/* which is a native dependency.
 * These will be installed when the RN environment is set up.
 *
 * This implementation provides a fully functional inline navigation manager
 * that works without @react-navigation installed (test/preview environment),
 * while exposing the same interface as the real navigator would.
 *
 * When @react-navigation is installed, replace this file with the
 * @react-navigation version defined in the architecture design doc.
 */

type ScreenName =
  | 'Auth'
  | 'Home'
  | 'CIQ'
  | 'CIQDetail'
  | 'NC'
  | 'NCDetail'
  | 'Readings'
  | 'Training'
  | 'OfflineQueue';

interface NavParams {
  runId?: string;
  ncId?: string;
  equipmentId?: string;
  description?: string;
  trainingId?: string;
}

interface NavigationState {
  screen: ScreenName;
  params?: NavParams;
}

interface NavProp {
  navigate: (screen: string, params?: NavParams) => void;
  goBack: () => void;
}

interface RouteProp {
  params: NavParams;
}

/** Tab definitions for bottom nav */
const AUTHENTICATED_TABS: { name: ScreenName; label: string }[] = [
  { name: 'Home', label: 'Dashboard' },
  { name: 'CIQ', label: 'CIQ' },
  { name: 'NC', label: 'NCs' },
  { name: 'Readings', label: 'Leituras' },
  { name: 'Training', label: 'Treinamento' },
];

const TAB_SCREENS: ScreenName[] = ['Home', 'CIQ', 'NC', 'Readings', 'Training'];

/**
 * RootNavigator — App-level navigation router.
 *
 * Architecture:
 * - Unauthenticated: AuthScreen only
 * - Authenticated: Bottom tab navigator with stack screens
 *   - Home tab
 *   - CIQ tab → CIQ list → CIQ detail (stack)
 *   - NC tab → NC list → NC detail (stack)
 *   - Readings tab
 *   - Training tab
 *   - OfflineQueue (accessible via header button)
 *
 * Offline sync is activated here (app root) via useOfflineSync.
 */
export function RootNavigator(): React.JSX.Element {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);

  // Activate offline sync at app root — processes queue on reconnect
  const { isOnline } = useOfflineSync();

  const [navStack, setNavStack] = React.useState<NavigationState[]>([
    { screen: 'Home' },
  ]);

  const currentState = navStack[navStack.length - 1];

  const navigation: NavProp = {
    navigate: (screen: string, params?: NavParams) => {
      setNavStack((prev) => [...prev, { screen: screen as ScreenName, params }]);
    },
    goBack: () => {
      setNavStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
    },
  };

  const route: RouteProp = {
    params: currentState.params ?? {},
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  // Render the current screen
  const renderScreen = () => {
    switch (currentState.screen) {
      case 'Home':
        return <HomeScreen />;
      case 'CIQ':
        return <CIQScreen navigation={navigation} />;
      case 'CIQDetail':
        return (
          <CIQDetailScreen
            route={{ params: { runId: currentState.params?.runId ?? '', equipmentId: currentState.params?.equipmentId } }}
            navigation={navigation}
          />
        );
      case 'NC':
        return <NCScreen navigation={navigation} />;
      case 'NCDetail':
        return (
          <NCDetailScreen
            route={{ params: { ncId: currentState.params?.ncId ?? '', description: currentState.params?.description } }}
            navigation={navigation}
          />
        );
      case 'Readings':
        return <ReadingsScreen />;
      case 'Training':
        return <TrainingScreen route={route} />;
      case 'OfflineQueue':
        return <OfflineQueueScreen navigation={navigation} />;
      default:
        return <HomeScreen />;
    }
  };

  const isTabScreen = TAB_SCREENS.includes(currentState.screen);
  const activeTab = isTabScreen ? currentState.screen : 'Home';

  const navigateToTab = (screen: ScreenName) => {
    // Reset stack to just the tab screen
    setNavStack([{ screen }]);
  };

  return (
    <View style={styles.root}>
      {/* Header bar for non-tab (stack) screens */}
      {!isTabScreen ? (
        <View style={styles.header}>
          <TouchableOpacity onPress={navigation.goBack} style={styles.backButton}>
            <Text style={styles.backText}>← Voltar</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>
              {currentState.screen === 'CIQDetail' ? 'Detalhes da Corrida' : ''}
              {currentState.screen === 'NCDetail' ? 'Atualizar NC' : ''}
              {currentState.screen === 'OfflineQueue' ? 'Fila Offline' : ''}
            </Text>
          </View>
          <View style={styles.headerRight} />
        </View>
      ) : (
        /* Tab header */
        <View style={styles.header}>
          <Text style={styles.headerTitle}>HC Quality</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('OfflineQueue')}
            style={styles.queueButton}
          >
            <Text style={[styles.queueText, !isOnline && styles.queueTextOffline]}>
              {isOnline ? 'Fila' : '⚠ Offline'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Screen content */}
      <View style={styles.screenContainer}>{renderScreen()}</View>

      {/* Bottom tab bar (only for tab-level screens) */}
      {isTabScreen ? (
        <View style={styles.tabBar}>
          {AUTHENTICATED_TABS.map((tab) => {
            const isActive = activeTab === tab.name;
            return (
              <TouchableOpacity
                key={tab.name}
                style={styles.tabItem}
                onPress={() => navigateToTab(tab.name)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={tab.label}
              >
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#141417',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerRight: {
    width: 60,
  },
  backButton: {
    width: 60,
  },
  backText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '500',
  },
  queueButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  queueText: {
    color: '#6366f1',
    fontSize: 12,
    fontWeight: '600',
  },
  queueTextOffline: {
    color: '#f59e0b',
  },
  screenContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#141417',
    borderTopWidth: 1,
    borderTopColor: '#222',
    paddingBottom: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  tabLabel: {
    color: '#555',
    fontSize: 11,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#6366f1',
    fontWeight: '700',
  },
});
