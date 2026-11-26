/**
 * 🆕 29/07/2026 — Card "Calendario Gare" mostrata sulla scheda atleta.
 * - Lista prossime gare da tutte le squadre in cui l'atleta gioca
 * - Bottone "Esporta calendario (.ics)" scarica un file importabile in
 *   Google Calendar / Apple Calendar / Outlook
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Linking, Alert } from 'react-native';
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
  // 🆕 Gare selezionate "interessato" + opzioni export .ics
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [excludePast, setExcludePast] = useState(true);
  const [onlySelected, setOnlySelected] = useState(false);
  // 🆕 Squadre seguite: ricevi i promemoria di TUTTE le gare della squadra
  const [followedTeams, setFollowedTeams] = useState<Set<string>>(new Set());
  const [togglingTeam, setTogglingTeam] = useState<string | null>(null);

  const reloadReminders = async () => {
    try {
      const rem = await api.get(`/athletes/${athleteId}/match-reminders`);
      setSelected(new Set<string>(rem.data?.selected || []));
      setFollowedTeams(new Set<string>(rem.data?.followed_teams || []));
    } catch { /* noop */ }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [res, rem] = await Promise.all([
          api.get(`/athletes/${athleteId}/matches`),
          api.get(`/athletes/${athleteId}/match-reminders`).catch(() => ({ data: { selected: [], followed_teams: [] } })),
        ]);
        if (mounted) {
          setMatches(res.data?.matches || []);
          setTeams(res.data?.teams || []);
          setSelected(new Set<string>(rem.data?.selected || []));
          setFollowedTeams(new Set<string>(rem.data?.followed_teams || []));
        }
      } catch {
        if (mounted) { setMatches([]); setTeams([]); }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [athleteId]);

  const toggleTeam = async (teamId: string) => {
    const wasFollowing = followedTeams.has(teamId);
    const next = new Set(followedTeams);
    if (wasFollowing) next.delete(teamId); else next.add(teamId);
    setFollowedTeams(next);
    setTogglingTeam(teamId);
    try {
      await api.post(`/athletes/${athleteId}/team-follows`, { team_id: teamId, follow: !wasFollowing });
      await reloadReminders(); // aggiorna stelline singole + stato squadre
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
      await api.post(`/athletes/${athleteId}/match-reminders`, { match_id: matchId, interested: !wasSelected });
    } catch (e) {
      // rollback in caso di errore
      void e;
      const revert = new Set(selected);
      setSelected(revert);
      Alert.alert('Errore', 'Impossibile aggiornare il promemoria. Riprova.');
    } finally {
      setTogglingId(null);
    }
  };

  const openFederation = (url: string) => {
    try { Linking.openURL(url); } catch (e) { console.error('open federation link failed', e); }
  };

  const exportICS = async () => {
    try {
      const params: Record<string, string> = { format: 'ics' };
      if (excludePast) params.only_upcoming = 'true';
      if (onlySelected) params.only_selected = 'true';
      const res = await api.get(`/athletes/${athleteId}/matches`, {
        params,
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
          {teams.length > 0 && (
            <View style={styles.teamsBox} testID="athlete-teams-follow">
              <Text style={styles.teamsTitle}>⭐ Segui le tue squadre</Text>
              <Text style={styles.teamsHint}>Tocca una squadra per ricevere i promemoria di tutte le sue gare, senza sceglierle una per una.</Text>
              {teams.map((t) => {
                const following = followedTeams.has(t.id);
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={styles.teamRow}
                    onPress={() => toggleTeam(t.id)}
                    disabled={togglingTeam === t.id}
                    testID={`athlete-team-follow-${t.id}`}
                  >
                    <Ionicons
                      name={following ? 'star' : 'star-outline'}
                      size={20}
                      color={following ? '#F59E0B' : '#9CA3AF'}
                    />
                    <Text style={[styles.teamName, following && { fontWeight: '800', color: '#065F46' }]} numberOfLines={1}>{t.name}</Text>
                    {following ? <Text style={styles.teamFollowing}>Seguita</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
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
              <TouchableOpacity onPress={exportICS} style={[styles.exportBtn, { alignSelf: 'flex-start', marginTop: 8 }]} testID="athlete-matches-export-ics">
                <Ionicons name="download" size={14} color="#fff" />
                <Text style={styles.exportBtnText}>Scarica .ics</Text>
              </TouchableOpacity>
              <Text style={styles.exportHint}>
                ⭐ Tocca la stella su una gara per essere avvisato: email il giorno prima e promemoria sul calendario 2 ore prima.
              </Text>
            </View>
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
                    <TouchableOpacity
                      onPress={() => toggleInterest(m.id)}
                      disabled={togglingId === m.id}
                      style={styles.starBtn}
                      testID={`athlete-match-star-${m.id}`}
                    >
                      <Ionicons
                        name={selected.has(m.id) ? 'star' : 'star-outline'}
                        size={20}
                        color={selected.has(m.id) ? '#F59E0B' : '#9CA3AF'}
                      />
                    </TouchableOpacity>
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
  teamsBox: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 10, padding: 12, marginBottom: 12 },
  teamsTitle: { fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 4 },
  teamsHint: { fontSize: 11.5, color: '#6B7280', marginBottom: 8, lineHeight: 16 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#FEF3C7' },
  teamName: { flex: 1, fontSize: 14, color: '#111827', fontWeight: '600' },
  teamFollowing: { fontSize: 11, color: '#065F46', fontWeight: '700' },
  exportBox: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 10, padding: 12, marginBottom: 12 },
  exportTitle: { fontSize: 13, fontWeight: '700', color: '#065F46', marginBottom: 8 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  optText: { fontSize: 13, color: '#374151' },
  exportHint: { fontSize: 11.5, color: '#6B7280', marginTop: 8, lineHeight: 16 },
  starBtn: { padding: 4, marginRight: 4 },
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
