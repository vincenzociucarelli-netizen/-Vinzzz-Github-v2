import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Platform, Alert } from 'react-native';
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
  // 🆕 Gare "interessato" + opzioni export (per tutti i ruoli)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [followedTeams, setFollowedTeams] = useState<Set<string>>(new Set());
  const [togglingTeam, setTogglingTeam] = useState<string | null>(null);
  const [excludePast, setExcludePast] = useState(true);
  const [onlySelected, setOnlySelected] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [res, rem] = await Promise.all([
        api.get('/matches/society-view'),
        api.get('/match-reminders').catch(() => ({ data: { selected: [], followed_teams: [] } })),
      ]);
      setMatches(Array.isArray(res.data) ? res.data : []);
      setSelected(new Set<string>(rem.data?.selected || []));
      setFollowedTeams(new Set<string>(rem.data?.followed_teams || []));
    } catch (e) {
      void e;
      setMatches([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleTeam = async (teamId: string) => {
    const wasFollowing = followedTeams.has(teamId);
    const next = new Set(followedTeams);
    if (wasFollowing) next.delete(teamId); else next.add(teamId);
    setFollowedTeams(next);
    setTogglingTeam(teamId);
    try {
      await api.post('/team-follows', { team_id: teamId, follow: !wasFollowing });
      await load(); // ricarica le stelline delle gare aggiornate dalla squadra
    } catch {
      setFollowedTeams(new Set(followedTeams));
      Alert.alert('Errore', 'Impossibile aggiornare la squadra seguita. Riprova.');
    } finally {
      setTogglingTeam(null);
    }
  };

  const toggleInterest = async (matchId: string) => {
    const wasSelected = selected.has(matchId);
    const next = new Set(selected);
    if (wasSelected) next.delete(matchId); else next.add(matchId);
    setSelected(next);
    setTogglingId(matchId);
    try {
      await api.post('/match-reminders', { match_id: matchId, interested: !wasSelected });
    } catch {
      setSelected(new Set(selected));
      Alert.alert('Errore', 'Impossibile aggiornare il promemoria. Riprova.');
    } finally {
      setTogglingId(null);
    }
  };

  const exportICS = async () => {
    try {
      setExporting(true);
      const params: Record<string, string> = { format: 'ics' };
      if (excludePast) params.only_upcoming = 'true';
      if (onlySelected) params.only_selected = 'true';
      const res = await api.get('/matches/society-view', { params, responseType: 'blob' });
      if (Platform.OS === 'web') {
        const blob = new Blob([res.data], { type: 'text/calendar' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'gare_societa.ics';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        Alert.alert('Download .ics', 'Apri il Calendario Gare dalla versione web dell\'app per scaricare il file .ics.');
      }
    } catch {
      Alert.alert('Errore', 'Esportazione non riuscita. Riprova.');
    } finally {
      setExporting(false);
    }
  };

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

  // 🆕 Squadre distinte (dal calendario) per la selezione "segui squadra"
  const teamsList: { id: string; name: string }[] = [];
  const seenTeams = new Set<string>();
  matches.forEach((m) => {
    if (m.team_id && !seenTeams.has(m.team_id)) {
      seenTeams.add(m.team_id);
      teamsList.push({ id: m.team_id, name: m.team_name || 'Squadra' });
    }
  });
  teamsList.sort((a, b) => a.name.localeCompare(b.name));

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
          {/* 🆕 Segui una squadra: ricevi i promemoria di TUTTE le sue gare */}
          {teamsList.length > 0 && (
            <View style={styles.teamsBox}>
              <Text style={styles.teamsTitle}>⭐ Segui le tue squadre</Text>
              <Text style={styles.teamsHint}>Tocca una squadra per ricevere i promemoria di tutte le sue gare, senza sceglierle una per una.</Text>
              {teamsList.map((t) => {
                const following = followedTeams.has(t.id);
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={styles.teamRow}
                    onPress={() => toggleTeam(t.id)}
                    disabled={togglingTeam === t.id}
                    testID={`team-follow-${t.id}`}
                  >
                    <Ionicons
                      name={following ? 'star' : 'star-outline'}
                      size={22}
                      color={following ? '#F59E0B' : '#9CA3AF'}
                    />
                    <Text style={[styles.teamName, following && { fontWeight: '800', color: '#065F46' }]}>{t.name}</Text>
                    {following ? <Text style={styles.teamFollowing}>Seguita</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* 🆕 Export calendario + opzioni (tutti i ruoli) */}
          {matches.length > 0 && (
            <View style={styles.exportBox}>
              <Text style={styles.exportTitle}>📅 Esporta nel tuo calendario (.ics)</Text>
              <TouchableOpacity style={styles.optRow} onPress={() => setExcludePast(!excludePast)} testID="ics-opt-exclude-past">
                <Ionicons name={excludePast ? 'checkbox' : 'square-outline'} size={18} color="#059669" />
                <Text style={styles.optText}>Escludi le gare già passate</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.optRow} onPress={() => setOnlySelected(!onlySelected)} testID="ics-opt-only-selected">
                <Ionicons name={onlySelected ? 'checkbox' : 'square-outline'} size={18} color="#059669" />
                <Text style={styles.optText}>Solo le gare che mi interessano ({selected.size})</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={exportICS} style={styles.exportBtn} disabled={exporting} testID="matches-export-ics">
                {exporting ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="download" size={15} color="#fff" />}
                <Text style={styles.exportBtnText}>Scarica .ics</Text>
              </TouchableOpacity>
              <Text style={styles.exportHint}>
                ⭐ Tocca la stella su una gara per essere avvisato: email il giorno prima e promemoria sul calendario 2 ore prima.
              </Text>
            </View>
          )}

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
                      <View style={styles.cardTopRow}>
                        <View style={[styles.badge, { backgroundColor: isHome ? '#E8F5E9' : '#FFF3E0' }]}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: isHome ? '#2E7D32' : '#E65100' }}>
                            {isHome ? '🏠 Casa' : '✈️ Trasferta'}
                          </Text>
                        </View>
                        {m.id ? (
                          <TouchableOpacity
                            onPress={() => toggleInterest(m.id)}
                            disabled={togglingId === m.id}
                            style={styles.starBtn}
                            testID={`match-star-${m.id}`}
                          >
                            <Ionicons
                              name={selected.has(m.id) ? 'star' : 'star-outline'}
                              size={22}
                              color={selected.has(m.id) ? '#F59E0B' : '#9CA3AF'}
                            />
                          </TouchableOpacity>
                        ) : null}
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
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  starBtn: { padding: 4 },
  exportBox: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 12, padding: 14, marginBottom: 14 },
  exportTitle: { fontSize: 14, fontWeight: '700', color: '#065F46', marginBottom: 8 },
  teamsBox: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, padding: 14, marginBottom: 14 },
  teamsTitle: { fontSize: 14, fontWeight: '700', color: '#92400E', marginBottom: 4 },
  teamsHint: { fontSize: 12, color: '#6B7280', marginBottom: 8, lineHeight: 16 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#FEF3C7' },
  teamName: { flex: 1, fontSize: 14, color: '#374151' },
  teamFollowing: { fontSize: 11, fontWeight: '700', color: '#B45309' },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  optText: { fontSize: 14, color: '#374151' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#059669', paddingVertical: 11, borderRadius: 10, marginTop: 10, minHeight: 46 },
  exportBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  exportHint: { fontSize: 12, color: '#6B7280', marginTop: 10, lineHeight: 16 },
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
