import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

interface SignatureModalProps {
  isVisible: boolean;
  onSign: (pin: string) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  /** Context label shown to user (e.g., "Treinamento POP-0042") */
  context?: string;
}

const MIN_PIN_LENGTH = 4;
const MAX_PIN_LENGTH = 6;

/**
 * SignatureModal — PIN-based electronic signature modal.
 *
 * STRIDE T-03.2-05: PIN + timestamp + user identity → audit log via callable.
 * PIN is never stored locally; transmitted via TLS inside callable payload.
 *
 * Future: biometric auth (Phase 3.3, see plan 03.3-01).
 */
export function SignatureModal({
  isVisible,
  onSign,
  onCancel,
  loading,
  context,
}: SignatureModalProps): React.JSX.Element {
  const [pin, setPin] = useState('');

  const isReady = pin.length >= MIN_PIN_LENGTH && pin.length <= MAX_PIN_LENGTH;

  const handleSign = async () => {
    if (!isReady || loading) return;

    try {
      await onSign(pin);
      setPin(''); // Clear PIN after use
    } catch {
      // Error handled by caller — don't clear PIN so user can retry
    }
  };

  const handleCancel = () => {
    setPin('');
    onCancel();
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />

            <Text style={styles.title}>Assinatura Eletrônica</Text>

            {context ? (
              <Text style={styles.context}>{context}</Text>
            ) : null}

            <Text style={styles.hint}>
              Digite seu PIN ({MIN_PIN_LENGTH}–{MAX_PIN_LENGTH} dígitos)
            </Text>

            <View style={styles.pinRow}>
              {Array.from({ length: MAX_PIN_LENGTH }, (_, i) => (
                <View
                  key={i}
                  style={[styles.pinDot, i < pin.length && styles.pinDotFilled]}
                />
              ))}
            </View>

            <TextInput
              style={styles.hiddenInput}
              value={pin}
              onChangeText={(text) => setPin(text.replace(/\D/g, '').slice(0, MAX_PIN_LENGTH))}
              keyboardType="numeric"
              secureTextEntry
              maxLength={MAX_PIN_LENGTH}
              editable={!loading}
              autoFocus
              accessible={false}
              importantForAccessibility="no"
            />

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleCancel}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Cancelar assinatura"
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.button,
                  styles.signButton,
                  (!isReady || loading) && styles.buttonDisabled,
                ]}
                onPress={handleSign}
                disabled={!isReady || loading}
                accessibilityRole="button"
                accessibilityLabel="Confirmar assinatura"
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.signText}>Assinar</Text>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.securityNote}>
              PIN nunca é armazenado localmente. Transmitido via TLS.
            </Text>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  keyboardView: {
    width: '100%',
  },
  sheet: {
    backgroundColor: '#141417',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 32,
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  context: {
    fontSize: 12,
    color: '#6366f1',
    marginBottom: 16,
  },
  hint: {
    fontSize: 13,
    color: '#888',
    marginBottom: 24,
  },
  pinRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#555',
  },
  pinDotFilled: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
  button: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#2a2a2e',
  },
  signButton: {
    backgroundColor: '#10b981',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  cancelText: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '600',
  },
  signText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  securityNote: {
    fontSize: 10,
    color: '#444',
    marginTop: 16,
    textAlign: 'center',
  },
});
