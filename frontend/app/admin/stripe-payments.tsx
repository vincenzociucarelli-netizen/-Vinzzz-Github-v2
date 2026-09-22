import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';
import { formatCurrency } from '../../src/utils/formatCurrency';

export default function StripePaymentsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get('/admin/stripe/received-payments');
      setPayments(res.data.payments || []);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Impossibile caricare i pagamenti Stripe');
      setPayments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openReceipt = (url: string) => {
    if (!url) return;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={styles.container} data-testid="stripe-payments-page">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Pagamenti ricevuti su Stripe</Text>
          <Text style={styles.headerSubtitle}>Data, importo e cliente di ogni incasso</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator color="#635BFF" size="large" />
          <Text style={{ marginTop: 10, color: '#666' }}>Carico da Stripe…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Questi sono i pagamenti realmente incassati sul tuo account Stripe. Usali per
              risalire a incassi il cui record in app è stato eliminato: confronta data e importo.
            </Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : payments.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>💳</Text>
              <Text style={styles.emptyTitle}>Nessun pagamento Stripe</Text>
            </View>
          ) : (
            payments.map((p) => (
              <View key={p.id} style={styles.card} testID={`stripe-pay-${p.id}`}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text style={styles.date}>{p.date}</Text>
                  <Text style={styles.amount}>{formatCurrency(p.amount)}</Text>
                </View>
                {!!p.description && <Text style={styles.desc}>{p.description}</Text>}
                {!!p.customer_email && <Text style={styles.meta}>{p.customer_name ? p.customer_name + ' · ' : ''}{p.customer_email}</Text>}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  {p.refunded ? (
                    <View style={[styles.badge, { backgroundColor: '#FFEBEE' }]}>
                      <Text style={[styles.badgeText, { color: '#C62828' }]}>Rimborsato</Text>
                    </View>
                  ) : (
                    <View style={[styles.badge, { backgroundColor: '#E8F5E9' }]}>
                      <Text style={[styles.badgeText, { color: '#2E7D32' }]}>Incassato</Text>
                    </View>
                  )}
                  {!!p.receipt_url && (
                    <TouchableOpacity onPress={() => openReceipt(p.receipt_url)} testID={`receipt-${p.id}`}>
                      <Text style={styles.link}>Ricevuta Stripe →</Text>
                    </TouchableOpacity>
                  )}
                </View>
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
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#635BFF',
    paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingBottom: 16, paddingHorizontal: 14, gap: 8,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSubtitle: { color: '#D6D2FF', fontSize: 12, marginTop: 2 },
  infoBox: { backgroundColor: '#F5F3FF', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#D6D2FF' },
  infoText: { fontSize: 12, color: '#4A4A6A', lineHeight: 18 },
  errorBox: { backgroundColor: '#FFEBEE', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#FFCDD2' },
  errorText: { color: '#C62828', fontSize: 13 },
  emptyBox: { alignItems: 'center', padding: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  date: { fontSize: 13, fontWeight: '700', color: '#111827' },
  amount: { fontSize: 16, fontWeight: '800', color: '#2E7D32' },
  desc: { fontSize: 13, color: '#333', marginTop: 4 },
  meta: { fontSize: 12, color: '#777', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  link: { color: '#635BFF', fontWeight: '700', fontSize: 12 },
});
