import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  Animated,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useNetInfo } from '../hooks/useNetInfo';
import { getQueue } from '../services/offlineQueueService';

/**
 * SyncStatusBanner — Animated 3-state offline/sync indicator
 *
 * State machine:
 * ┌─────────────────────────────────────────────────┐
 * │  isOnline=true  + queue=0 → 'hidden'            │
 * │  isOnline=true  + queue>0 → 'syncing'           │
 * │  isOnline=false + queue≥0 → 'offline'           │
 * └─────────────────────────────────────────────────┘
 *
 * Animation:
 * - Enter: translateY from -BANNER_HEIGHT to 0 (150ms ease-out)
 * - Exit: translateY from 0 to -BANNER_HEIGHT (150ms ease-in)
 * - Auto-dismiss 1.5s after queue reaches 0 (UX grace delay)
 *
 * Accessibility:
 * - accessibilityLiveRegion="polite" so screen readers announce state changes
 * - testID="sync-status-banner" for Detox targeting
 */

type BannerState = 'hidden' | 'syncing' | 'offline';

const BANNER_HEIGHT = 44;
const POLL_INTERVAL_MS = 3000;
const DISMISS_GRACE_MS = 1500;
const ANIMATION_DURATION_MS = 150;

export function SyncStatusBanner(): React.JSX.Element | null {
  const { isOnline } = useNetInfo();
  const [queueLength, setQueueLength] = useState(0);
  const [bannerState, setBannerState] = useState<BannerState>('hidden');
  const [isVisible, setIsVisible] = useState(false);

  const translateY = useRef(new Animated.Value(-BANNER_HEIGHT)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Queue polling ─────────────────────────────────────────────────────────
  const refreshQueue = useCallback(async () => {
    try {
      const q = await getQueue();
      setQueueLength(q.length);
    } catch {
      // fail silently — banner is informational only
    }
  }, []);

  useEffect(() => {
    refreshQueue();
    const interval = setInterval(refreshQueue, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshQueue, isOnline]);

  // ── State machine transition ───────────────────────────────────────────────
  useEffect(() => {
    if (!isOnline) {
      setBannerState('offline');
    } else if (queueLength > 0) {
      setBannerState('syncing');
    } else {
      // Queue just cleared — delay dismissal for UX smoothness
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      dismissTimer.current = setTimeout(() => {
        setBannerState('hidden');
      }, DISMISS_GRACE_MS);
      return () => {
        if (dismissTimer.current) clearTimeout(dismissTimer.current);
      };
    }
  }, [isOnline, queueLength]);

  // ── Animation trigger ─────────────────────────────────────────────────────
  useEffect(() => {
    if (bannerState !== 'hidden') {
      // Show banner
      setIsVisible(true);
      Animated.timing(translateY, {
        toValue: 0,
        duration: ANIMATION_DURATION_MS,
        useNativeDriver: true,
      }).start();
    } else {
      // Hide banner
      Animated.timing(translateY, {
        toValue: -BANNER_HEIGHT,
        duration: ANIMATION_DURATION_MS,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setIsVisible(false);
      });
    }
  }, [bannerState, translateY]);

  // Don't render at all when fully hidden and animation complete
  if (!isVisible && bannerState === 'hidden') return null;

  const isSyncing = bannerState === 'syncing';
  const isOffline = bannerState === 'offline';

  const message = isOffline
    ? `Sem conexão${queueLength > 0 ? ` — ${queueLength} ${queueLength === 1 ? 'ação pendente' : 'ações pendentes'}` : ''}`
    : `Sincronizando ${queueLength} ${queueLength === 1 ? 'ação' : 'ações'}...`;

  const containerStyle = [
    styles.container,
    isOffline ? styles.offline : styles.syncing,
    { transform: [{ translateY }] },
  ];

  return (
    <Animated.View
      style={containerStyle}
      testID="sync-status-banner"
      accessibilityLiveRegion="polite"
      accessibilityLabel={message}
    >
      <View style={styles.inner}>
        {isSyncing ? (
          <ActivityIndicator
            size="small"
            color="#fef3c7"
            style={styles.spinner}
            accessible={false}
          />
        ) : (
          <Text style={styles.icon}>⚠</Text>
        )}
        <Text
          style={[styles.text, isOffline ? styles.textOffline : styles.textSyncing]}
          numberOfLines={1}
        >
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    height: BANNER_HEIGHT,
    justifyContent: 'center',
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
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  spinner: {
    marginRight: 8,
  },
  icon: {
    fontSize: 13,
    marginRight: 6,
    color: '#fca5a5',
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    flexShrink: 1,
  },
  textOffline: {
    color: '#fca5a5',
  },
  textSyncing: {
    color: '#fef3c7',
  },
});
