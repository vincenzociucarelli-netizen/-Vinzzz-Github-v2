import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '../../src/components/Icon';
import api from '../../src/services/api';

interface RosterAthlete {
  id: string;
  full_name: string;
  status: string;
  is_trial: boolean;
  trial_sessions_count: number;
}

export default function AdminTeamAttendance() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const teamId = typeof params.team_id === 'string' ? params.team_id : '';
  const teamName = typeof params.team_name === 'string' ? params.team_name : '';

  const [athletes, setAthletes] = useState<RosterAthlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [repairing, setRepairing] = useState(false);

  const handleRepairTrials = async () => {
    setRepairing(true);
    try {
      const res = await api.post(`/admin/teams/${teamId}/recompute-trials`);
      showAlert('Prove ricalcolate', `${res.data?.count ?? 0} atleti aggiornati dalle presenze registrate.`);
      const r = await api.get('/admin/team-roster', { params: { team_id: teamId } });
      setAthletes((r.data?.athletes || []).filter((a: any) => a.status !== 'withdrawn'));
    } catch (e: any) {
      showAlert('Errore', e?.response?.data?.detail || 'Ricalcolo non riuscito.');
    } finally {
      setRepairing(false);
    }
  };

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n${msg}`);
    else Alert.alert(title, msg);
  };

  useEffect(() => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    setDate(`${dd}/${mm}/${today.getFullYear()}`);
    if (!teamId) { setLoading(false); return; }
    setLoading(true);
    api.get('/admin/team-roster', { params: { team_id: teamId } })
      .then(res => {
        const list = (res.data?.athletes || []).filter((a: any) => a.status !== 'withdrawn');
        setAthletes(list);
      })
      .catch(() => setAthletes([]))
      .finally(() => setLoading(false));
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
      // ricarica per aggiornare i contatori prova
      const r = await api.get('/admin/team-roster', { params: { team_id: teamId } });
      setAthletes((r.data?.athletes || []).filter((a: any) => a.status !== 'withdrawn'));
    } catch (e: any) {
      showAlert('Errore', e?.response?.data?.detail || 'Registrazione non riuscita.');
    } finally {
      setSubmitting(false);
    }
  };

  const trialCount = useMemo(() => athletes.filter(a => a.is_trial).length, [athletes]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="ta-back">
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Registra Presenze</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{teamName || 'Squadra'}</Text>
        </View>
        <Ionicons name="checkbox-outline" size={24} color="#fff" />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        {/* Data e ora */}
        <View style={styles.section}>
          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Data allenamento *</Text>
              <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="GG/MM/AAAA" testID="ta-date" />
            </View>
            <View style={{ width: 110 }}>
              <Text style={styles.label}>Ora</Text>
              <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="18:30" testID="ta-time" />
            </View>
          </View>
          {trialCount > 0 && (
            <Text style={styles.trialHint}>
              🔵 {trialCount} atleti in prova: registrando la presenza aumenti gli allenamenti di prova (utile per far terminare il periodo).
            </Text>
          )}
          {trialCount > 0 && (
            <TouchableOpacity style={styles.repairBtn} onPress={handleRepairTrials} disabled={repairing} testID="ta-repair-trials">
              {repairing ? <ActivityIndicator color="#1565C0" /> : (
                <>
                  <Ionicons name="build-outline" size={16} color="#1565C0" />
                  <Text style={styles.repairBtnText}>Ripara prove in blocco (dalle presenze)</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Lista atleti */}
        <View style={styles.section}>
          <View style={styles.listHeader}>
            <Text style={styles.label}>Atleti ({selected.size}/{athletes.length} selezionati)</Text>
            {athletes.length > 0 && (
              <TouchableOpacity onPress={toggleAll} testID="ta-select-all">
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
                  testID={`ta-athlete-${a.id}`}
                >
                  <Ionicons
                    name={isSel ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={isSel ? '#5856D6' : '#B0B0B0'}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.athleteName}>{a.full_name}</Text>
                    {a.is_trial && (
                      <Text style={styles.trialBadge}>🔵 In prova · {a.trial_sessions_count || 0} allenamenti</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Bottone conferma */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmBtn, (submitting || selected.size === 0) && { opacity: 0.5 }]}
          onPress={submit}
          disabled={submitting || selected.size === 0}
          testID="ta-confirm"
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
  header: {
    backgroundColor: '#5856D6', flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 14,
  },
  backBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 1 },
  section: { paddingHorizontal: 16, paddingTop: 16 },
  dateRow: { flexDirection: 'row', gap: 12 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  input: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#D0D5DD', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#222' },
  trialHint: { fontSize: 12.5, color: '#1565C0', marginTop: 10, lineHeight: 18 },
  repairBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#90CAF9', backgroundColor: '#E3F2FD' },
  repairBtnText: { color: '#1565C0', fontWeight: '700', fontSize: 13 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  selectAll: { color: '#5856D6', fontWeight: '700', fontSize: 13 },
  emptyText: { color: '#888', fontStyle: 'italic', marginTop: 10 },
  athleteRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#ECEFF1',
  },
  athleteRowSel: { borderColor: '#5856D6', backgroundColor: '#F3F2FD' },
  athleteName: { fontSize: 15, fontWeight: '600', color: '#222' },
  trialBadge: { fontSize: 12, color: '#1565C0', marginTop: 2 },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#fff', padding: 14, borderTopWidth: 1, borderTopColor: '#ECEFF1',
  },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#5856D6', paddingVertical: 14, borderRadius: 12,
  },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
