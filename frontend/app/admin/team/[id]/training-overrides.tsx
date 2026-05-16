/**
 * Gestione override allenamenti per una squadra — visibile ad Admin e Coach.
 * Mostra i prossimi 7 giorni in cui ci sarebbe normalmente un allenamento
 * (basato su `training_sessions` del team) e permette di:
 *  - Annullare l'allenamento per un giorno specifico (con motivo)
 *  - Modificare orario/luogo per un giorno specifico (con motivo)
 *  - Ripristinare (cancellare un override esistente)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, TextInput, ActivityIndicator, StyleSheet, Platform, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import api from '../../../../src/services/api';

const DAY_NAME = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

interface Team {
  id: string;
  name: string;
  training_sessions: Array<{ day: string; timeStart: string; timeEnd: string; venue: string }>;
}

interface Override {
  id: string;
  team_id: string;
  date: string; // YYYY-MM-DD
  status: 'cancelled' | 'modified';
  new_start_time?: string;
  new_end_time?: string;
  new_venue?: string;
  reason?: string;
}

interface UpcomingTraining {
  date: string; // YYYY-MM-DD
  prettyDate: string; // 18/05 (Lun)
  dayName: string;
  timeStart: string;
  timeEnd: string;
  venue: string;
  override?: Override;
}

export default function TrainingOverridesPage() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const teamId = String(params.id);
  const [team, setTeam] = useState<Team | null>(null);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingDate, setSavingDate] = useState<string | null>(null);

  // Modal state for edit/modify
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editVenue, setEditVenue] = useState('');
  const [editReason, setEditReason] = useState('');

  // Modal for cancel
  const [cancelDate, setCancelDate] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const teamRes = await api.get(`/teams/${teamId}`);
      setTeam(teamRes.data);
      const ovRes = await api.get(`/teams/${teamId}/training-overrides`);
      setOverrides(ovRes.data || []);
    } catch (e: any) {
      Alert.alert('Errore', e.response?.data?.detail || 'Impossibile caricare la squadra');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [teamId]);

  // Compute upcoming 7 days that have a training session for this team
  const upcoming: UpcomingTraining[] = useMemo(() => {
    if (!team || !team.training_sessions) return [];
    const dayToSession: Record<string, { timeStart: string; timeEnd: string; venue: string }> = {};
    team.training_sessions.forEach((s: any) => {
      dayToSession[s.day] = { timeStart: s.timeStart || '', timeEnd: s.timeEnd || '', venue: s.venue || '' };
    });
    const ovByDate: Record<string, Override> = {};
    overrides.forEach(o => { ovByDate[o.date] = o; });

    const out: UpcomingTraining[] = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const dayName = DAY_NAME[d.getDay()];
      const session = dayToSession[dayName];
      if (!session) continue;
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateISO = `${yyyy}-${mm}-${dd}`;
      out.push({
        date: dateISO,
        prettyDate: `${dd}/${mm} (${dayName.slice(0, 3)})`,
        dayName,
        timeStart: session.timeStart,
        timeEnd: session.timeEnd,
        venue: session.venue,
        override: ovByDate[dateISO],
      });
    }
    return out;
  }, [team, overrides]);

  const handleSaveCancel = async () => {
    if (!cancelDate) return;
    setSavingDate(cancelDate);
    try {
      await api.post(`/teams/${teamId}/training-overrides`, {
        date: cancelDate,
        status: 'cancelled',
        reason: cancelReason || null,
      });
      setCancelDate(null);
      setCancelReason('');
      await loadData();
    } catch (e: any) {
      Alert.alert('Errore', e.response?.data?.detail || 'Errore di salvataggio');
    } finally {
      setSavingDate(null);
    }
  };

  const handleSaveModify = async () => {
    if (!editingDate) return;
    setSavingDate(editingDate);
    try {
      await api.post(`/teams/${teamId}/training-overrides`, {
        date: editingDate,
        status: 'modified',
        new_start_time: editStart || null,
        new_end_time: editEnd || null,
        new_venue: editVenue || null,
        reason: editReason || null,
      });
      setEditingDate(null);
      await loadData();
    } catch (e: any) {
      Alert.alert('Errore', e.response?.data?.detail || 'Errore di salvataggio');
    } finally {
      setSavingDate(null);
    }
  };

  const handleRestore = async (ov: Override) => {
    const ok = Platform.OS === 'web' ? window.confirm('Ripristinare l\'allenamento normale per questa data?') : true;
    if (!ok) return;
    setSavingDate(ov.date);
    try {
      await api.delete(`/training-overrides/${ov.id}`);
      await loadData();
    } catch (e: any) {
      Alert.alert('Errore', e.response?.data?.detail || 'Errore');
    } finally {
      setSavingDate(null);
    }
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#007AFF" /></View>;
  }
  if (!team) {
    return <View style={s.center}><Text>Squadra non trovata</Text></View>;
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.push('/admin')} data-testid="btn-back">
          <Text style={s.headerBack}>‹ Indietro</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={2}>Allenamenti — {team.name}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
        <Text style={s.intro}>
          Annulla o modifica un allenamento per un giorno specifico. La variazione viene mostrata
          subito a genitori, atleti e coach. Gli allenamenti il giorno di una gara sono annullati
          automaticamente.
        </Text>
        {upcoming.length === 0 && (
          <Text style={s.muted}>Nessun allenamento previsto nei prossimi 7 giorni.</Text>
        )}
        {upcoming.map(u => (
          <View key={u.date} style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowDate}>{u.prettyDate}</Text>
              {u.override?.status === 'cancelled' ? (
                <Text style={s.statusCancelled}>❌ Annullato{u.override.reason ? ` — ${u.override.reason}` : ''}</Text>
              ) : u.override?.status === 'modified' ? (
                <>
                  <Text style={s.statusModified}>
                    ✏️ Variato — {u.override.new_start_time || u.timeStart} → {u.override.new_end_time || u.timeEnd}
                    {(u.override.new_venue || u.venue) ? ` @ ${u.override.new_venue || u.venue}` : ''}
                  </Text>
                  {u.override.reason && <Text style={s.muted}>Motivo: {u.override.reason}</Text>}
                </>
              ) : (
                <Text style={s.statusNormal}>
                  {u.timeStart} → {u.timeEnd}{u.venue ? ` @ ${u.venue}` : ''}
                </Text>
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {u.override ? (
                <TouchableOpacity onPress={() => handleRestore(u.override!)} style={[s.btn, s.btnRestore]} disabled={savingDate === u.date}>
                  <Text style={s.btnText}>Ripristina</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    onPress={() => {
                      setEditingDate(u.date);
                      setEditStart(u.timeStart);
                      setEditEnd(u.timeEnd);
                      setEditVenue(u.venue);
                      setEditReason('');
                    }}
                    style={[s.btn, s.btnModify]}
                    data-testid={`btn-modify-${u.date}`}
                  >
                    <Text style={s.btnText}>Modifica</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setCancelDate(u.date); setCancelReason(''); }}
                    style={[s.btn, s.btnCancel]}
                    data-testid={`btn-cancel-${u.date}`}
                  >
                    <Text style={s.btnText}>Annulla</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Modify Modal */}
      <Modal visible={!!editingDate} transparent animationType="slide" onRequestClose={() => setEditingDate(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Modifica allenamento</Text>
            <Text style={s.label}>Ora inizio (HH:MM)</Text>
            <TextInput style={s.input} value={editStart} onChangeText={setEditStart} placeholder="17:00" />
            <Text style={s.label}>Ora fine (HH:MM)</Text>
            <TextInput style={s.input} value={editEnd} onChangeText={setEditEnd} placeholder="18:30" />
            <Text style={s.label}>Palestra/Luogo</Text>
            <TextInput style={s.input} value={editVenue} onChangeText={setEditVenue} placeholder="PalaSole" />
            <Text style={s.label}>Motivo</Text>
            <TextInput style={[s.input, { height: 70 }]} value={editReason} onChangeText={setEditReason} placeholder="Es: spostato per gara recupero" multiline />
            <View style={s.modalButtons}>
              <TouchableOpacity onPress={() => setEditingDate(null)} style={[s.btn, s.btnRestore, { flex: 1 }]}>
                <Text style={s.btnText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveModify} style={[s.btn, s.btnModify, { flex: 1 }]} disabled={!!savingDate}>
                <Text style={s.btnText}>{savingDate ? '…' : 'Salva'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancel Modal */}
      <Modal visible={!!cancelDate} transparent animationType="slide" onRequestClose={() => setCancelDate(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Annulla allenamento</Text>
            <Text style={s.label}>Motivo (opzionale)</Text>
            <TextInput style={[s.input, { height: 70 }]} value={cancelReason} onChangeText={setCancelReason} placeholder="Es: festività, palestra non disponibile" multiline />
            <View style={s.modalButtons}>
              <TouchableOpacity onPress={() => setCancelDate(null)} style={[s.btn, s.btnRestore, { flex: 1 }]}>
                <Text style={s.btnText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveCancel} style={[s.btn, s.btnCancel, { flex: 1 }]} disabled={!!savingDate}>
                <Text style={s.btnText}>{savingDate ? '…' : 'Conferma'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#007AFF', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20 },
  headerBack: { color: '#fff', fontSize: 16, marginBottom: 6 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  intro: { color: '#444', marginBottom: 16, lineHeight: 18 },
  muted: { color: '#888', fontSize: 13, marginTop: 2 },
  row: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowDate: { fontWeight: 'bold', fontSize: 15, marginBottom: 4 },
  statusNormal: { color: '#444' },
  statusCancelled: { color: '#C0392B', fontWeight: '600' },
  statusModified: { color: '#D35400', fontWeight: '600' },
  btn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  btnCancel: { backgroundColor: '#C0392B' },
  btnModify: { backgroundColor: '#D35400' },
  btnRestore: { backgroundColor: '#888' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  label: { fontSize: 13, color: '#444', marginBottom: 4, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 15 },
  modalButtons: { flexDirection: 'row', gap: 8, marginTop: 20 },
});
