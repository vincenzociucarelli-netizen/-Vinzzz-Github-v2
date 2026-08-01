/**
 * 🆕 29/07/2026 — Card "Calendario Gare" mostrata sulla scheda atleta.
 * - Lista prossime gare da tutte le squadre in cui l'atleta gioca
 * - Bottone "Esporta calendario (.ics)" scarica un file importabile in
 *   Google Calendar / Apple Calendar / Outlook
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from './Icon';
import api from '../services/api';

interface Match {
  id: string;
  date: string;
  team_id: string;
  team_name?: string;
  opponent: string;
  venue?: string;
  home_away?: string;
  meeting_time?: string;
}

interface Props {
  athleteId: string;
  athleteName?: string;
}

export default function AthleteMatchesCard({ athleteId, athleteName }: Props) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get(`/athletes/${athleteId}/matches`);
        if (mounted) setMatches(res.data?.matches || []);
      } catch {
        if (mounted) setMatches([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [athleteId]);

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

  // 🐛 01/08/2026 — In bassa stagione (nessuna gara futura) mostravamo card vuota
  // pur avendo l'intera stagione a calendario. Ora: se ci sono gare future le
  // mostriamo; altrimenti mostriamo il calendario completo (più recenti prima).
  const now = Date.now();
  const upcoming = matches.filter((m) => new Date(m.date).getTime() >= now);
  const seasonOver = upcoming.length === 0;
  const baseList = seasonOver ? [...matches].reverse() : upcoming;
  const shown = expanded ? baseList : baseList.slice(0, 5);
  const fmtDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  return (
    <View style={styles.card} data-testid="athlete-matches-card">
      <View style={styles.header}>
        <Ionicons name="calendar" size={20} color="#1E3A8A" />
        <Text style={styles.title}>Calendario Gare</Text>
        {matches.length > 0 && (
          <TouchableOpacity onPress={exportICS} style={styles.exportBtn} data-testid="athlete-matches-export-ics">
            <Ionicons name="download" size={14} color="#fff" />
            <Text style={styles.exportBtnText}>Esporta .ics</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.subtitle}>
        {seasonOver
          ? 'Calendario completo delle gare della stagione.'
          : 'Prossime gare da tutte le squadre in cui l\u2019atleta gioca.'}
      </Text>
      {matches.length === 0 ? (
        <Text style={styles.empty}>Nessuna gara programmata.</Text>
      ) : (
        <>
          {shown.map((m) => {
            const isHome = (m.home_away || '').toLowerCase() === 'home';
            return (
              <View key={m.id} style={styles.row} data-testid={`athlete-match-${m.id}`}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowDate}>{fmtDate(m.date)}</Text>
                  <Text style={styles.rowTeams} numberOfLines={1}>
                    {isHome ? `${m.team_name || 'Casa'} vs ${m.opponent}` : `${m.opponent} vs ${m.team_name || 'Trasferta'}`}
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { fontSize: 16, fontWeight: '700', color: '#1E3A8A', flex: 1 },
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
});
