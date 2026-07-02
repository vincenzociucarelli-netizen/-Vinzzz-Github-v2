/**
 * 🆕 02/07/2026 — Pulsante "Passa a Coach/Atleta" per utenti dual-role.
 * Chiama /api/auth/switch-role, aggiorna JWT nello store e reindirizza.
 */
import React, { useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from './api';
import { useAuthStore } from '../store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Props {
  targetRole: 'coach' | 'athlete';
  visible: boolean;
}

export const RoleSwitchButton: React.FC<Props> = ({ targetRole, visible }) => {
  const setUser = useAuthStore((s) => s.setUser);
  const [busy, setBusy] = useState(false);
  if (!visible) return null;

  const label = targetRole === 'coach' ? '🏋️ Passa a Coach' : '🏐 Passa ad Atleta';
  const bg = targetRole === 'coach' ? '#FFF3E0' : '#E3F2FD';
  const border = targetRole === 'coach' ? '#F57C00' : '#1565C0';
  const color = targetRole === 'coach' ? '#E65100' : '#0D47A1';

  const handlePress = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.post('/auth/switch-role', { target_role: targetRole });
      const token = res.data?.token || res.data?.access_token;
      const user = res.data?.user;
      if (!token || !user) throw new Error('Risposta switch non valida');
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      await setUser(user, token);
      const dest = targetRole === 'coach' ? '/coach' : '/athlete';
      if (Platform.OS === 'web') {
        window.location.href = dest;
      } else {
        // Import lazy per non rompere web SSR
        const { router } = require('expo-router');
        router.replace(dest);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Impossibile cambiare ruolo';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Errore', msg);
      setBusy(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={busy}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: bg, borderColor: border, borderWidth: 1,
        borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
        opacity: busy ? 0.6 : 1,
      }}
      data-testid={`role-switch-${targetRole}`}
    >
      {busy ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Ionicons name="swap-horizontal" size={14} color={color} />
      )}
      <Text style={{ fontSize: 12, fontWeight: '700', color }}>{label}</Text>
    </TouchableOpacity>
  );
};

export default RoleSwitchButton;
