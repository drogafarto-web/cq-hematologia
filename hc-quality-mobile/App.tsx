import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAuthPersistence } from './src/hooks/useAuthPersistence';

export default function App() {
  // Restore auth session on app startup
  useAuthPersistence();

  return (
    <SafeAreaView style={styles.container}>
      <RootNavigator />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
});
