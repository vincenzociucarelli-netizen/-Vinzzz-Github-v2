import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '../../src/components/Icon';
import api from '../../src/services/api';

interface Convocation {
  id: string;
  team_name: string;
  opponent: string;
  match_date: string;
  match_time: string;
  home_away: string;
  status: string;
  athlete_ids: string[];
}

export default function ConvocationsList() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const teamId = typeof params.team_id === 'string' ? params.team_id : '';
  const teamName = typeof params.team_name === 'string' ? params.team_name : '';

  const [items, setItems] = useState<Convocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n${msg}`);
    else Alert.alert(title, msg);
  };

  const load = useCallback(async () => {
    try {
      const res = await api.get('/convocations', { params: teamId ? { team_id: teamId } : {} });
      setItems(res.data || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [teamId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirmDelete = async (id: string) => {
    const ok = Platform.OS === 'web'
      ? window.confirm('Eliminare questa convocazione?')
      : await new Promise<boolean>((resolve) => Alert.alert('Elimina', 'Eliminare questa convocazione?', [
          { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Elimina', style: 'destructive', onPress: () => resolve(true) },
        ]));
    if (!ok) return;
    try {
      await api.delete(`/convocations/${id}`);
      setItems(prev => prev.filter(c => c.id !== id));
    } catch {
      showAlert('Errore', 'Eliminazione non riuscita.');
    }
  };

  const openEditor = (convId?: string) => {
    const base = `/convocations/editor?team_id=${teamId}&team_name=${encodeURIComponent(teamName)}`;
    router.push(convId ? `${base}&conv_id=${convId}` : base);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={{ padding: 8 }}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Convocazioni</Text>
          {!!teamName && <Text style={styles.headerSub}>{teamName}</Text>}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color="#5856D6" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {items.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="clipboard-outline" size={48} color="#C7C7CC" />
              <Text style={styles.emptyText}>Nessuna convocazione.{'\n'}Tocca «Nuova convocazione» per iniziare.</Text>
            </View>
          ) : items.map(c => (
            <TouchableOpacity key={c.id} style={styles.card} onPress={() => openEditor(c.id)}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>
                  {c.home_away === 'home' ? `${c.team_name} vs ${c.opponent}` : `${c.opponent} vs ${c.team_name}`}
                </Text>
                <View style={[styles.badge, c.status === 'sent' ? styles.badgeSent : styles.badgeDraft]}>
                  <Text style={[styles.badgeText, { color: c.status === 'sent' ? '#1B5E20' : '#8D6E00' }]}>
                    {c.status === 'sent' ? 'Inviata' : 'Bozza'}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardMeta}>
                📅 {[c.match_date, c.match_time].filter(Boolean).join(' ') || 'Data da definire'} · 👥 {(c.athlete_ids || []).length} convocati
              </Text>
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => openEditor(c.id)}>
                  <Ionicons name="create-outline" size={18} color="#5856D6" />
                  <Text style={styles.actionText}>Apri</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => confirmDelete(c.id)}>
                  <Ionicons name="trash-outline" size={18} color="#C62828" />
                  <Text style={[styles.actionText, { color: '#C62828' }]}>Elimina</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={styles.footer} testID="convocations-list-screen">
        <TouchableOpacity testID="new-convocation-btn" style={styles.newBtn} onPress={() => openEditor()} disabled={!teamId}>
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.newBtnText}>Nuova convocazione</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: { backgroundColor: '#5856D6', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 12 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerSub: { color: '#E0E0FF', fontSize: 13 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#222', flex: 1, marginRight: 8 },
  cardMeta: { fontSize: 13, color: '#666', marginTop: 6 },
  cardActions: { flexDirection: 'row', gap: 20, marginTop: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { color: '#5856D6', fontWeight: '600', fontSize: 14 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeDraft: { backgroundColor: '#FFF8E1' },
  badgeSent: { backgroundColor: '#E8F5E9' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  emptyBox: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { color: '#999', textAlign: 'center', fontSize: 14, lineHeight: 20 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E5EA' },
  newBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#5856D6', paddingVertical: 14, borderRadius: 10 },
  newBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
