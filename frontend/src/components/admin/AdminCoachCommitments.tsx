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
  team_id?: string;
  team_name?: string;
  time_start?: string;
  time_end?: string;
  venue?: string;
  opponent?: string;
  home_away?: 'home' | 'away';
  reason?: string;
  cancelled?: boolean;
  provisional?: boolean;
  day_name?: string;
  date?: string;
  // 🆕 01/07/2026 — Badge lato per dual-role (Atleta/Coach)
  as_role?: 'atleta' | 'coach';
}

interface ActivityBanner {
  team_id: string;
  team_name: string;
  start_label: string;
  provisional?: boolean;
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

const DAYS_UPPER = ['DOMENICA', 'LUNEDÌ', 'MARTEDÌ', 'MERCOLEDÌ', 'GIOVEDÌ', 'VENERDÌ', 'SABATO'];
const dayLabel = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return DAYS_UPPER[d.getDay()];
};

// 🆕 08/07/2026 — Dedup impegni identici (stesso team + stessa data/time + stesso venue).
// Serve per evitare doppioni quando un team ha per errore due training_sessions sullo stesso giorno.
const dedupCommitments = (arr: CommitmentItem[] = []): CommitmentItem[] => {
  const seen = new Set<string>();
  const out: CommitmentItem[] = [];
  for (const it of arr) {
    const k = `${it.type || ''}|${it.team_id || it.team_name || ''}|${(it as any).date || ''}|${it.time_start || ''}|${it.venue || ''}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
};

const ProvisionalTag: React.FC<{ show?: boolean }> = ({ show }) => {
  if (!show) return null;
  return (
    <View style={{ backgroundColor: '#FFF3E0', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 6, borderWidth: 1, borderColor: '#FFB74D' }}>
      <Text style={{ fontSize: 9, fontWeight: '700', color: '#E65100' }}>PROVVISORIO</Text>
    </View>
  );
};

const DayBlock: React.FC<{ title: string; items: CommitmentItem[]; emoji: string; dayName?: string }> = ({ title, items, emoji, dayName }) => (
  <View style={styles.dayBlock}>
    <Text style={styles.dayTitle}>{emoji} {title}{dayName ? ` — ${dayName}` : ''}</Text>
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
              <ProvisionalTag show={it.type === 'training' && it.provisional} />
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
  const [activityBanners, setActivityBanners] = useState<ActivityBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 🆕 22/06/2026 — "Prossimi giorni" collassabile (default chiuso)
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  // 🆕 Retry automatico (una volta) + pulsante "Riprova" per errori transitori (cold start)
  const retriedRef = React.useRef(false);

  const load = React.useCallback(() => {
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
          const bmap: Record<string, ActivityBanner> = {};
          for (const b of [...(coachData?.activity_banners || []), ...(athleteData?.activity_banners || [])]) {
            if (b && b.team_id) bmap[b.team_id] = b;
          }
          setActivityBanners(Object.values(bmap));
          return {
            today: [...tag(coachData?.today, 'coach'), ...tag(athleteData?.today, 'atleta')].sort(sortBy),
            tomorrow: [...tag(coachData?.tomorrow, 'coach'), ...tag(athleteData?.tomorrow, 'atleta')].sort(sortBy),
            day_after: [...tag(coachData?.day_after, 'coach'), ...tag(athleteData?.day_after, 'atleta')].sort(sortBy),
            upcoming: [...tag(coachData?.upcoming, 'coach'), ...tag(athleteData?.upcoming, 'atleta')].sort(sortBy),
          } as Commitments;
        })
      : fetchOne(athleteId ? { athlete_id: athleteId } : { user_id: userId }).then((res: any) => {
          setActivityBanners(res?.activity_banners || []);
          return res;
        });
    promise
      .then((res: any) => { retriedRef.current = false; setData(res); })
      .catch((err) => {
        console.error('Errore caricamento impegni admin:', err);
        // 🆕 Un solo retry automatico dopo 1.5s (gestisce il cold start del backend)
        if (!retriedRef.current) {
          retriedRef.current = true;
          setTimeout(() => load(), 1500);
        } else {
          setError('Impossibile caricare gli impegni');
        }
      })
      .finally(() => setLoading(false));
  }, [userId, athleteId]);

  const handleRetry = () => {
    retriedRef.current = false;
    load();
  };

  useEffect(() => {
    load();
  }, [load]);

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
        <Text style={[styles.emptyText, { color: '#C0392B', textAlign: 'center', marginBottom: 10 }]}>{error}</Text>
        <TouchableOpacity
          onPress={handleRetry}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1565C0', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, alignSelf: 'center' }}
          testID="retry-commitments-btn"
          data-testid="retry-commitments-btn"
        >
          <Ionicons name="refresh" size={16} color="#fff" style={{ marginRight: 6 }} />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Riprova</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!data) return null;

  const totalCount = (data.today?.length || 0) + (data.tomorrow?.length || 0) + (data.day_after?.length || 0) + (data.upcoming?.length || 0);

  return (
    <View style={styles.card} data-testid="admin-commitments-card">
      <Text style={styles.cardTitle}>📌 Impegni del {roleLabel}</Text>
      {activityBanners.map((b) => (
        <View key={b.team_id} style={{ backgroundColor: '#E8F5E9', borderRadius: 10, borderLeftWidth: 4, borderLeftColor: '#2E7D32', padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="calendar" size={20} color="#2E7D32" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1B5E20' }}>
              Inizio allenamenti {b.team_name}: {b.start_label}
            </Text>
            <Text style={{ fontSize: 11, color: '#33691E', marginTop: 2 }}>
              {b.provisional ? 'Programma allenamenti provvisorio' : 'Programma allenamenti confermato'}
            </Text>
          </View>
        </View>
      ))}
      {totalCount === 0 ? (
        <View style={{ padding: 12, backgroundColor: '#F9FAFB', borderRadius: 8 }}>
          <Text style={styles.emptyText}>Nessun impegno nei prossimi 7 giorni.</Text>
        </View>
      ) : (
        <>
          <DayBlock title="Oggi" items={dedupCommitments(data.today || [])} emoji="🔴" dayName={dayLabel(0)} />
          <DayBlock title="Domani" items={dedupCommitments(data.tomorrow || [])} emoji="🟠" dayName={dayLabel(1)} />
          <DayBlock title="Dopodomani" items={dedupCommitments(data.day_after || [])} emoji="🟡" dayName={dayLabel(2)} />
          {(() => {
            // 🆕 08/07/2026 — Dedup e uso "Successivi" al posto di "Prossimi giorni"
            const dedupedUpcoming = dedupCommitments(data?.upcoming || []);
            if (dedupedUpcoming.length === 0) return null;
            return (
            <View style={[styles.dayBlock, { borderBottomWidth: 0, paddingBottom: 0, marginBottom: 0 }]}>
              <TouchableOpacity
                onPress={() => setUpcomingOpen(!upcomingOpen)}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}
                data-testid="upcoming-toggle"
                testID="upcoming-toggle"
              >
                <Ionicons name={upcomingOpen ? 'chevron-down' : 'chevron-forward'} size={18} color="#374151" />
                <Text style={[styles.dayTitle, { marginLeft: 4, marginBottom: 0 }]}>
                  📅 Successivi ({dedupedUpcoming.length})
                </Text>
              </TouchableOpacity>
              {upcomingOpen && (
                <View style={{ marginTop: 6 }}>
                  {dedupedUpcoming.map((it, idx) => (
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
                          <ProvisionalTag show={it.type === 'training' && it.provisional} />
                        </View>
                        <Text style={styles.itemSubtitle}>
                          {/* 🆕 Giorno della settimana + data */}
                          {(it as any).day_name ? `${(it as any).day_name} ` : ''}
                          {(it as any).date ? `${(it as any).date} · ` : ''}
                          {it.time_start || ''}{it.time_end ? `–${it.time_end}` : ''}
                          {it.venue ? ` · ${it.venue}` : ''}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
            );
          })()}
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
