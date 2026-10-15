/**
 * 🆕 29/07/2026 — Card "Calendario Gare" mostrata sulla scheda atleta.
 * - Lista prossime gare da tutte le squadre in cui l'atleta gioca
 * - Bottone "Esporta calendario (.ics)" scarica un file importabile in
 *   Google Calendar / Apple Calendar / Outlook
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Linking } from 'react-native';
import { Ionicons } from './Icon';
import api from '../services/api';

interface Match {
  id: string;
  date: string;
  team_id: string;
  team_name?: string;
  society_name?: string;
  opponent: string;
  venue?: string;
  home_away?: string;
  meeting_time?: string;
}

interface TeamInfo {
  id: string;
  name: string;
  calendar_link?: string | null;
}

interface Props {
  athleteId: string;
  athleteName?: string;
}

export default function AthleteMatchesCard({ athleteId, athleteName }: Props) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  // 🆕 01/08/2026 — Card collassabile + filtro Da giocare/Giocate/Totale
  const [collapsed, setCollapsed] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'played' | 'all'>('upcoming');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get(`/athletes/${athleteId}/matches`);
        if (mounted) {
          setMatches(res.data?.matches || []);
          setTeams(res.data?.teams || []);
        }
      } catch {
        if (mounted) { setMatches([]); setTeams([]); }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [athleteId]);

  const openFederation = (url: string) => {
    try { Linking.openURL(url); } catch (e) { console.error('open federation link failed', e); }
  };

  const exportICS = async () => {
    try {
      const res = await api.get(`/athletes/${athleteId}/matches`, {
        params: { format: 'ics' },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'text/calendar' });
      if (Platform.OS === 'web') {
        // @ts-ignore
        const url = URL.createObjectURL(blob);
        // @ts-ignore
        const a = document.createElement('a');
        a.href = url;
        a.download = `gare_${(athleteName || 'atleta').replace(/\s+/g, '_')}.ics`;
        // @ts-ignore
        document.body.appendChild(a);
        a.click();
        // @ts-ignore
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
    } catch (e) {
      console.error('Export ICS failed', e);
    }
  };

  if (loading) {
    return (
      <View style={styles.card} data-testid="athlete-matches-card">
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  }

  // 🆕 01/08/2026 — Filtro gare: Da giocare / Giocate / Totale
  const now = Date.now();
  const upcoming = matches.filter((m) => new Date(m.date).getTime() >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const played = matches.filter((m) => new Date(m.date).getTime() < now)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const allSorted = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const baseList = filter === 'upcoming' ? upcoming : (filter === 'played' ? played : allSorted);
  const shown = expanded ? baseList : baseList.slice(0, 5);
  const fmtDate = (iso: string) => {
    try {
      const d = new Date(iso);
      // 🐛 Fuso orario: data gara salvata come ora italiana "in UTC" → mostrare con timeZone 'UTC' (come l'admin)
      return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    } catch { return iso; }
  };

  const federationTeams = teams.filter((t) => t.calendar_link);

  const FilterTab = ({ id, label, count }: { id: 'upcoming' | 'played' | 'all'; label: string; count: number }) => (
    <TouchableOpacity
      style={[styles.filterTab, filter === id && styles.filterTabActive]}
      onPress={() => { setFilter(id); setExpanded(false); }}
      testID={`athlete-matches-filter-${id}`}
    >
      <Text style={[styles.filterTabText, filter === id && styles.filterTabTextActive]}>{label} ({count})</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.card} testID="athlete-matches-card">
      <TouchableOpacity
        style={styles.header}
        activeOpacity={0.7}
        onPress={() => setCollapsed(!collapsed)}
        testID="athlete-matches-toggle"
      >
        <Ionicons name="calendar" size={20} color="#1E3A8A" />
        <Text style={styles.title}>Calendario Gare</Text>
        <View style={styles.countPill}><Text style={styles.countPillText}>{matches.length}</Text></View>
        <View style={{ flex: 1 }} />
        <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={20} color="#1E3A8A" />
      </TouchableOpacity>

      {!collapsed && (
        <>
          {matches.length > 0 && (
            <TouchableOpacity onPress={exportICS} style={[styles.exportBtn, { alignSelf: 'flex-start', marginBottom: 10 }]} testID="athlete-matches-export-ics">
              <Ionicons name="download" size={14} color="#fff" />
              <Text style={styles.exportBtnText}>Esporta .ics</Text>
            </TouchableOpacity>
          )}
          {matches.length > 0 && (
            <View style={styles.filterRow}>
              <FilterTab id="upcoming" label="Da giocare" count={upcoming.length} />
              <FilterTab id="played" label="Giocate" count={played.length} />
              <FilterTab id="all" label="Totale" count={matches.length} />
            </View>
          )}
          {matches.length === 0 ? (
            <Text style={styles.empty}>Nessuna gara caricata a calendario.</Text>
          ) : baseList.length === 0 ? (
            <Text style={styles.empty}>
              {filter === 'upcoming' ? 'Nessuna gara da giocare.' : 'Nessuna gara in questa vista.'}
            </Text>
          ) : (
            <>
              {shown.map((m) => {
                const isHome = (m.home_away || '').toLowerCase() === 'home';
                return (
                  <View key={m.id} style={styles.row} testID={`athlete-match-${m.id}`}>
                    <View style={styles.rowMain}>
                      <Text style={styles.rowDate}>{fmtDate(m.date)}</Text>
                      <Text style={styles.rowTeams} numberOfLines={1}>
                        {isHome ? `${m.society_name || m.team_name || 'Casa'} vs ${m.opponent}` : `${m.opponent} vs ${m.society_name || m.team_name || 'Trasferta'}`}
                      </Text>
                      {m.venue && <Text style={styles.rowVenue}>📍 {m.venue}</Text>}
                    </View>
                    <View style={[styles.badge, isHome ? styles.badgeHome : styles.badgeAway]}>
                      <Text style={styles.badgeText}>{isHome ? 'CASA' : 'FUORI'}</Text>
                    </View>
                  </View>
                );
              })}
              {baseList.length > 5 && (
                <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.showMore}>
                  <Text style={styles.showMoreText}>
                    {expanded ? 'Mostra meno' : `Vedi tutte (${baseList.length})`}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </>
      )}

      {/* 🆕 01/08/2026 — Link al calendario ufficiale FIPAV della squadra.
          Sempre visibile (anche a card collassata): fondamentale per gli atleti
          dei campionati nazionali (Serie A/B) senza gare importabili. */}
      {federationTeams.length > 0 && (
        <View style={styles.fedSection} testID="athlete-federation-links">
          <Text style={styles.fedTitle}>📅 Calendario ufficiale FIPAV</Text>
          <Text style={styles.fedHint}>Apri il calendario federale della tua squadra (es. Serie A/B nazionale).</Text>
          {federationTeams.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={styles.fedBtn}
              onPress={() => openFederation(t.calendar_link as string)}
              testID={`athlete-federation-link-${t.id}`}
            >
              <Ionicons name="open-outline" size={15} color="#1E3A8A" />
              <Text style={styles.fedBtnText} numberOfLines={1}>Calendario Federazione — {t.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  title: { fontSize: 16, fontWeight: '700', color: '#1E3A8A' },
  countPill: { backgroundColor: '#EEF2FF', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  countPillText: { color: '#1E3A8A', fontSize: 12, fontWeight: '700' },
  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  filterTab: { flex: 1, paddingVertical: 7, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center' },
  filterTabActive: { backgroundColor: '#1E3A8A' },
  filterTabText: { fontSize: 11.5, fontWeight: '600', color: '#4B5563' },
  filterTabTextActive: { color: '#fff' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#059669', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  exportBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  subtitle: { fontSize: 12, color: '#6B7280', marginBottom: 10 },
  empty: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  rowMain: { flex: 1 },
  rowDate: { fontSize: 12, color: '#1E3A8A', fontWeight: '700' },
  rowTeams: { fontSize: 13, color: '#111827', marginTop: 2 },
  rowVenue: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginLeft: 8 },
  badgeHome: { backgroundColor: '#DBEAFE' },
  badgeAway: { backgroundColor: '#FEE2E2' },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#1E3A8A' },
  showMore: { paddingVertical: 8, alignItems: 'center' },
  showMoreText: { color: '#007AFF', fontSize: 13, fontWeight: '600' },
  fedSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  fedTitle: { fontSize: 13, fontWeight: '700', color: '#1E3A8A' },
  fedHint: { fontSize: 11, color: '#6B7280', marginTop: 2, marginBottom: 8 },
  fedBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, marginTop: 6 },
  fedBtnText: { color: '#1E3A8A', fontSize: 13, fontWeight: '600', flex: 1 },
});
