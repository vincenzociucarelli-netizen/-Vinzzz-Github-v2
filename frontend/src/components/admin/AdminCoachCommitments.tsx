/**
 * 🆕 22/06/2026 — AdminCoachCommitments: mostra gli impegni di un coach/dirigente/collaboratore
 * nel tab "Da fare" della scheda admin.
 *
 * Usa l'endpoint /api/coach/commitments?user_id={userId} (l'admin override è stato aggiunto
 * il 22/06/2026 in server.py).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';

interface CommitmentItem {
  type?: string; // 'training' | 'match'
  team_name?: string;
  time_start?: string;
  time_end?: string;
  venue?: string;
  opponent?: string;
  home_away?: 'home' | 'away';
  reason?: string;
  cancelled?: boolean;
  day_name?: string;
  date?: string;
  // 🆕 01/07/2026 — Badge lato per dual-role (Atleta/Coach)
  as_role?: 'atleta' | 'coach';
}

interface Commitments {
  today: CommitmentItem[];
  tomorrow: CommitmentItem[];
  day_after: CommitmentItem[];
  upcoming: CommitmentItem[];
}

interface Props {
  /** Se non passato, l'endpoint restituisce gli impegni dell'utente corrente (lato user). */
  userId?: string;
  /** 🆕 23/06/2026 — Se passato, fa la query come ?athlete_id={id} (admin view atleta). */
  athleteId?: string;
  /** Etichetta del ruolo, per personalizzare i messaggi vuoti (es. "coach", "collaboratore"). */
  roleLabel?: string;
}

const RoleBadge: React.FC<{ role?: 'atleta' | 'coach' }> = ({ role }) => {
  if (!role) return null;
  const isAthlete = role === 'atleta';
  return (
    <View style={{
      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
      backgroundColor: isAthlete ? '#E3F2FD' : '#FFF3E0',
      borderWidth: 1, borderColor: isAthlete ? '#1565C0' : '#F57C00',
      marginRight: 6,
    }}>
      <Text style={{
        fontSize: 9, fontWeight: '700',
        color: isAthlete ? '#0D47A1' : '#E65100',
      }}>{isAthlete ? 'ATL' : 'COACH'}</Text>
    </View>
  );
};

const DayBlock: React.FC<{ title: string; items: CommitmentItem[]; emoji: string }> = ({ title, items, emoji }) => (
  <View style={styles.dayBlock}>
    <Text style={styles.dayTitle}>{emoji} {title}</Text>
    {items.length === 0 ? (
      <Text style={styles.emptyText}>Nessun impegno</Text>
    ) : (
      items.map((it, idx) => (
        <View key={idx} style={[styles.itemRow, it.cancelled && { opacity: 0.5 }]}>
          <Ionicons
            name={it.type === 'match' ? 'trophy' : 'fitness'}
            size={16}
            color={it.type === 'match' ? '#D4A017' : '#1565C0'}
            style={{ marginRight: 6 }}
          />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
              <RoleBadge role={it.as_role} />
              <Text style={styles.itemTitle}>
                {it.team_name || 'Squadra'} {it.type === 'match' ? `vs ${it.opponent || '?'}` : ''}
                {it.cancelled ? ' (ANNULLATO)' : ''}
              </Text>
            </View>
            <Text style={styles.itemSubtitle}>
              {it.time_start || ''}{it.time_end ? `–${it.time_end}` : ''}
              {it.venue ? ` · ${it.venue}` : ''}
              {it.home_away ? ` · ${it.home_away === 'home' ? 'Casa' : 'Trasferta'}` : ''}
            </Text>
          </View>
        </View>
      ))
    )}
  </View>
);

export const AdminCoachCommitments: React.FC<Props> = ({ userId, athleteId, roleLabel = 'coach' }) => {
  const [data, setData] = useState<Commitments | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 🆕 22/06/2026 — "Prossimi giorni" collassabile (default chiuso)
  const [upcomingOpen, setUpcomingOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    // 🆕 01/07/2026 — Dual-role: se entrambi userId+athleteId, faccio 2 fetch e mergio.
    const isDual = !!userId && !!athleteId;
    const fetchOne = (params: any) => api.get('/coach/commitments', { params }).then(r => r.data);
    const promise: Promise<Commitments> = isDual
      ? Promise.all([
          fetchOne({ user_id: userId }).catch(() => null),
          fetchOne({ athlete_id: athleteId }).catch(() => null),
        ]).then(([coachData, athleteData]: any) => {
          const tag = (arr: any[] = [], role: 'coach' | 'atleta') => (arr || []).map((x) => ({ ...x, as_role: role }));
          const sortBy = (a: any, b: any) => {
            const ka = `${a.date || ''}T${a.time_start || '00:00'}`;
            const kb = `${b.date || ''}T${b.time_start || '00:00'}`;
            return ka.localeCompare(kb);
          };
          return {
            today: [...tag(coachData?.today, 'coach'), ...tag(athleteData?.today, 'atleta')].sort(sortBy),
            tomorrow: [...tag(coachData?.tomorrow, 'coach'), ...tag(athleteData?.tomorrow, 'atleta')].sort(sortBy),
            day_after: [...tag(coachData?.day_after, 'coach'), ...tag(athleteData?.day_after, 'atleta')].sort(sortBy),
            upcoming: [...tag(coachData?.upcoming, 'coach'), ...tag(athleteData?.upcoming, 'atleta')].sort(sortBy),
          } as Commitments;
        })
      : fetchOne(athleteId ? { athlete_id: athleteId } : { user_id: userId });
    promise
      .then((res: any) => setData(res))
      .catch((err) => {
        console.error('Errore caricamento impegni admin:', err);
        setError('Impossibile caricare gli impegni');
      })
      .finally(() => setLoading(false));
  }, [userId, athleteId]);

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color="#1565C0" />
        <Text style={styles.loadingText}>Caricamento impegni…</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.card}>
        <Text style={[styles.emptyText, { color: '#C0392B' }]}>{error}</Text>
      </View>
    );
  }
  if (!data) return null;

  const totalCount = (data.today?.length || 0) + (data.tomorrow?.length || 0) + (data.day_after?.length || 0) + (data.upcoming?.length || 0);

  return (
    <View style={styles.card} data-testid="admin-commitments-card">
      <Text style={styles.cardTitle}>📌 Impegni del {roleLabel}</Text>
      {totalCount === 0 ? (
        <View style={{ padding: 12, backgroundColor: '#F9FAFB', borderRadius: 8 }}>
          <Text style={styles.emptyText}>Nessun impegno nei prossimi 7 giorni.</Text>
        </View>
      ) : (
        <>
          <DayBlock title="Oggi" items={data.today || []} emoji="🔴" />
          <DayBlock title="Domani" items={data.tomorrow || []} emoji="🟠" />
          <DayBlock title="Dopodomani" items={data.day_after || []} emoji="🟡" />
          {(data?.upcoming || []).length > 0 && (
            <View style={[styles.dayBlock, { borderBottomWidth: 0, paddingBottom: 0, marginBottom: 0 }]}>
              <TouchableOpacity
                onPress={() => setUpcomingOpen(!upcomingOpen)}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}
                data-testid="upcoming-toggle"
                testID="upcoming-toggle"
              >
                <Ionicons name={upcomingOpen ? 'chevron-down' : 'chevron-forward'} size={18} color="#374151" />
                <Text style={[styles.dayTitle, { marginLeft: 4, marginBottom: 0 }]}>
                  📅 Prossimi giorni ({(data?.upcoming || []).length})
                </Text>
              </TouchableOpacity>
              {upcomingOpen && (
                <View style={{ marginTop: 6 }}>
                  {(data?.upcoming || []).map((it, idx) => (
                    <View key={idx} style={[styles.itemRow, it.cancelled && { opacity: 0.5 }]}>
                      <Ionicons
                        name={it.type === 'match' ? 'trophy' : 'fitness'}
                        size={16}
                        color={it.type === 'match' ? '#D4A017' : '#1565C0'}
                        style={{ marginRight: 6 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>
                          {it.team_name || 'Squadra'} {it.type === 'match' ? `vs ${it.opponent || '?'}` : ''}
                          {it.cancelled ? ' (ANNULLATO)' : ''}
                        </Text>
                        <Text style={styles.itemSubtitle}>
                          {it.time_start || ''}{it.time_end ? `–${it.time_end}` : ''}
                          {it.venue ? ` · ${it.venue}` : ''}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1565C0',
    marginBottom: 10,
  },
  dayBlock: {
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dayTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  itemTitle: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
  },
  itemSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  emptyText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  loadingText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
    textAlign: 'center',
  },
});

export default AdminCoachCommitments;
