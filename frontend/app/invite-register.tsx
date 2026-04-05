import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../src/services/api';

/**
 * invite-register.tsx
 * Thin redirect page: loads invite token info, extracts the society invite code,
 * then redirects to the unified register.tsx with ?code=XXX&invite_token=TOKEN
 */
export default function InviteRegister() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) {
      loadAndRedirect();
    } else {
      setError('Token di invito mancante');
    }
  }, [token]);

  const loadAndRedirect = async () => {
    try {
      const res = await api.get(`/athletes/invite-info/${token}`);
      const inviteCode = res.data.invite_code || '';
      if (inviteCode) {
        router.replace(`/register?code=${inviteCode}&invite_token=${token}`);
      } else {
        setError('Codice società non trovato nell\'invito. Contatta l\'amministratore.');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invito non valido o scaduto');
    }
  };

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>Errore</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.link} onPress={() => router.replace('/login')}>
          Torna al Login
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.loadingText}>Caricamento invito...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#C62828',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  link: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '600',
  },
});
