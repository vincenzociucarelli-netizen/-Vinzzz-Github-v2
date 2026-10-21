/**
 * 🆕 Registra Presenze (manuale) — lato COACH
 * Visibile solo ai coach a cui l'admin ha attivato `can_manual_attendance`.
 * Seleziona più atleti + data/ora e registra la presenza in un click.
 * Riusa l'endpoint POST /api/admin/teams/{team_id}/bulk-attendance (abilitato al coach).
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '../../../../src/components/Icon';
import api from '../../../../src/services/api';

interface RosterAthlete {
  id: string;
  full_name: string;
  status?: string;
  is_trial?: boolean;
  trial_sessions_count?: number;
  trial_max_sessions?: number;
}

function showAlert(title: string, msg: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
}

export default function CoachManualAttendance() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const teamId = typeof params.id === 'string' ? params.id : '';

  const [teamName, setTeamName] = useState('');
  const [athletes, setAthletes] = useState<RosterAthlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onChangeDate = (txt: string) => {
    const d = txt.replace(/\D/g, '').slice(0, 8);
    let out = d.slice(0, 2);
    if (d.length >= 3) out += '/' + d.slice(2, 4);
    if (d.length >= 5) out += '/' + d.slice(4, 8);
    setDate(out);
  };
  const onChangeTime = (txt: string) => {
    const d = txt.replace(/\D/g, '').slice(0, 4);
    let out = d.slice(0, 2);
    if (d.length >= 3) out += ':' + d.slice(2, 4);
    setTime(out);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [teamsRes, athRes] = await Promise.all([
        api.get('/coach/my-teams'),
        api.get(`/coach/team/${teamId}/athletes`),
      ]);
      const t = (teamsRes.data || []).find((x: any) => x.id === teamId);
      setTeamName(t?.name || 'Squadra');
      setAthletes((athRes.data || []).filter((a: any) => a.status !== 'withdrawn'));
    } catch (e: any) {
      showAlert('Errore', e?.response?.data?.detail || 'Impossibile caricare la squadra.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Prefill data odierna
    const now = new Date();
    setDate(`${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const allSelected = athletes.length > 0 && selected.size === athletes.length;
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(athletes.map(a => a.id)));
  };

  const submit = async () => {
    if (selected.size === 0) { showAlert('Nessun atleta', 'Seleziona almeno un atleta.'); return; }
    const parts = (date || '').split('/');
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
      showAlert('Data non valida', 'Usa il formato GG/MM/AAAA.');
      return;
    }
    const isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    setSubmitting(true);
    try {
      const res = await api.post(`/admin/teams/${teamId}/bulk-attendance`, {
        athlete_ids: Array.from(selected),
        date: isoDate,
        time: time.trim() || null,
      });
      const reg = res.data?.registered_count ?? 0;
      const skip = res.data?.skipped_count ?? 0;
      let msg = `${reg} presenze registrate.`;
      if (skip > 0) {
        const skippedNames = (res.data?.skipped || [])
          .map((s: any) => `• ${s.athlete_name || s.athlete_id}: ${s.reason}`).join('\n');
        msg += `\n\n${skip} saltate:\n${skippedNames}`;
      }
      showAlert('Fatto', msg);
      setSelected(new Set());
      await load();
    } catch (e: any) {
      showAlert('Errore', e?.response?.data?.detail || 'Registrazione non riuscita.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="cma-back">
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Registra Presenze</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{teamName}</Text>
        </View>
        <Ionicons name="checkbox-outline" size={24} color="#fff" />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Data allenamento *</Text>
              <TextInput style={styles.input} value={date} onChangeText={onChangeDate} placeholder="GG/MM/AAAA" keyboardType="number-pad" maxLength={10} testID="cma-date" />
            </View>
            <View style={{ width: 110 }}>
              <Text style={styles.label}>Ora</Text>
              <TextInput style={styles.input} value={time} onChangeText={onChangeTime} placeholder="18:30" keyboardType="number-pad" maxLength={5} testID="cma-time" />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.listHeader}>
            <Text style={styles.label}>Atleti ({selected.size}/{athletes.length} selezionati)</Text>
            {athletes.length > 0 && (
              <TouchableOpacity onPress={toggleAll} testID="cma-select-all">
                <Text style={styles.selectAll}>{allSelected ? 'Deseleziona tutti' : 'Seleziona tutti'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <ActivityIndicator color="#5856D6" style={{ marginTop: 20 }} />
          ) : athletes.length === 0 ? (
            <Text style={styles.emptyText}>Nessun atleta in questa squadra.</Text>
          ) : (
            athletes.map(a => {
              const isSel = selected.has(a.id);
              return (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.athleteRow, isSel && styles.athleteRowSel]}
                  onPress={() => toggle(a.id)}
                  testID={`cma-athlete-${a.id}`}
                >
                  <Ionicons name={isSel ? 'checkbox' : 'square-outline'} size={24} color={isSel ? '#5856D6' : '#B0B0B0'} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.athleteName}>{a.full_name}</Text>
                    {a.is_trial && (
                      <Text style={styles.trialBadge}>
                        🔵 In prova · {a.trial_sessions_count || 0}/{a.trial_max_sessions || 3} allenamenti
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmBtn, (submitting || selected.size === 0) && { opacity: 0.5 }]}
          onPress={submit}
          disabled={submitting || selected.size === 0}
          testID="cma-confirm"
        >
          {submitting ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="checkmark-done" size={20} color="#fff" />
              <Text style={styles.confirmBtnText}>Registra presenze ({selected.size})</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F4F7' },
  header: { backgroundColor: '#5856D6', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 14 },
  backBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 1 },
  section: { paddingHorizontal: 16, paddingTop: 16 },
  dateRow: { flexDirection: 'row', gap: 12 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  input: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#D0D5DD', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#222' },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  selectAll: { color: '#5856D6', fontWeight: '700', fontSize: 13 },
  emptyText: { color: '#888', fontStyle: 'italic', marginTop: 10 },
  athleteRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#ECEFF1' },
  athleteRowSel: { borderColor: '#5856D6', backgroundColor: '#F3F2FD' },
  athleteName: { fontSize: 15, fontWeight: '600', color: '#222' },
  trialBadge: { fontSize: 12, color: '#1565C0', marginTop: 2 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', padding: 14, borderTopWidth: 1, borderTopColor: '#ECEFF1' },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#5856D6', paddingVertical: 14, borderRadius: 12 },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
