/**
 * 🆕 22/06/2026 — Dashboard Collaboratore (lato user)
 *
 * Sostituisce il vecchio redirect "router.replace('/collaboratore/profile')" con una
 * vera home che mostra in evidenza i 3 tab richiesti dall'utente (come admin view):
 *   - 🗓️ Da fare oggi (impegni, default)
 *   - 👤 Profilo (naviga a /collaboratore/profile)
 *   - 💰 Compensi (naviga a /collaboratore/compensation)
 *
 * Riusa l'endpoint /api/coach/commitments (esteso il 22/06/2026 per supportare anche
 * collaboratore con current_user).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';
import SocietyBranding from '../../src/components/SocietyBranding';

interface CommitmentItem {
  type?: string;
  team_name?: string;
  time_start?: string;
  time_end?: string;
  venue?: string;
  opponent?: string;
  home_away?: 'home' | 'away';
  cancelled?: boolean;
}

interface Commitments {
  today: CommitmentItem[];
  tomorrow: CommitmentItem[];
  day_after: CommitmentItem[];
  upcoming: CommitmentItem[];
}

const formatItem = (it: CommitmentItem) => {
  const time = `${it.time_start || ''}${it.time_end ? `–${it.time_end}` : ''}`;
  const where = it.venue ? ` · ${it.venue}` : '';
  const homeAway = it.home_away ? ` · ${it.home_away === 'home' ? 'Casa' : 'Trasferta'}` : '';
  return `${time}${where}${homeAway}`;
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
            size={18}
            color={it.type === 'match' ? '#D4A017' : '#1565C0'}
            style={{ marginRight: 8 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>
              {it.team_name || 'Squadra'} {it.type === 'match' ? `vs ${it.opponent || '?'}` : ''}
              {it.cancelled ? ' (ANNULLATO)' : ''}
            </Text>
            <Text style={styles.itemSubtitle}>{formatItem(it)}</Text>
          </View>
        </View>
      ))
    )}
  </View>
);

export default function CollaboratoreHome() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [data, setData] = useState<Commitments | null>(null);
  const [loading, setLoading] = useState(true);
  // 🆕 23/06/2026 — Sezione "Prossimi giorni" collassabile (default chiusa per risparmiare spazio)
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCommitments = async () => {
    try {
      setError(null);
      const res = await api.get('/coach/commitments');
      setData(res.data);
    } catch (err: any) {
      console.error('Errore caricamento impegni:', err);
      setError('Impossibile caricare gli impegni');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCommitments();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadCommitments();
  };

  const totalCount = data ? ((data.today?.length || 0) + (data.tomorrow?.length || 0) + (data.day_after?.length || 0) + (data.upcoming?.length || 0)) : 0;

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
      {/* Header con branding società (stesso pattern di dirigente/coach) */}
      <View style={styles.header}>
        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <SocietyBranding />
          <Text style={styles.headerTitle}>Il Mio Lavoro</Text>
          <Text style={styles.headerSubtitle}>Ciao, {user?.first_name || user?.full_name?.split(' ')[0] || 'Collaboratore'}</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={() => router.push('/collaboratore/profile')} style={styles.headerBtn}>
            <Ionicons name="person-circle-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.headerBtn}>
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* 3 quick-link buttons */}
        <View style={styles.quickLinksRow}>
          <View style={[styles.quickLinkBtn, styles.quickLinkActive]} data-testid="collab-quick-dafare">
            <Ionicons name="today-outline" size={20} color="#fff" />
            <Text style={[styles.quickLinkText, { color: '#fff' }]}>Da fare</Text>
          </View>
          <TouchableOpacity
            style={styles.quickLinkBtn}
            onPress={() => router.push('/collaboratore/profile')}
            data-testid="collab-quick-anagrafica"
            testID="collab-quick-anagrafica"
          >
            <Ionicons name="person-outline" size={20} color="#1565C0" />
            <Text style={[styles.quickLinkText, { color: '#1565C0' }]}>Anagrafica</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickLinkBtn}
            onPress={() => router.push('/collaboratore/compensation')}
            data-testid="collab-quick-compensi"
            testID="collab-quick-compensi"
          >
            <Ionicons name="cash-outline" size={20} color="#2E7D32" />
            <Text style={[styles.quickLinkText, { color: '#2E7D32' }]}>Compensi</Text>
          </TouchableOpacity>
        </View>

        {/* Da fare oggi card */}
        <View style={styles.card} data-testid="collab-commitments-card">
          <Text style={styles.cardTitle}>📌 Impegni</Text>
          {loading ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator color="#1565C0" />
              <Text style={styles.loadingText}>Caricamento impegni…</Text>
            </View>
          ) : error ? (
            <Text style={[styles.emptyText, { color: '#C0392B', padding: 12 }]}>{error}</Text>
          ) : totalCount === 0 ? (
            <View style={{ padding: 14, backgroundColor: '#F9FAFB', borderRadius: 8 }}>
              <Text style={styles.emptyText}>Nessun impegno nei prossimi 7 giorni.</Text>
            </View>
          ) : (
            <>
              <DayBlock title="Oggi" items={data?.today || []} emoji="🔴" />
              <DayBlock title="Domani" items={data?.tomorrow || []} emoji="🟠" />
              <DayBlock title="Dopodomani" items={data?.day_after || []} emoji="🟡" />
              {(data?.upcoming || []).length > 0 && (
                <View>
                  <TouchableOpacity
                    onPress={() => setUpcomingOpen(!upcomingOpen)}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F3F4F6', padding: 10, borderRadius: 8, marginTop: 6 }}
                    data-testid="coll-upcoming-toggle"
                  >
                    <Text style={{ fontWeight: '700', color: '#1F2937', fontSize: 14 }}>📅 Prossimi giorni ({data!.upcoming.length})</Text>
                    <Ionicons name={upcomingOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#1F2937" />
                  </TouchableOpacity>
                  {upcomingOpen && (
                    <View style={{ marginTop: 6 }}>
                      <DayBlock title="" items={data!.upcoming} emoji="📅" />
                    </View>
                  )}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#1565C0',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginTop: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#E3F2FD',
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLinksRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  quickLinkBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  quickLinkActive: {
    backgroundColor: '#F57C00',
  },
  quickLinkText: {
    fontSize: 13,
    fontWeight: '700',
  },
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
    fontSize: 16,
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
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  itemTitle: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  emptyText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  loadingText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 8,
  },
});
