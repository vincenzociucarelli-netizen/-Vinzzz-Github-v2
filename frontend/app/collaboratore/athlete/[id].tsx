import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '../../../src/components/Icon';
import api from '../../../src/services/api';

const showAlert = (title: string, msg: string) => {
  if (Platform.OS === 'web') { window.alert(`${title}\n${msg}`); }
  else { Alert.alert(title, msg); }
};

export default function CollaboratoreAthleteTechnical() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; name?: string }>();
  const athleteId = params.id as string;
  const athleteName = (params.name as string) || 'Atleta';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [role, setRole] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [libero, setLibero] = useState('');

  const load = useCallback(async () => {
    try {
      const [techRes, setRes] = await Promise.all([
        api.get(`/athletes/${athleteId}/technical-data`),
        api.get('/settings/society'),
      ]);
      const d = techRes.data || {};
      setRole(d.athlete_role || '');
      setJerseyNumber(d.jersey_number ? String(d.jersey_number) : '');
      setLibero(d.libero || '');
      setRoles(setRes.data?.athlete_roles || []);
    } catch {
      showAlert('Errore', 'Impossibile caricare i dati dell\'atleta');
    } finally {
      setLoading(false);
    }
  }, [athleteId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/athletes/${athleteId}/technical-data`, {
        athlete_role: role || '',
        jersey_number: jerseyNumber || '',
        libero: libero || '',
      });
      showAlert('Salvato', 'Dati tecnici aggiornati con successo.');
      router.back();
    } catch (e: any) {
      showAlert('Errore', e?.response?.data?.detail || 'Impossibile salvare i dati');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{athleteName}</Text>
          <Text style={styles.headerSubtitle}>Dati Tecnici</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}>
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="football-outline" size={18} color="#007AFF" />
              <Text style={styles.cardTitle}>Ruolo</Text>
            </View>
            {roles.length > 0 ? (
              <View style={styles.pickerContainer}>
                <Picker selectedValue={role} onValueChange={setRole} style={styles.picker}>
                  <Picker.Item label="Seleziona ruolo..." value="" />
                  {roles.map((r, i) => <Picker.Item key={i} label={r} value={r} />)}
                </Picker>
              </View>
            ) : (
              <Text style={styles.noSettings}>⚠️ Nessun ruolo definito dall'admin.</Text>
            )}

            <View style={styles.liberoRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>N° maglia</Text>
                <TextInput
                  style={styles.input}
                  value={jerseyNumber}
                  onChangeText={(t) => setJerseyNumber(t.replace(/\D/g, ''))}
                  placeholder="Es. 10"
                  placeholderTextColor="#aaa"
                  keyboardType="numeric"
                  maxLength={3}
                />
              </View>
              <View style={{ flex: 1.5 }}>
                <Text style={styles.inputLabel}>Libero</Text>
                <View style={styles.liberoChips}>
                  {['L', 'L1', 'L2'].map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.liberoChip, libero === opt && styles.liberoChipActive]}
                      onPress={() => setLibero(libero === opt ? '' : opt)}
                    >
                      <Text style={[styles.liberoChipText, libero === opt && styles.liberoChipTextActive]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            <Text style={styles.hint}>Seleziona L se l'atleta è libero. Con due liberi usa L1 (primo) e L2 (secondo). Il simbolo comparirà in convocazione.</Text>
          </View>

          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Salva dati tecnici</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#007AFF', paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#222' },
  pickerContainer: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden', backgroundColor: '#fafafa' },
  picker: { height: 50 },
  noSettings: { fontSize: 13, color: '#C62828', fontStyle: 'italic' },
  liberoRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: '#fafafa', color: '#222' },
  liberoChips: { flexDirection: 'row', gap: 8 },
  liberoChip: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#f5f5f5', alignItems: 'center' },
  liberoChipActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  liberoChipText: { fontSize: 15, fontWeight: '700', color: '#555' },
  liberoChipTextActive: { color: '#fff' },
  hint: { fontSize: 11, color: '#888', marginTop: 10, fontStyle: 'italic' },
  saveBtn: { backgroundColor: '#1E7E34', borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 18 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
