import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from './Icon';
import api from '../services/api';

interface TodayItem {
  id: string;
  athlete_id: string;
  athlete_name: string;
  check_in_time?: string;
  forced?: boolean;
}

/**
 * 🆕 26/09/2026 — Elenco "Presenze di oggi" della squadra con cestino per ANNULLARE
 * una registrazione errata. Admin: sempre. Allenatore: solo in giornata (validato dal backend).
 */
export default function TodayAttendanceList({ teamId, onChanged }: { teamId: string; onChanged?: () => void }) {
  const [items, setItems] = useState<TodayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/teams/${teamId}/attendance/today`);
      setItems(res.data || []);
    } catch (e) {
      // silenzioso
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  const doDelete = async (item: TodayItem) => {
    try {
      setDeleting(item.id);
      await api.delete(`/attendances/${item.id}`);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      onChanged && onChanged();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Impossibile annullare la presenza';
      if (Platform.OS === 'web') window.alert(msg); else Alert.alert('Errore', msg);
    } finally {
      setDeleting(null);
    }
  };

  const confirmDelete = (item: TodayItem) => {
    const msg = `Annullare la presenza di ${item.athlete_name} registrata oggi?`;
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) doDelete(item);
    } else {
      Alert.alert('Annulla presenza', msg, [
        { text: 'No', style: 'cancel' },
        { text: 'Sì, annulla', style: 'destructive', onPress: () => doDelete(item) },
      ]);
    }
  };

  const fmtTime = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.headerRow} onPress={() => setOpen((v) => !v)} testID="today-attendance-toggle">
        <Text style={styles.title}>✅ Presenze di oggi {items.length ? `(${items.length})` : ''}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color="#5856D6" />
      </TouchableOpacity>
      {open && (
        <View style={{ marginTop: 8 }}>
          <Text style={styles.hint}>Tocca il cestino per annullare una registrazione errata.</Text>
          {loading ? (
            <ActivityIndicator color="#5856D6" style={{ marginVertical: 12 }} />
          ) : items.length === 0 ? (
            <Text style={styles.empty}>Nessuna presenza registrata oggi.</Text>
          ) : (
            items.map((it) => (
              <View key={it.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{it.athlete_name}</Text>
                  <Text style={styles.time}>Registrata alle {fmtTime(it.check_in_time)}{it.forced ? ' · forzata' : ''}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => confirmDelete(it)}
                  disabled={deleting === it.id}
                  style={styles.trashBtn}
                  testID={`delete-att-${it.athlete_id}`}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {deleting === it.id ? (
                    <ActivityIndicator color="#C62828" size="small" />
                  ) : (
                    <Ionicons name="trash-outline" size={22} color="#C62828" />
                  )}
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 15, fontWeight: '700', color: '#333' },
  hint: { fontSize: 12, color: '#888', marginBottom: 8, fontStyle: 'italic' },
  empty: { fontSize: 13, color: '#999', paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  name: { fontSize: 14, fontWeight: '600', color: '#222' },
  time: { fontSize: 12, color: '#777', marginTop: 2 },
  trashBtn: { padding: 8, borderRadius: 8, backgroundColor: '#FFEBEE', marginLeft: 8 },
});
