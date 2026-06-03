import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback } from 'react';

/**
 * useBiometricAuth — Face ID / Fingerprint / Biometrics wrapper
 *
 * Security model (STRIDE T-03.3-01):
 * - Biometric is a convenience 2nd factor, NOT the primary auth gate
 * - Firebase session token is still required for all server operations
 * - `allowDeviceCredentials: false` — PIN/password fallback handled at app level
 * - Biometric preference stored in AsyncStorage (user-controlled)
 *
 * Platform behavior:
 * - iOS:  Face ID → BiometryTypes.FaceID, Touch ID → BiometryTypes.TouchID
 * - Android: Fingerprint/face/iris → BiometryTypes.Biometrics
 */

const rnBiometrics = new ReactNativeBiometrics({ allowDeviceCredentials: false });
const BIOMETRIC_PREF_KEY = '@hcquality/biometricEnabled';

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  /** How the auth was resolved */
  method: 'biometric' | 'pin' | 'none';
}

export interface BiometricAuthState {
  /** True if device hardware supports biometrics */
  isBiometricAvailable: boolean;
  /** True if user has enabled biometric for HC Quality login */
  isBiometricEnabled: boolean;
  /** Biometry type from OS: 'FaceID' | 'TouchID' | 'Biometrics' | null */
  biometryType: string | null;
  /** Whether sensor availability check is still loading */
  isLoading: boolean;
}

export interface BiometricAuthActions {
  /**
   * Prompt the OS biometric dialog.
   * Returns success=false with method='none' if unavailable/disabled.
   * Returns success=false with method='pin' if user cancels (fall back to PIN form).
   */
  promptBiometric: (promptMessage?: string) => Promise<BiometricAuthResult>;
  /** Enable biometric preference (stores 'true' in AsyncStorage) */
  enableBiometric: () => Promise<void>;
  /** Disable biometric preference (stores 'false' in AsyncStorage) */
  disableBiometric: () => Promise<void>;
  /** Human-readable label for the biometry type (e.g. "Face ID", "Impressão digital") */
  biometricLabel: string;
}

export function useBiometricAuth(): BiometricAuthState & BiometricAuthActions {
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [biometryType, setBiometryType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      try {
        const [sensorResult, prefValue] = await Promise.all([
          rnBiometrics.isSensorAvailable(),
          AsyncStorage.getItem(BIOMETRIC_PREF_KEY),
        ]);

        if (cancelled) return;

        setIsBiometricAvailable(sensorResult.available);
        setBiometryType(sensorResult.biometryType ?? null);
        setIsBiometricEnabled(prefValue === 'true');
      } catch (err) {
        console.warn('[useBiometricAuth] init error:', err);
        // Fail safe: biometrics not available
        if (!cancelled) {
          setIsBiometricAvailable(false);
          setIsBiometricEnabled(false);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  const promptBiometric = useCallback(
    async (promptMessage = 'Autentique-se para continuar'): Promise<BiometricAuthResult> => {
      if (!isBiometricAvailable || !isBiometricEnabled) {
        return { success: false, method: 'none' };
      }

      try {
        const { success } = await rnBiometrics.simplePrompt({ promptMessage });

        if (success) {
          return { success: true, method: 'biometric' };
        }

        // OS returned success=false (user dismissed without cancel button)
        return { success: false, method: 'pin' };
      } catch (err: any) {
        // User explicitly cancelled (error code 10 on Android, -128 on iOS)
        // or hardware error — fall back to PIN form
        console.log('[useBiometricAuth] promptBiometric fallback:', err?.message);
        return {
          success: false,
          error: err?.message,
          method: 'pin',
        };
      }
    },
    [isBiometricAvailable, isBiometricEnabled],
  );

  const enableBiometric = useCallback(async () => {
    try {
      await AsyncStorage.setItem(BIOMETRIC_PREF_KEY, 'true');
      setIsBiometricEnabled(true);
    } catch (err) {
      console.error('[useBiometricAuth] enableBiometric failed:', err);
    }
  }, []);

  const disableBiometric = useCallback(async () => {
    try {
      await AsyncStorage.setItem(BIOMETRIC_PREF_KEY, 'false');
      setIsBiometricEnabled(false);
    } catch (err) {
      console.error('[useBiometricAuth] disableBiometric failed:', err);
    }
  }, []);

  /** Returns a locale-appropriate label for the biometry method */
  const biometricLabel: string = (() => {
    switch (biometryType) {
      case BiometryTypes.FaceID:
        return 'Face ID';
      case BiometryTypes.TouchID:
        return 'Touch ID';
      case BiometryTypes.Biometrics:
        return 'Impressão digital';
      default:
        return 'Biometria';
    }
  })();

  return {
    isBiometricAvailable,
    isBiometricEnabled,
    biometryType,
    isLoading,
    promptBiometric,
    enableBiometric,
    disableBiometric,
    biometricLabel,
  };
}
