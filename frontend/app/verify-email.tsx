import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '../src/components/Icon';
import api from '../src/services/api';

export default function VerifyEmail() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [societyName, setSocietyName] = useState('');
  const [alreadyVerified, setAlreadyVerified] = useState(false);

  useEffect(() => {
    if (token) {
      verifyEmail();
    } else {
      setError('Token di verifica mancante');
      setLoading(false);
    }
  }, [token]);

  const verifyEmail = async () => {
    try {
      const res = await api.get(`/auth/verify-email/${token}`);
      if (res.data.already_verified) {
        setAlreadyVerified(true);
      }
      setVerified(true);
      setSocietyName(res.data.society_name || '');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Token di verifica non valido o scaduto');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#1565C0" />
        <Text style={styles.loadingText}>Verifica in corso...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={[styles.iconCircle, { backgroundColor: '#FFEBEE' }]}>
            <Ionicons name="close-circle" size={48} color="#f44336" />
          </View>
          <Text style={styles.title}>Verifica fallita</Text>
          <Text style={styles.message}>{error}</Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#1565C0' }]}
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.buttonText}>Vai al Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={[styles.iconCircle, { backgroundColor: '#E8F5E9' }]}>
          <Ionicons name="checkmark-circle" size={48} color="#4CAF50" />
        </View>
        <Text style={styles.title}>
          {alreadyVerified ? 'Email già verificata' : 'Email verificata!'}
        </Text>
        <Text style={styles.message}>
          {alreadyVerified
            ? 'Il tuo account è già stato attivato in precedenza.'
            : `Il tuo account è stato attivato con successo${societyName ? ` per ${societyName}` : ''}. Hai 7 giorni di prova gratuita.`
          }
        </Text>
        <Text style={styles.submessage}>
          Ora puoi accedere con le credenziali scelte durante la registrazione.
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#4CAF50' }]}
          onPress={() => router.replace('/login')}
          data-testid="go-to-login-btn"
        >
          <Ionicons name="log-in" size={20} color="#fff" />
          <Text style={styles.buttonText}>Accedi</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  submessage: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 15,
  },
});
