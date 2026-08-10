/**
 * 🆕 09/08/2026 — Sezione lato ADMIN per PROPORRE un cambio ruolo staff
 * (Coach ⇄ Dirigente ⇄ Collaboratore). L'admin propone, la persona deve
 * accettare dalla sua dashboard perché il cambio diventi effettivo.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert, ActivityIndicator } from 'react-native';
import api from '../services/api';
import { Ionicons } from './Icon';

interface Props {
  userId: string;
  currentRole: 'coach' | 'dirigente' | 'collaboratore';
  userName?: string;
  accentColor?: string;
}

const ALL_ROLES: Array<{ key: 'coach' | 'dirigente' | 'collaboratore'; label: string }> = [
  { key: 'coach', label: 'Coach' },
  { key: 'dirigente', label: 'Dirigente' },
  { key: 'collaboratore', label: 'Collaboratore' },
];

const ROLE_LABEL: Record<string, string> = {
  coach: 'Coach',
  dirigente: 'Dirigente',
  collaboratore: 'Collaboratore',
};

export const AdminRoleChange: React.FC<Props> = ({ userId, currentRole, userName, accentColor = '#6A1B9A' }) => {
  const [pending, setPending] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/staff/${userId}/role-change-request`);
      setPending(res.data?.request || null);
    } catch {
      setPending(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const showAlert = (t: string, m: string) => {
    if (Platform.OS === 'web') window.alert(`${t}\n\n${m}`);
    else Alert.alert(t, m);
  };

  const propose = async (toRole: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.post(`/admin/staff/${userId}/propose-role-change`, { to_role: toRole });
      setPicking(false);
      showAlert('Proposta inviata', `${userName || 'La persona'} dovrà accettare il cambio a ${ROLE_LABEL[toRole]} dalla propria dashboard.`);
      load();
    } catch (e: any) {
      showAlert('Errore', e?.response?.data?.detail || 'Operazione non riuscita');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (busy) return;
    const ok = Platform.OS === 'web' ? window.confirm('Annullare la proposta di cambio ruolo?') : true;
    if (!ok) return;
    setBusy(true);
    try {
      await api.delete(`/admin/staff/${userId}/role-change-request`);
      load();
    } catch (e: any) {
      showAlert('Errore', e?.response?.data?.detail || 'Operazione non riuscita');
    } finally {
      setBusy(false);
    }
  };

  const otherRoles = ALL_ROLES.filter((r) => r.key !== currentRole);

  return (
    <View style={[styles.card, { borderTopColor: accentColor }]} testID={`admin-role-change-${userId}`} data-testid={`admin-role-change-${userId}`}>
      <View style={styles.header}>
        <Ionicons name="swap-horizontal" size={18} color={accentColor} />
        <Text style={[styles.title, { color: accentColor }]}>Cambio ruolo</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={accentColor} style={{ marginVertical: 10 }} />
      ) : pending ? (
        <>
          <View style={styles.pendingBox}>
            <Ionicons name="time-outline" size={18} color="#E65100" />
            <Text style={styles.pendingText}>
              Proposta in attesa di accettazione:{' '}
              <Text style={{ fontWeight: '700' }}>{pending.from_role_label || ROLE_LABEL[pending.from_role]}</Text>
              {' → '}
              <Text style={{ fontWeight: '700' }}>{pending.to_role_label || ROLE_LABEL[pending.to_role]}</Text>
            </Text>
          </View>
          <TouchableOpacity style={styles.cancelBtn} onPress={cancel} disabled={busy} testID="admin-role-change-cancel" data-testid="admin-role-change-cancel">
            {busy ? <ActivityIndicator size="small" color="#C62828" /> : <Text style={styles.cancelText}>Annulla proposta</Text>}
          </TouchableOpacity>
        </>
      ) : picking ? (
        <>
          <Text style={styles.hint}>Scegli il nuovo ruolo da proporre a {userName || 'questa persona'}:</Text>
          {otherRoles.map((r) => (
            <TouchableOpacity
              key={r.key}
              style={[styles.roleBtn, { borderColor: accentColor }]}
              onPress={() => propose(r.key)}
              disabled={busy}
              testID={`admin-role-change-to-${r.key}`}
              data-testid={`admin-role-change-to-${r.key}`}
            >
              <Ionicons name="arrow-forward-circle-outline" size={18} color={accentColor} />
              <Text style={[styles.roleBtnText, { color: accentColor }]}>Proponi come {r.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.linkBtn} onPress={() => setPicking(false)} disabled={busy}>
            <Text style={styles.linkText}>Annulla</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.hint}>
            Ruolo attuale: <Text style={{ fontWeight: '700' }}>{ROLE_LABEL[currentRole]}</Text>. La persona dovrà
            accettare la proposta per rendere effettivo il cambio.
          </Text>
          <TouchableOpacity
            style={[styles.proposeBtn, { backgroundColor: accentColor }]}
            onPress={() => setPicking(true)}
            testID="admin-role-change-open"
            data-testid="admin-role-change-open"
          >
            <Ionicons name="swap-horizontal" size={18} color="#fff" />
            <Text style={styles.proposeText}>Proponi cambio ruolo</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 16,
    borderTopWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { fontSize: 15, fontWeight: 'bold' },
  hint: { fontSize: 13, color: '#555', lineHeight: 19, marginBottom: 12 },
  proposeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, paddingVertical: 11 },
  proposeText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  roleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderRadius: 10,
    paddingVertical: 11, paddingHorizontal: 12, marginBottom: 8,
  },
  roleBtnText: { fontWeight: '700', fontSize: 14 },
  linkBtn: { alignItems: 'center', paddingVertical: 6 },
  linkText: { color: '#888', fontSize: 13, fontWeight: '600' },
  pendingBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF3E0',
    borderRadius: 8, padding: 10, marginBottom: 10,
  },
  pendingText: { flex: 1, fontSize: 13, color: '#E65100', lineHeight: 18 },
  cancelBtn: { alignItems: 'center', borderWidth: 2, borderColor: '#C62828', borderRadius: 10, paddingVertical: 10 },
  cancelText: { color: '#C62828', fontWeight: '700', fontSize: 14 },
});

export default AdminRoleChange;
