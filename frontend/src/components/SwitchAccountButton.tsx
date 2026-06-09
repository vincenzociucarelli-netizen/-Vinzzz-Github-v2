import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Ionicons } from './Icon';

interface LinkedAccount {
  user_id: string;
  role: string;
  email: string;
  label: string;
}

/**
 * 🆕 FASE 2B — Switch dual-role
 * Mostra un bottone "Passa a Modalità X" se l'utente loggato ha
 * un account collegato (atleta↔coach). Al click genera un nuovo
 * JWT lato server e reindirizza al dashboard del nuovo ruolo.
 */
export default function SwitchAccountButton() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [linked, setLinked] = useState<LinkedAccount | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let mounted = true;
    api.get('/auth/linked-accounts')
      .then((res) => {
        if (!mounted) return;
        const first = res.data?.linked_accounts?.[0];
        if (first) setLinked(first);
      })
      .catch(() => {/* non-blocking */});
    return () => { mounted = false; };
  }, []);

  if (!linked) return null;

  const handleSwitch = async () => {
    setSwitching(true);
    try {
      const res = await api.post('/auth/switch-account', { target_user_id: linked.user_id });
      const newToken = res.data?.token;
      const newRole = res.data?.role;
      if (!newToken) throw new Error('Token mancante');
      // 🐛 FIX: l'interceptor di `api` sovrascrive sempre l'header Authorization
      // con il token in AsyncStorage. Quindi DEVO salvare il nuovo token PRIMA
      // di chiamare /auth/me — altrimenti otterrei i dati del ruolo precedente
      // e il _layout.tsx del nuovo ruolo mi sbatterebbe fuori al login.
      await AsyncStorage.setItem('token', newToken);
      const meRes = await api.get('/auth/me');
      await setUser(meRes.data, newToken);
      // Redirect al dashboard del nuovo ruolo
      const target = newRole === 'coach' ? '/coach'
        : newRole === 'athlete' ? '/athlete'
        : newRole === 'dirigente' ? '/dirigente'
        : '/';
      router.replace(target);
    } catch (e: any) {
      Alert.alert('Errore switch', e?.response?.data?.detail || 'Cambio account fallito');
    } finally {
      setSwitching(false);
    }
  };

  // Colori in base al ruolo target
  const palette = linked.role === 'coach'
    ? { bg: '#E3F2FD', border: '#1976D2', text: '#1976D2', icon: 'school' as const }
    : { bg: '#FFF3E0', border: '#E65100', text: '#E65100', icon: 'person' as const };

  return (
    <TouchableOpacity
      data-testid="switch-account-btn"
      onPress={handleSwitch}
      disabled={switching}
      style={{
        marginHorizontal: 16, marginTop: 8, padding: 12,
        backgroundColor: palette.bg, borderRadius: 10,
        flexDirection: 'row', alignItems: 'center',
        borderWidth: 1, borderColor: palette.border,
        opacity: switching ? 0.6 : 1,
      }}
    >
      <View style={{
        width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff',
        justifyContent: 'center', alignItems: 'center',
      }}>
        <Ionicons name={palette.icon} size={20} color={palette.border} />
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text }}>
          {switching ? 'Cambio in corso...' : `Passa a ${linked.label}`}
        </Text>
        <Text style={{ fontSize: 11, color: '#666' }}>{linked.email}</Text>
      </View>
      <Ionicons name="arrow-forward-circle" size={24} color={palette.border} />
    </TouchableOpacity>
  );
}
