/**
 * 🆕 22/06/2026 — AdminCoachCommitments: mostra gli impegni di un coach/dirigente/collaboratore
 * nel tab "Da fare" della scheda admin.
 *
 * Usa l'endpoint /api/coach/commitments?user_id={userId} (l'admin override è stato aggiunto
 * il 22/06/2026 in server.py).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
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
}

interface Commitments {
  today: CommitmentItem[];
  tomorrow: CommitmentItem[];
  day_after: CommitmentItem[];
  upcoming: CommitmentItem[];
}

interface Props {
  userId: string;
  /** Etichetta del ruolo, per personalizzare i messaggi vuoti (es. "coach", "collaboratore"). */
  roleLabel?: string;
}

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
            <Text style={styles.itemTitle}>
              {it.team_name || 'Squadra'} {it.type === 'match' ? `vs ${it.opponent || '?'}` : ''}
              {it.cancelled ? ' (ANNULLATO)' : ''}
            </Text>
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

export const AdminCoachCommitments: React.FC<Props> = ({ userId, roleLabel = 'coach' }) => {
  const [data, setData] = useState<Commitments | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    api.get('/coach/commitments', { params: { user_id: userId } })
      .then((res) => setData(res.data))
      .catch((err) => {
        console.error('Errore caricamento impegni admin:', err);
        setError('Impossibile caricare gli impegni');
      })
      .finally(() => setLoading(false));
  }, [userId]);

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
          {(data.upcoming || []).length > 0 && (
            <DayBlock title={`Prossimi giorni (${data.upcoming.length})`} items={data.upcoming} emoji="📅" />
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
