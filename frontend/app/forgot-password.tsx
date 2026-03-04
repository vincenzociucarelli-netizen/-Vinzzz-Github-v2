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
import { useRouter } from 'expo-router';
import api from '../src/services/api';

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  
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

  const handleRequestReset = async () => {
    if (!email) {
      showAlert('Errore', 'Inserisci la tua email');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showAlert('Errore', 'Inserisci un indirizzo email valido');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.toLowerCase() });
      setEmailSent(true);
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante la richiesta');
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
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
            <Text style={styles.successIcon}>📧</Text>
            <Text style={styles.successTitle}>Email Inviata!</Text>
            <Text style={styles.successText}>
              Se l'email <Text style={styles.emailHighlight}>{email}</Text> è registrata,
              riceverai un codice per reimpostare la password.
            </Text>
            <Text style={styles.checkText}>
              Controlla anche la cartella SPAM.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push({ pathname: '/reset-password', params: { email } })}
          >
            <Text style={styles.buttonText}>Ho ricevuto il codice</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleRequestReset}
            disabled={loading}
          >
            <Text style={styles.linkText}>
              {loading ? 'Invio in corso...' : 'Invia di nuovo'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.back()}
          >
            <Text style={styles.linkText}>← Torna al login</Text>
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
        <Text style={styles.title}>Password Dimenticata?</Text>
        <Text style={styles.subtitle}>
          Inserisci la tua email e ti invieremo un codice per reimpostare la password
        </Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRequestReset}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Invia Codice Reset</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.back()}
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
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
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
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  form: {
    width: '100%',
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
  emailHighlight: {
    fontWeight: 'bold',
    color: '#007AFF',
  },
  checkText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
