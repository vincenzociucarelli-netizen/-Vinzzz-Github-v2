import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';
import { formatCurrency } from '../../src/utils/formatCurrency';

interface Row {
  id: string;
  athlete_name: string;
  team_name: string;
  amount: number;
  method: string;
  paid: boolean;
  refunded: boolean;
  recurring: boolean;
  counted: boolean;
  paid_date: string | null;
  registration_date: string | null;
  description: string;
  receipt_number: string;
}

type Filter = 'all' | 'counted' | 'excluded';

function formatDateIt(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function statusTag(r: Row): { label: string; color: string; bg: string } | null {
  if (r.refunded) return { label: 'Rimborsato', color: '#C0392B', bg: '#FDECEA' };
  if (!r.paid) return { label: 'Non pagato', color: '#E65100', bg: '#FFF3E0' };
  return null;
}

export default function IncomeDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<{ incassato: number; counted_count: number; not_counted_count: number; total_rows: number } | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/payments/income-detail');
      setRows(res.data.rows || []);
      setTotals(res.data.totals || null);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Errore nel caricamento');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'counted' && !r.counted) return false;
      if (filter === 'excluded' && r.counted) return false;
      if (q && !r.athlete_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, filter]);

  const filteredSum = useMemo(
    () => filtered.filter((r) => r.counted).reduce((s, r) => s + r.amount, 0),
    [filtered],
  );

  const exportCsv = useCallback(() => {
    const sep = ';';
    const esc = (v: any) => {
      const s = String(v ?? '');
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const num = (n: number) => (n || 0).toFixed(2).replace('.', ',');
    const header = ['Data pagamento', 'Atleta', 'Squadra', 'Descrizione', 'Metodo', 'Stato', 'Conteggiato', 'Importo', 'N. Ricevuta'];
    const lines = [header.join(sep)];
    for (const r of filtered) {
      const stato = r.refunded ? 'Rimborsato' : r.paid ? 'Pagato' : 'Non pagato';
      lines.push([
        esc(formatDateIt(r.paid_date)),
        esc(r.athlete_name),
        esc(r.team_name),
        esc(r.description),
        esc(r.method),
        esc(stato),
        esc(r.counted ? 'Sì' : 'No'),
        num(r.amount),
        esc(r.receipt_number),
      ].join(sep));
    }
    lines.push('');
    lines.push([esc('INCASSATO (conteggiato)'), '', '', '', '', '', '', num(filteredSum), ''].join(sep));
    const csv = '\ufeff' + lines.join('\n');
    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dettaglio_incassato_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [filtered, filteredSum]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="back-btn">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Dettaglio Incassato</Text>
          <Text style={styles.headerSubtitle}>Ogni pagamento e cosa fa totale</Text>
        </View>
        {Platform.OS === 'web' && (
          <TouchableOpacity onPress={exportCsv} style={styles.csvBtn} testID="export-csv-btn">
            <Ionicons name="download-outline" size={16} color="#fff" />
            <Text style={styles.csvBtnText}>CSV</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1565C0" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryBtnText}>Riprova</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Totale */}
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Incassato (somma dei conteggiati)</Text>
            <Text style={styles.totalValue}>{formatCurrency(totals?.incassato || 0)}</Text>
            <Text style={styles.totalSub}>
              {totals?.counted_count || 0} pagamenti conteggiati · {totals?.not_counted_count || 0} esclusi
            </Text>
          </View>

          {/* Ricerca */}
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Cerca per cognome / nome…"
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
              testID="income-search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Filtro */}
          <View style={styles.filterRow}>
            {([
              ['all', 'Tutti'],
              ['counted', 'Conteggiati'],
              ['excluded', 'Esclusi'],
            ] as [Filter, string][]).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[styles.filterBtn, filter === key && styles.filterBtnActive]}
                onPress={() => setFilter(key)}
                testID={`filter-${key}`}
              >
                <Text style={[styles.filterBtnText, filter === key && styles.filterBtnTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
            <Text style={styles.countCaption}>
              {filtered.length} pagamenti · conteggiati {formatCurrency(filteredSum)}
            </Text>
            {filtered.length === 0 ? (
              <Text style={styles.emptyText}>Nessun pagamento</Text>
            ) : (
              filtered.map((r) => {
                const tag = statusTag(r);
                return (
                  <View key={r.id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.rowTop}>
                        <Text style={styles.rowName}>{r.athlete_name}</Text>
                        {tag && (
                          <View style={[styles.tag, { backgroundColor: tag.bg }]}>
                            <Text style={[styles.tagText, { color: tag.color }]}>{tag.label}</Text>
                          </View>
                        )}
                        {r.recurring && (
                          <View style={[styles.tag, { backgroundColor: '#EEF4FF' }]}>
                            <Text style={[styles.tagText, { color: '#1565C0' }]}>Ricorrente</Text>
                          </View>
                        )}
                      </View>
                      {!!r.team_name && <Text style={styles.rowTeam}>{r.team_name}</Text>}
                      <Text style={styles.rowMeta}>
                        {formatDateIt(r.paid_date)} · {r.method}
                        {r.description ? ` · ${r.description}` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.amount, r.counted ? styles.amountOk : styles.amountOff]}>
                      {formatCurrency(r.amount)}
                    </Text>
                  </View>
                );
              })
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1565C0', paddingBottom: 14, paddingHorizontal: 12,
  },
  iconBtn: { padding: 6, marginRight: 6, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSubtitle: { color: '#BBDEFB', fontSize: 12, marginTop: 2 },
  csvBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#2E7D32',
    paddingHorizontal: 12, minHeight: 40, borderRadius: 8, justifyContent: 'center',
  },
  csvBtnText: { color: '#fff', fontWeight: '700', marginLeft: 6, fontSize: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errText: { color: '#C0392B', fontSize: 15, textAlign: 'center', marginBottom: 12 },
  retryBtn: { backgroundColor: '#1565C0', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { color: '#fff', fontWeight: '700' },
  totalCard: { backgroundColor: '#E8F5E9', margin: 12, marginBottom: 6, borderRadius: 12, padding: 16, alignItems: 'center' },
  totalLabel: { color: '#2E7D32', fontSize: 13, fontWeight: '600' },
  totalValue: { color: '#1B5E20', fontSize: 28, fontWeight: '800', marginTop: 2 },
  totalSub: { color: '#388E3C', fontSize: 12, marginTop: 4, fontWeight: '600' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 12,
    borderRadius: 10, paddingHorizontal: 12, minHeight: 44, borderWidth: 1, borderColor: '#E5E7EB',
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: '#111827' },
  filterRow: { flexDirection: 'row', backgroundColor: '#E5E7EB', borderRadius: 10, padding: 4, margin: 12, marginTop: 10 },
  filterBtn: { flex: 1, paddingVertical: 9, minHeight: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  filterBtnActive: { backgroundColor: '#fff' },
  filterBtnText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  filterBtnTextActive: { color: '#111827' },
  countCaption: { fontSize: 12, color: '#6B7280', marginBottom: 8, fontWeight: '600' },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 24 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rowName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  rowTeam: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  rowMeta: { fontSize: 12, color: '#374151', marginTop: 4 },
  tag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: '800' },
  amount: { fontSize: 15, fontWeight: '800', marginLeft: 10 },
  amountOk: { color: '#2E7D32' },
  amountOff: { color: '#9CA3AF', textDecorationLine: 'line-through' },
});
