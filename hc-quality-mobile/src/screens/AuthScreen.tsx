import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../core/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { useBiometricAuth } from '../hooks/useBiometricAuth';

/**
 * AuthScreen — Login and session management
 *
 * Biometric flow (STRIDE T-03.3-01):
 * 1. First login: email/password → Firebase Auth → offer "Habilitar biometria?"
 * 2. Subsequent launches: auto-prompt biometric before showing password form
 * 3. If biometric fails/cancelled: show password form (fallback)
 *
 * testIDs used by Detox E2E (e2e/flows/auth.e2e.ts):
 * - auth-screen, email-input, password-input, login-button
 * - biometric-button, logout-button
 */
export function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);

  const user = useAuthStore((s) => s.user);

  const {
    isBiometricAvailable,
    isBiometricEnabled,
    isLoading: biometricLoading,
    promptBiometric,
    enableBiometric,
    biometricLabel,
  } = useBiometricAuth();

  /**
   * On mount: if biometric is enabled and available, auto-prompt.
   * This fires on every cold launch — user sees biometric dialog immediately.
   */
  useEffect(() => {
    if (biometricLoading || user) return;

    if (isBiometricAvailable && isBiometricEnabled) {
      setShowBiometricPrompt(true);
      handleBiometricLogin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometricLoading, isBiometricAvailable, isBiometricEnabled]);

  const handleBiometricLogin = async () => {
    const result = await promptBiometric('Entrar no HC Quality');

    if (result.success) {
      // Biometric verified — Firebase session already persisted via useAuthPersistence
      // Nothing more to do; auth state update flows through onAuthStateChanged
      console.log('[Auth] Biometric login successful');
    } else {
      // Cancelled or failed — show password form
      setShowBiometricPrompt(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Email e senha obrigatórios');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log('[Auth] Logged in:', result.user.email);

      // Offer biometric enrollment after successful first login
      if (isBiometricAvailable && !isBiometricEnabled) {
        // Small delay to let the login screen settle
        setTimeout(() => {
          Alert.alert(
            `Habilitar ${biometricLabel}?`,
            `Use ${biometricLabel} para entrar mais rapidamente nas próximas vezes.`,
            [
              {
                text: 'Habilitar',
                onPress: enableBiometric,
              },
              {
                text: 'Agora não',
                style: 'cancel',
              },
            ],
          );
        }, 500);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'Erro ao sair');
    }
  };

  // Logged-in state
  if (user) {
    return (
      <View style={styles.container} testID="auth-screen-logged-in">
        <Text style={styles.title}>Bem-vindo</Text>
        <Text style={styles.email}>{user.email}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
          testID="logout-button"
        >
          <Text style={styles.buttonText}>Sair</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Biometric prompt loading state
  if (showBiometricPrompt && biometricLoading) {
    return (
      <View style={styles.container} testID="auth-screen">
        <ActivityIndicator
          color="#6366f1"
          size="large"
          accessible
          accessibilityLabel="Verificando biometria"
        />
      </View>
    );
  }

  // Login form
  return (
    <View style={styles.container} testID="auth-screen">
      <Text style={styles.title}>HC Quality Mobile</Text>

      {/* Biometric quick-login button — shown if enabled */}
      {isBiometricAvailable && isBiometricEnabled && !showBiometricPrompt ? (
        <TouchableOpacity
          style={[styles.biometricButton]}
          onPress={handleBiometricLogin}
          accessibilityRole="button"
          accessibilityLabel={`Entrar com ${biometricLabel}`}
          accessibilityHint="Abre o diálogo de autenticação biométrica"
          testID="biometric-button"
        >
          <Text style={styles.biometricButtonText}>Entrar com {biometricLabel}</Text>
        </TouchableOpacity>
      ) : null}

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#666"
        value={email}
        onChangeText={setEmail}
        editable={!loading}
        autoCapitalize="none"
        keyboardType="email-address"
        accessibilityLabel="Campo de email"
        accessibilityHint="Digite seu email para entrar"
        testID="email-input"
      />
      <TextInput
        style={styles.input}
        placeholder="Senha"
        placeholderTextColor="#666"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        editable={!loading}
        accessibilityLabel="Campo de senha"
        accessibilityHint="Digite sua senha para entrar"
        testID="password-input"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Entrar na conta"
        accessibilityHint="Duplo toque para autenticar com email e senha"
        testID="login-button"
      >
        {loading ? (
          <ActivityIndicator color="#fff" accessible accessibilityLabel="Autenticando" />
        ) : (
          <Text style={styles.buttonText}>Entrar</Text>
        )}
      </TouchableOpacity>
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
    marginBottom: 30,
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  email: {
    fontSize: 14,
    // Upgraded from #aaa (3.7:1) to #b3b3b3 (4.5:1) — WCAG AA
    color: '#b3b3b3',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    color: '#fff',
    backgroundColor: '#141417',
    fontSize: 14,
  },
  error: {
    color: '#ef4444',
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  biometricButton: {
    backgroundColor: '#141417',
    borderWidth: 1,
    borderColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  biometricButtonText: {
    color: '#6366f1',
    fontSize: 15,
    fontWeight: '500',
  },
});
