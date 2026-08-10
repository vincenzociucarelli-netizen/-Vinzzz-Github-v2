/**
 * 🆕 09/08/2026 — Banner lato PERSONA per accettare/rifiutare una proposta di
 * cambio ruolo (Coach ⇄ Dirigente ⇄ Collaboratore) inviata dall'admin.
 * Il ruolo cambia SOLO se la persona accetta. All'accettazione l'utente viene
 * reindirizzato alla dashboard del nuovo ruolo.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import api from '../services/api';
import { Ionicons } from './Icon';
import { useAuthStore } from '../store/authStore';

const ROUTE_FOR_ROLE: Record<string, string> = {
  coach: '/coach',
  dirigente: '/dirigente',
  collaboratore: '/collaboratore',
};

export const RoleChangePrompt: React.FC = () => {
  const router = useRouter();
  const { refreshUser } = useAuthStore();
  const [req, setReq] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/role-change/pending');
      setReq(res.data?.request || null);
    } catch {
      /* ignore */
    }
  };
  useEffect(() => { load(); }, []);

  const showAlert = (t: string, m: string) => {
    if (Platform.OS === 'web') window.alert(`${t}\n\n${m}`);
    else Alert.alert(t, m);
  };

  const accept = async () => {
    if (busy || !req) return;
    setBusy(true);
    try {
      const res = await api.post(`/role-change/${req.id}/accept`);
      const newRole = res.data?.new_role;
      await refreshUser();
      showAlert('Ruolo aggiornato', `Ora il tuo ruolo è: ${res.data?.new_role_label || newRole}.`);
      const target = ROUTE_FOR_ROLE[newRole] || '/';
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
        window.location.replace(target);
      } else {
        router.replace(target as any);
      }
    } catch (e: any) {
      showAlert('Errore', e?.response?.data?.detail || 'Operazione non riuscita');
      setBusy(false);
    }
  };

  const reject = async () => {
    if (busy || !req) return;
    const ok = Platform.OS === 'web' ? window.confirm('Vuoi rifiutare la proposta di cambio ruolo?') : true;
    if (!ok) return;
    setBusy(true);
    try {
      await api.post(`/role-change/${req.id}/reject`);
      setReq(null);
    } catch (e: any) {
      showAlert('Errore', e?.response?.data?.detail || 'Operazione non riuscita');
    } finally {
      setBusy(false);
    }
  };

  if (!req) return null;

  const willUnlinkTeams = req.to_role !== 'coach';

  return (
    <View style={s.banner} testID="role-change-prompt" data-testid="role-change-prompt">
      <View style={s.headerRow}>
        <Ionicons name="swap-horizontal" size={20} color="#6A1B9A" />
        <Text style={s.title}>Proposta di cambio ruolo</Text>
      </View>
      <Text style={s.text}>
        L'amministratore propone di cambiare il tuo ruolo da{' '}
        <Text style={s.bold}>{req.from_role_label}</Text> a <Text style={s.bold}>{req.to_role_label}</Text>.
        {willUnlinkTeams ? ' Le eventuali squadre a te assegnate verranno scollegate.' : ''}
      </Text>
      <View style={s.btnRow}>
        <TouchableOpacity style={[s.btn, s.accept]} onPress={accept} disabled={busy} testID="role-change-accept" data-testid="role-change-accept">
          {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnText}>Accetta</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.reject]} onPress={reject} disabled={busy} testID="role-change-reject" data-testid="role-change-reject">
          <Text style={[s.btnText, { color: '#C62828' }]}>Rifiuta</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  banner: {
    backgroundColor: '#F3E5F5',
    borderWidth: 1,
    borderColor: '#9C27B0',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { fontSize: 15, fontWeight: '700', color: '#6A1B9A' },
  text: { fontSize: 13, color: '#4A148C', lineHeight: 19 },
  bold: { fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  accept: { backgroundColor: '#6A1B9A' },
  reject: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#C62828' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

export default RoleChangePrompt;
