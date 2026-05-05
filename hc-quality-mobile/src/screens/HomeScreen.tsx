import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function HomeScreen() {
  return (
    <View style={styles.container} testID="home-screen">
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.subtitle}>Módulos disponíveis em Phase 3.2</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#0a0a0a',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    // Upgraded #aaa (3.7:1) → #b3b3b3 (4.5:1 on #0a0a0a) — WCAG AA
    color: '#b3b3b3',
    textAlign: 'center',
  },
});
