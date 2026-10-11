/**
 * 🆕 Riepilogo Incassi (Admin)
 * Totali effettivamente incassati raggruppati per metodo di pagamento
 * (Contanti, Bonifico, Stripe, POS, …) con dettaglio mese per mese.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';
import { formatCurrency } from '../../src/utils/formatCurrency';

interface MethodRow { method: string; group: string; count: number; paid: number; refunded: number; net: number; share: number }
interface MonthRow { month: string; count: number; paid: number; refunded: number; net: number; methods: { method: string; net: number }[] }
interface Summary {
  totals: { count: number; total_paid: number; total_refunded: number; net: number };
  methods: MethodRow[];
  months: MonthRow[];
}

const GROUP_META: Record<string, { color: string; icon: any }> = {
  cash: { color: '#2E7D32', icon: 'cash' },
  bank_transfer: { color: '#1565C0', icon: 'sync' },
  stripe: { color: '#6A1B9A', icon: 'card' },
  other: { color: '#EF6C00', icon: 'wallet' },
};

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const PRESETS = [
  { key: 'all', label: 'Tutto' },
  { key: 'month', label: 'Questo mese' },
  { key: 'prev_month', label: 'Mese scorso' },
  { key: 'year', label: 'Anno solare' },
  { key: 'custom', label: 'Personalizzato' },
];

const monthLabel = (ym: string) => {
  if (!ym || ym === '—') return 'Senza data';
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  const s = d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export default function IncomeSummaryScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Summary | null>(null);
  const [preset, setPreset] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [openMonth, setOpenMonth] = useState<Record<string, boolean>>({});

  const applyPreset = (key: string) => {
    setPreset(key);
    const now = new Date();
    if (key === 'all') { setDateFrom(''); setDateTo(''); }
    else if (key === 'month') {
      setDateFrom(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
      setDateTo(iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    } else if (key === 'prev_month') {
      setDateFrom(iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
      setDateTo(iso(new Date(now.getFullYear(), now.getMonth(), 0)));
    } else if (key === 'year') {
      setDateFrom(`${now.getFullYear()}-01-01`);
      setDateTo(`${now.getFullYear()}-12-31`);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await api.get('/admin/payments/income-summary', { params });
      setData(res.data);
    } catch (e: any) {
      console.error('Errore riepilogo incassi:', e);
      setError(e?.response?.data?.detail || 'Impossibile caricare il riepilogo incassi');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (preset === 'custom' && (dateFrom.length !== 10 && dateFrom !== '' || dateTo.length !== 10 && dateTo !== '')) return;
    load();
  }, [load, preset, dateFrom, dateTo]);

  const totals = data?.totals;

  return (
    <View style={styles.container} data-testid="income-summary-page">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Riepilogo Incassi</Text>
          <Text style={styles.headerSubtitle}>Totali per metodo di pagamento</Text>
        </View>
        <Ionicons name="pie-chart" size={24} color="#fff" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Periodo */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {PRESETS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[styles.chip, preset === p.key && styles.chipActive]}
              onPress={() => applyPreset(p.key)}
              testID={`preset-${p.key}`}
            >
              <Text style={[styles.chipText, preset === p.key && styles.chipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {preset === 'custom' && (
          <View style={styles.dateRow}>
            <TextInput
              style={styles.dateInput}
              placeholder="Dal (AAAA-MM-GG)"
              value={dateFrom}
              onChangeText={setDateFrom}
              placeholderTextColor="#9E9E9E"
              testID="date-from"
            />
            <TextInput
              style={styles.dateInput}
              placeholder="Al (AAAA-MM-GG)"
              value={dateTo}
              onChangeText={setDateTo}
              placeholderTextColor="#9E9E9E"
              testID="date-to"
            />
          </View>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#2E7D32" size="large" />
            <Text style={styles.muted}>Calcolo in corso…</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle" size={40} color="#C62828" />
            <Text style={styles.muted}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={load} testID="retry-btn">
              <Text style={styles.retryText}>Riprova</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Totale */}
            <View style={styles.totalCard} testID="total-card">
              <Text style={styles.totalLbl}>Incassato netto</Text>
              <Text style={styles.totalNum}>{formatCurrency(totals?.net || 0)}</Text>
              <View style={styles.totalMetaRow}>
                <Text style={styles.totalMeta}>{totals?.count || 0} pagamenti</Text>
                <Text style={styles.totalMeta}>Lordo {formatCurrency(totals?.total_paid || 0)}</Text>
                {(totals?.total_refunded || 0) > 0 && (
                  <Text style={[styles.totalMeta, { color: '#FFCDD2' }]}>Rimborsi −{formatCurrency(totals?.total_refunded || 0)}</Text>
                )}
              </View>
            </View>

            {/* Per metodo */}
            <Text style={styles.sectionTitle}>Per metodo di pagamento</Text>
            {(data?.methods || []).length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="file-tray-outline" size={36} color="#90A4AE" />
                <Text style={styles.muted}>Nessun incasso nel periodo selezionato.</Text>
              </View>
            ) : (
              data!.methods.map((m) => {
                const meta = GROUP_META[m.group] || GROUP_META.other;
                return (
                  <View key={m.method} style={styles.methodCard} testID={`method-${m.group}`}>
                    <View style={styles.methodHead}>
                      <View style={[styles.methodIcon, { backgroundColor: meta.color + '1A' }]}>
                        <Ionicons name={meta.icon} size={20} color={meta.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.methodName}>{m.method}</Text>
                        <Text style={styles.methodMeta}>
                          {m.count} pagament{m.count === 1 ? 'o' : 'i'}
                          {m.refunded > 0 ? ` · rimborsi −${formatCurrency(m.refunded)}` : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.methodAmount, { color: meta.color }]}>{formatCurrency(m.net)}</Text>
                        <Text style={styles.methodShare}>{m.share}%</Text>
                      </View>
                    </View>
                    <View style={styles.barBg}>
                      <View style={[styles.barFill, { width: `${Math.min(100, m.share)}%`, backgroundColor: meta.color }]} />
                    </View>
                  </View>
                );
              })
            )}

            {/* Per mese */}
            {(data?.months || []).length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Dettaglio mensile</Text>
                {data!.months.map((mo) => {
                  const isOpen = !!openMonth[mo.month];
                  return (
                    <View key={mo.month} style={styles.monthCard} testID={`month-${mo.month}`}>
                      <TouchableOpacity
                        style={styles.monthHead}
                        onPress={() => setOpenMonth((o) => ({ ...o, [mo.month]: !o[mo.month] }))}
                        activeOpacity={0.7}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.monthName}>{monthLabel(mo.month)}</Text>
                          <Text style={styles.methodMeta}>{mo.count} pagament{mo.count === 1 ? 'o' : 'i'}</Text>
                        </View>
                        <Text style={styles.monthAmount}>{formatCurrency(mo.net)}</Text>
                        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#90A4AE" />
                      </TouchableOpacity>
                      {isOpen && (
                        <View style={styles.monthMethods}>
                          {mo.methods.map((mm) => (
                            <View key={mm.method} style={styles.monthMethodRow}>
                              <Text style={styles.monthMethodName}>{mm.method}</Text>
                              <Text style={styles.monthMethodAmt}>{formatCurrency(mm.net)}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA' },
  header: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#2E7D32',
    paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingBottom: 16, paddingHorizontal: 14, gap: 8,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSubtitle: { color: '#C8E6C9', fontSize: 12, marginTop: 2 },
  chips: { gap: 8, paddingBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E0E0', minHeight: 40, justifyContent: 'center' },
  chipActive: { backgroundColor: '#2E7D32', borderColor: '#2E7D32' },
  chipText: { fontSize: 13, color: '#455A64', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  dateRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  dateInput: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#263238', minHeight: 44 },
  center: { padding: 40, alignItems: 'center' },
  muted: { marginTop: 10, color: '#666', fontSize: 13, textAlign: 'center' },
  retryBtn: { marginTop: 14, backgroundColor: '#2E7D32', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700' },
  totalCard: { backgroundColor: '#1B5E20', borderRadius: 16, padding: 18, marginBottom: 16 },
  totalLbl: { color: '#C8E6C9', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  totalNum: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 4 },
  totalMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  totalMeta: { color: '#C8E6C9', fontSize: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#78909C', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 },
  emptyBox: { alignItems: 'center', padding: 30, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#eee' },
  methodCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  methodHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  methodIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  methodName: { fontSize: 15, fontWeight: '700', color: '#263238' },
  methodMeta: { fontSize: 12, color: '#78909C', marginTop: 2 },
  methodAmount: { fontSize: 17, fontWeight: '800' },
  methodShare: { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  barBg: { height: 6, backgroundColor: '#ECEFF1', borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  monthCard: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#eee', overflow: 'hidden' },
  monthHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, minHeight: 56 },
  monthName: { fontSize: 15, fontWeight: '700', color: '#263238' },
  monthAmount: { fontSize: 16, fontWeight: '800', color: '#2E7D32' },
  monthMethods: { borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingHorizontal: 12, paddingVertical: 6 },
  monthMethodRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
  monthMethodName: { fontSize: 13, color: '#546E7A' },
  monthMethodAmt: { fontSize: 13, fontWeight: '700', color: '#263238' },
});
