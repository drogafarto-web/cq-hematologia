import React from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { useOfflineSync } from '../hooks/useOfflineSync';

export function OfflineBanner() {
  const { isOnline, pendingCount, inProgress, syncNow } = useOfflineSync();

  if (isOnline && pendingCount === 0) return null;

  const bgColor = !isOnline ? '#92400e' : inProgress ? '#1e40af' : '#065f46';
  const message = !isOnline
    ? `Modo Offline — ${pendingCount} item(ns) pendente(s)`
    : inProgress
    ? 'Sincronizando...'
    : `✓ ${pendingCount} item(ns) para sincronizar`;

  return (
    <TouchableOpacity
      onPress={isOnline && !inProgress ? syncNow : undefined}
      activeOpacity={isOnline ? 0.7 : 1}
      style={{
        backgroundColor: bgColor,
        paddingVertical: 8,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityLabel={message}
      accessibilityRole="alert"
    >
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
        {message}
      </Text>
      {isOnline && !inProgress && pendingCount > 0 && (
        <Text style={{ color: '#fff', fontSize: 11, marginLeft: 8, opacity: 0.7 }}>
          Toque para sincronizar
        </Text>
      )}
    </TouchableOpacity>
  );
}
