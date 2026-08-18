import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/services/api';

interface Row {
  id: string;
  full_name: string;
  team_id: string | null;
  team_name: string;
  original_received: boolean;
  certificate_verified: boolean;
  has_certificate: boolean;
  original_received_at?: string | null;
  original_received_by_name?: string | null;
}

type Tab = 'pending' | 'received';
type SortMode = 'name' | 'team';

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return '';
  }
}

export default function CertificateOriginalsScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('pending');
  const [sortMode, setSortMode] = useState<SortMode>('name');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const resp = await api.get('/admin/athletes/certificate-originals');
      setRows(resp.data.athletes || []);
    } catch (error: any) {
      showAlert('Errore', error?.response?.data?.detail || 'Impossibile caricare l\u2019elenco');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleOriginal = async (row: Row) => {
    const newVal = !row.original_received;
    setUpdatingId(row.id);
    try {
      await api.patch(`/admin/athletes/${row.id}/certificate-original`, { original_received: newVal });
      // Aggiorna localmente
      setRows((prev) => prev.map((r) => r.id === row.id ? {
        ...r,
        original_received: newVal,
        original_received_at: newVal ? new Date().toISOString() : null,
      } : r));
    } catch (error: any) {
      showAlert('Errore', error?.response?.data?.detail || 'Errore aggiornamento');
    } finally {
      setUpdatingId(null);
    }
  };

  const receivedCount = rows.filter((r) => r.original_received).length;
  const pendingCount = rows.length - receivedCount;

  const visible = rows.filter((r) => tab === 'received' ? r.original_received : !r.original_received);
  const sorted = [...visible].sort((a, b) => {
    if (sortMode === 'team') {
      const t = (a.team_name || '').localeCompare(b.team_name || '', 'it');
      if (t !== 0) return t;
    }
    return (a.full_name || '').localeCompare(b.full_name || '', 'it');
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="cert-originals-back-btn">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Copie Originali Certificati</Text>
          <Text style={styles.headerSubtitle}>Chi ha consegnato l&apos;originale cartaceo (obbligo FIPAV)</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          testID="tab-pending"
          style={[styles.tab, tab === 'pending' && styles.tabActivePending]}
          onPress={() => setTab('pending')}
        >
          <Text style={[styles.tabText, tab === 'pending' && styles.tabTextActive]}>
            Da consegnare ({pendingCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="tab-received"
          style={[styles.tab, tab === 'received' && styles.tabActiveReceived]}
          onPress={() => setTab('received')}
        >
          <Text style={[styles.tabText, tab === 'received' && styles.tabTextActive]}>
            Già consegnato ({receivedCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sort */}
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Ordina per:</Text>
        <TouchableOpacity
          testID="sort-name"
          style={[styles.sortChip, sortMode === 'name' && styles.sortChipActive]}
          onPress={() => setSortMode('name')}
        >
          <Ionicons name="person-outline" size={13} color={sortMode === 'name' ? '#1976D2' : '#666'} />
          <Text style={[styles.sortChipText, sortMode === 'name' && styles.sortChipTextActive]}>Nome</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="sort-team"
          style={[styles.sortChip, sortMode === 'team' && styles.sortChipActive]}
          onPress={() => setSortMode('team')}
        >
          <Ionicons name="people-outline" size={13} color={sortMode === 'team' ? '#1976D2' : '#666'} />
          <Text style={[styles.sortChipText, sortMode === 'team' && styles.sortChipTextActive]}>Squadra</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#1976D2" /></View>
      ) : (
        <ScrollView
          style={styles.body}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {sorted.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                {tab === 'pending' ? 'Nessun atleta in attesa: tutti hanno consegnato l\u2019originale \ud83c\udf89' : 'Nessun originale ancora consegnato.'}
              </Text>
            </View>
          ) : (
            sorted.map((r) => (
              <View key={r.id} style={styles.row} testID={`cert-orig-row-${r.id}`}>
                <TouchableOpacity style={styles.rowInfo} onPress={() => router.push(`/admin/athlete/${r.id}`)}>
                  <Text style={styles.rowName}>{r.full_name}</Text>
                  <View style={styles.rowMeta}>
                    <Ionicons name="people-outline" size={12} color="#888" />
                    <Text style={styles.rowTeam}>{r.team_name}</Text>
                    {!r.has_certificate && (
                      <Text style={styles.noCert}>· senza certificato</Text>
                    )}
                  </View>
                  {r.original_received && r.original_received_at ? (
                    <Text style={styles.rowSub}>Consegnato il {formatDate(r.original_received_at)}</Text>
                  ) : null}
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`cert-orig-toggle-${r.id}`}
                  style={[styles.actionBtn, r.original_received ? styles.actionReceived : styles.actionPending]}
                  onPress={() => toggleOriginal(r)}
                  disabled={updatingId === r.id}
                >
                  {updatingId === r.id ? (
                    <ActivityIndicator size="small" color={r.original_received ? '#1565C0' : '#E65100'} />
                  ) : (
                    <>
                      <Ionicons
                        name={r.original_received ? 'checkmark-circle' : 'ellipse-outline'}
                        size={16}
                        color={r.original_received ? '#1565C0' : '#E65100'}
                      />
                      <Text style={[styles.actionText, { color: r.original_received ? '#1565C0' : '#E65100' }]}>
                        {r.original_received ? 'Consegnato' : 'Segna consegna'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1976D2',
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
  },
  backBtn: { marginRight: 12, padding: 4 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  headerSubtitle: { color: '#E3F2FD', fontSize: 12, marginTop: 2 },
  tabsRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActivePending: { borderBottomColor: '#EF6C00' },
  tabActiveReceived: { borderBottomColor: '#1565C0' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#888' },
  tabTextActive: { color: '#333' },
  sortRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  sortLabel: { fontSize: 12, color: '#666' },
  sortChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd',
  },
  sortChipActive: { backgroundColor: '#E3F2FD', borderColor: '#90CAF9' },
  sortChipText: { fontSize: 12, color: '#666', fontWeight: '600' },
  sortChipTextActive: { color: '#1976D2' },
  body: { flex: 1, paddingHorizontal: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyBox: { padding: 30, alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 14, textAlign: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 10, padding: 12, marginTop: 8,
    borderWidth: 1, borderColor: '#eee',
  },
  rowInfo: { flex: 1, paddingRight: 8 },
  rowName: { fontSize: 15, fontWeight: '600', color: '#222' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  rowTeam: { fontSize: 12, color: '#888' },
  noCert: { fontSize: 11, color: '#C62828', fontStyle: 'italic' },
  rowSub: { fontSize: 11, color: '#1565C0', marginTop: 3 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, minWidth: 118, justifyContent: 'center',
  },
  actionPending: { backgroundColor: '#FFF3E0', borderColor: '#FFB74D' },
  actionReceived: { backgroundColor: '#E3F2FD', borderColor: '#42A5F5' },
  actionText: { fontSize: 12, fontWeight: '600' },
});
