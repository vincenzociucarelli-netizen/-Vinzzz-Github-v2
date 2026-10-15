import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '../src/components/Icon';
import api from '../src/services/api';
import { championshipColor } from '../src/utils/championshipColor';

const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export default function SocietyMatchesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterMode, setFilterMode] = useState<'upcoming' | 'played' | 'all'>('upcoming');

  const load = useCallback(async () => {
    try {
      const res = await api.get('/matches/society-view');
      setMatches(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setMatches([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = new Date(new Date().toDateString());
  const filtered = matches.filter((m) => {
    const d = m.date ? new Date(m.date) : null;
    const hasResult = !!(m.result || m.score || m.sets_home != null);
    if (!d || isNaN(d.getTime())) return filterMode === 'all';
    if (filterMode === 'upcoming') return d >= today && !hasResult;
    if (filterMode === 'played') return hasResult || d < today;
    return true;
  });

  // Group by month
  const groups: Record<string, any[]> = {};
  filtered.forEach((m) => {
    const d = m.date ? new Date(m.date) : null;
    const key = d && !isNaN(d.getTime()) ? `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : 'Senza data';
    (groups[key] = groups[key] || []).push(m);
  });

  const fmtDate = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    // 🐛 Fuso orario: la data gara è salvata come "ora locale italiana" serializzata in UTC
    // (es. 19:00 → ...T19:00:00Z). L'admin la mostra con timeZone 'UTC'; qui usavamo l'ora
    // locale del dispositivo → +2h per gli altri utenti. Usiamo i getter UTC.
    const gg = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mi = String(d.getUTCMinutes()).padStart(2, '0');
    return `${gg}/${mm}/${d.getUTCFullYear()}, ${hh}:${mi}`;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="matches-back">
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Calendario Gare</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.tabs}>
        {([
          { key: 'upcoming', label: 'Da disputare' },
          { key: 'played', label: 'Giocate' },
          { key: 'all', label: 'Tutte' },
        ] as const).map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, filterMode === t.key && styles.tabActive]}
            onPress={() => setFilterMode(t.key)}
            testID={`matches-tab-${t.key}`}
          >
            <Text style={[styles.tabText, filterMode === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#1565C0" />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="trophy-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>Nessuna gara in questa vista</Text>
            </View>
          ) : (
            Object.entries(groups).map(([month, list]) => (
              <View key={month} style={{ marginBottom: 16 }}>
                <Text style={styles.month}>{month}</Text>
                {list.map((m, idx) => {
                  const isHome = (m.home_away || 'home') === 'home';
                  return (
                    <View key={m.id || idx} style={styles.card}>
                      <View style={[styles.badge, { backgroundColor: isHome ? '#E8F5E9' : '#FFF3E0' }]}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: isHome ? '#2E7D32' : '#E65100' }}>
                          {isHome ? '🏠 Casa' : '✈️ Trasferta'}
                        </Text>
                      </View>
                      {/* 🆕 Titolo = nome società (es. "Sirio Perugia vs OMAC"), categoria come etichetta */}
                      <Text style={[styles.title, { color: championshipColor(m.team_name) }]}>
                        {isHome
                          ? `${m.society_name || m.team_name} vs ${m.opponent}`
                          : `${m.opponent} vs ${m.society_name || m.team_name}`}
                      </Text>
                      <Text style={styles.vs}>
                        {m.team_name}{m.match_number ? ` · gara ${m.match_number}` : ''}
                      </Text>
                      {m.date ? <Text style={styles.date}>📅 {fmtDate(m.date)}</Text> : null}
                      {m.venue ? <Text style={styles.detail}>📍 {m.venue}</Text> : null}
                      {m.address ? <Text style={styles.detailSmall}>{m.address}{m.city ? ` - ${m.city}` : ''}</Text> : null}
                      {m.meeting_time ? <Text style={styles.meeting}>⏰ Ritrovo: {m.meeting_time}</Text> : null}
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F4F7' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1565C0', paddingHorizontal: 12, paddingVertical: 14 },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', margin: 12, borderRadius: 10, padding: 4, gap: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: '#1565C0' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#555' },
  tabTextActive: { color: '#fff' },
  month: { fontSize: 15, fontWeight: '800', color: '#333', marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 6 },
  title: { fontSize: 16, fontWeight: '800' },
  vs: { fontSize: 14, color: '#333', marginTop: 2 },
  date: { fontSize: 13, color: '#C62828', fontWeight: '700', marginTop: 8 },
  detail: { fontSize: 13, color: '#444', marginTop: 4 },
  detailSmall: { fontSize: 12, color: '#777', marginTop: 2 },
  meeting: { fontSize: 13, color: '#E67E22', fontWeight: '700', marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: '#999', marginTop: 10 },
});
