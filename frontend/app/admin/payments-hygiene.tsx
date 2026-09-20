import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';
import { formatCurrency } from '../../src/utils/formatCurrency';

export default function PaymentsHygieneScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/payments/duplicates');
      setAthletes(res.data.athletes || []);
    } catch (e) {
      console.error('Errore igiene pagamenti:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const confirmDelete = (paymentId: string, label: string, amount: number) => {
    const msg = `Eliminare il record duplicato "${label}" da ${formatCurrency(amount)}? L'operazione non è reversibile.`;
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) doDelete(paymentId);
    } else {
      Alert.alert('Conferma eliminazione', msg, [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Elimina', style: 'destructive', onPress: () => doDelete(paymentId) },
      ]);
    }
  };

  const doDelete = async (paymentId: string) => {
    setDeletingId(paymentId);
    try {
      await api.delete(`/payments/${paymentId}`);
      await load();
    } catch (e) {
      console.error('Errore eliminazione pagamento:', e);
      if (Platform.OS === 'web') window.alert('Impossibile eliminare il pagamento');
      else Alert.alert('Errore', 'Impossibile eliminare il pagamento');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <View style={styles.container} data-testid="payments-hygiene-page">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Igiene dati pagamenti</Text>
          <Text style={styles.headerSubtitle}>Rate duplicate da correggere</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator color="#1565C0" size="large" />
          <Text style={{ marginTop: 10, color: '#666' }}>Analisi in corso…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Qui trovi gli atleti che hanno la stessa rata registrata più volte. La rata da mantenere
              è indicata con ✅; le duplicate con 🗑️ possono essere eliminate.
            </Text>
          </View>

          {athletes.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🎉</Text>
              <Text style={styles.emptyTitle}>Nessuna rata duplicata</Text>
              <Text style={styles.emptyText}>I dati dei pagamenti sono puliti.</Text>
            </View>
          ) : (
            athletes.map((a) => (
              <View key={a.athlete_id} style={styles.card} testID={`dup-athlete-${a.athlete_id}`}>
                <Text style={styles.athleteName}>{a.athlete_name}</Text>
                {!!a.team_name && <Text style={styles.teamName}>{a.team_name}</Text>}
                {a.groups.map((g: any, gi: number) => (
                  <View key={gi} style={styles.group}>
                    <Text style={styles.groupLabel}>{g.label} — {g.count} volte</Text>
                    {g.records.map((r: any) => (
                      <View key={r.id} style={styles.recordRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recordName}>
                            {r.suggested_delete ? '🗑️ ' : '✅ '}{r.name}
                          </Text>
                          <Text style={styles.recordMeta}>
                            {formatCurrency(r.amount)} · {r.paid ? 'Pagata' : 'Non pagata'}
                          </Text>
                        </View>
                        {r.suggested_delete ? (
                          <TouchableOpacity
                            style={[styles.delBtn, deletingId === r.id && { opacity: 0.5 }]}
                            disabled={deletingId === r.id}
                            onPress={() => confirmDelete(r.id, r.name, r.amount)}
                            testID={`delete-${r.id}`}
                          >
                            {deletingId === r.id ? (
                              <ActivityIndicator color="#fff" size="small" />
                            ) : (
                              <Text style={styles.delBtnText}>Elimina</Text>
                            )}
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.keepBadge}>
                            <Text style={styles.keepBadgeText}>Mantieni</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA' },
  header: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1565C0',
    paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingBottom: 16, paddingHorizontal: 14, gap: 8,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSubtitle: { color: '#BBDEFB', fontSize: 12, marginTop: 2 },
  infoBox: { backgroundColor: '#FFF8E1', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FFE082' },
  infoText: { fontSize: 12, color: '#795548', lineHeight: 18 },
  emptyBox: { alignItems: 'center', padding: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  emptyText: { fontSize: 13, color: '#666', marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#eee' },
  athleteName: { fontSize: 16, fontWeight: '800', color: '#111827' },
  teamName: { fontSize: 12, color: '#666', marginTop: 2 },
  group: { marginTop: 10, backgroundColor: '#FAFAFA', borderRadius: 8, padding: 8 },
  groupLabel: { fontSize: 12, fontWeight: '700', color: '#C62828', marginBottom: 6 },
  recordRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  recordName: { fontSize: 13, color: '#333', fontWeight: '600' },
  recordMeta: { fontSize: 11, color: '#777', marginTop: 2 },
  delBtn: { backgroundColor: '#C62828', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, minWidth: 74, alignItems: 'center' },
  delBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  keepBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  keepBadgeText: { color: '#2E7D32', fontWeight: '700', fontSize: 11 },
});
