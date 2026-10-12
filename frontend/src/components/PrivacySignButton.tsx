/**
 * 🆕 PrivacySignButton — pulsante PRIVACY sempre visibile nelle dashboard di
 * Coach / Dirigente / Collaboratore (come quello dei genitori).
 *
 * - Privacy NON firmata → arancione "FIRMA LA PRIVACY": porta al profilo con
 *   `?sign_privacy=1`; il profilo apre subito la firma GDPR (o la modifica dati
 *   se mancano campi obbligatori).
 * - Privacy firmata → viola "PRIVACY · Firmata il …": porta al profilo per
 *   gestire i consensi (immagine, ecc.).
 *
 * Stato letto da /auth/me (privacy_accepted, privacy_accepted_at|date).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

interface Props {
  profileRoute: string; // es. '/coach/profile'
}

const fmt = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(String(iso).match(/[zZ]|[+-]\d{2}:?\d{2}$/) ? String(iso) : `${iso}Z`);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Rome' });
};

export default function PrivacySignButton({ profileRoute }: Props) {
  const router = useRouter();
  const [state, setState] = useState<{ loaded: boolean; accepted: boolean; date?: string | null }>({ loaded: false, accepted: false });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/auth/me');
        if (!alive) return;
        const u = res.data || {};
        setState({
          loaded: true,
          accepted: !!u.privacy_accepted,
          date: u.privacy_accepted_at || u.privacy_accepted_date || null,
        });
      } catch {
        if (alive) setState((s) => ({ ...s, loaded: true }));
      }
    })();
    return () => { alive = false; };
  }, []);

  if (!state.loaded) return null;
  const signed = state.accepted;

  return (
    <TouchableOpacity
      style={[styles.btn, signed ? styles.btnSigned : styles.btnUnsigned]}
      onPress={() => router.push(`${profileRoute}?sign_privacy=1` as any)}
      activeOpacity={0.85}
      testID="privacy-sign-button"
    >
      <Ionicons name={signed ? 'shield-checkmark' : 'shield-outline'} size={24} color="#fff" />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{signed ? 'PRIVACY' : 'FIRMA LA PRIVACY'}</Text>
        <Text style={styles.sub}>
          {signed
            ? `Firmata${state.date ? ` il ${fmt(state.date)}` : ''} · tocca per gestire i consensi`
            : 'Necessaria per attivare e modificare i consensi'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#fff" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16,
    marginHorizontal: 16, marginBottom: 12, minHeight: 56,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 4,
  },
  btnSigned: { backgroundColor: '#5E35B1', shadowColor: '#5E35B1' },
  btnUnsigned: { backgroundColor: '#E65100', shadowColor: '#E65100' },
  title: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  sub: { fontSize: 12, color: '#FFFFFFDD', marginTop: 1 },
});
