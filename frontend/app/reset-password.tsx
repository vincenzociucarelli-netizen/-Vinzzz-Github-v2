import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../src/services/api';

export default function ResetPassword() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [email, setEmail] = useState((params.email as string) || '');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Society branding
  const [societyName, setSocietyName] = useState('GESTIONE SOCIETÀ');
  const [societyLogo, setSocietyLogo] = useState<string | null>(null);

  useEffect(() => {
    loadSocietySettings();
  }, []);

  const loadSocietySettings = async () => {
    try {
      const response = await api.get('/settings/society');
      if (response.data.name) {
        setSocietyName(response.data.name);
      }
      if (response.data.logo) {
        setSocietyLogo(response.data.logo);
      }
    } catch (error) {
      // Use default name if settings not found
    }
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleResetPassword = async () => {
    // Validations
    if (!email) {
      showAlert('Errore', 'Inserisci la tua email');
      return;
    }

    if (!resetCode || resetCode.length < 8) {
      showAlert('Errore', 'Inserisci il codice di reset (8 caratteri)');
      return;
    }

    if (!newPassword) {
      showAlert('Errore', 'Inserisci la nuova password');
      return;
    }

    if (newPassword.length < 6) {
      showAlert('Errore', 'La password deve avere almeno 6 caratteri');
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert('Errore', 'Le password non coincidono');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email: email.toLowerCase(),
        reset_code: resetCode.toUpperCase(),
        new_password: newPassword,
      });
      setSuccess(true);
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      const status = error.response?.status;
      let msg = 'Errore di connessione al server. Riprova.';
      if (detail) {
        msg = typeof detail === 'string' ? detail : JSON.stringify(detail);
      } else if (status) {
        msg = `Errore dal server (${status}). Riprova.`;
      }
      showAlert('Errore', msg);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {societyLogo && (
            <View style={styles.logoContainer}>
              <Image
                source={{ uri: `data:image/jpeg;base64,${societyLogo}` }}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          )}
          
          <View style={styles.successContainer}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successTitle}>Password Aggiornata!</Text>
            <Text style={styles.successText}>
              La tua password è stata reimpostata con successo.
              Ora puoi accedere con la nuova password.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.buttonText}>Vai al Login</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {societyLogo && (
          <View style={styles.logoContainer}>
            <Image
              source={{ uri: `data:image/jpeg;base64,${societyLogo}` }}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        )}
        <Text style={styles.title}>Reimposta Password</Text>
        <Text style={styles.subtitle}>
          Inserisci il codice ricevuto via email e la nuova password
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="La tua email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <Text style={styles.label}>Codice di Reset</Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            placeholder="XXXXXXXX"
            placeholderTextColor="#999"
            value={resetCode}
            onChangeText={(text) => setResetCode(text.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            editable={!loading}
          />

          <Text style={styles.label}>Nuova Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Minimo 6 caratteri"
              placeholderTextColor="#999"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              editable={!loading}
              data-testid="reset-new-password"
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
              data-testid="toggle-new-password"
            >
              <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Conferma Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Ripeti la password"
              placeholderTextColor="#999"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              editable={!loading}
              data-testid="reset-confirm-password"
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              data-testid="toggle-confirm-password"
            >
              <Text style={styles.eyeIcon}>{showConfirmPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleResetPassword}
            disabled={loading}
            data-testid="reset-submit-btn"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Reimposta Password</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.push('/forgot-password')}
          >
            <Text style={styles.linkText}>Non hai ricevuto il codice?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.linkText}>← Torna al login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    width: 120,
    height: 120,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 16,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  eyeIcon: {
    fontSize: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    color: '#007AFF',
    fontSize: 14,
  },
  // Success state styles
  successContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  successIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#28a745',
    marginBottom: 16,
  },
  successText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 22,
  },
});
