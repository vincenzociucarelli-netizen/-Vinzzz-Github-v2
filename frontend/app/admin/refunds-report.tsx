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
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';
import { formatCurrency } from '../../src/utils/formatCurrency';

interface Row {
  id: string;
  payment_id: string;
  date: string;
  athlete_name: string;
  team_name: string;
  description: string;
  amount: number;
  reason: string;
  admin_email: string;
}

const fmtDate = (iso: string): string => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
};

export default function RefundsReportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [athleteQuery, setAthleteQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await api.get('/admin/payments/refunds', { params });
      setRows(res.data.rows || []);
    } catch (e: any) {
      console.error('Errore report rimborsi:', e);
      setError('Impossibile caricare il report rimborsi');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const q = athleteQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => (r.athlete_name || '').toLowerCase().includes(q));
  }, [rows, athleteQuery]);

  const totals = useMemo(() => {
    let amount = 0;
    for (const r of filteredRows) amount += r.amount || 0;
    return { count: filteredRows.length, total: amount };
  }, [filteredRows]);

  const setPreset = (preset: 'all' | 'year' | 'month') => {
    const now = new Date();
    if (preset === 'all') { setDateFrom(''); setDateTo(''); }
    else if (preset === 'year') { setDateFrom(`${now.getFullYear()}-01-01`); setDateTo(`${now.getFullYear()}-12-31`); }
    else {
      const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      setDateFrom(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
      setDateTo(iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    }
  };

  const exportCsv = () => {
    const sep = ';';
    const esc = (v: any) => {
      const s = String(v ?? '');
      return (s.includes(sep) || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const num = (n: number) => (n || 0).toFixed(2).replace('.', ',');
    const header = ['Data', 'Atleta', 'Squadra', 'Descrizione', 'Importo Rimborsato', 'Motivo', 'Admin'];
    const lines = [header.join(sep)];
    for (const r of filteredRows) {
      lines.push([esc(fmtDate(r.date)), esc(r.athlete_name), esc(r.team_name), esc(r.description), num(r.amount), esc(r.reason), esc(r.admin_email)].join(sep));
    }
    lines.push('');
    lines.push([esc('TOTALE'), '', '', '', num(totals.total), '', ''].join(sep));
    const csv = '\ufeff' + lines.join('\n');
    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_rimborsi_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <View style={styles.container} testID="refunds-report-page">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Report Rimborsi</Text>
          <Text style={styles.headerSubtitle}>Rimborsi Stripe · motivo, data e admin</Text>
        </View>
        <TouchableOpacity
          onPress={exportCsv}
          style={[styles.exportBtn, filteredRows.length === 0 && { opacity: 0.5 }]}
          disabled={filteredRows.length === 0}
          testID="export-csv-btn"
        >
          <Ionicons name="download-outline" size={16} color="#fff" />
          <Text style={styles.exportBtnText}>CSV</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
        <View style={styles.card}>
          <Text style={styles.filterLabel}>Periodo</Text>
          <View style={styles.presetRow}>
            <TouchableOpacity style={styles.presetChip} onPress={() => setPreset('all')} testID="preset-all">
              <Text style={styles.presetChipText}>Tutto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => setPreset('year')} testID="preset-year">
              <Text style={styles.presetChipText}>Anno {new Date().getFullYear()}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => setPreset('month')} testID="preset-month">
              <Text style={styles.presetChipText}>Questo mese</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.smallLabel}>Dal</Text>
              <TextInput style={styles.input} value={dateFrom} onChangeText={setDateFrom} placeholder="AAAA-MM-GG" placeholderTextColor="#aaa" testID="date-from-input" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.smallLabel}>Al</Text>
              <TextInput style={styles.input} value={dateTo} onChangeText={setDateTo} placeholder="AAAA-MM-GG" placeholderTextColor="#aaa" testID="date-to-input" />
            </View>
          </View>
          <Text style={[styles.filterLabel, { marginTop: 14 }]}>Atleta</Text>
          <TextInput style={styles.input} value={athleteQuery} onChangeText={setAthleteQuery} placeholder="Cerca per cognome / nome…" placeholderTextColor="#aaa" testID="athlete-search-input" />
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryBox, { backgroundColor: '#F3E5F5' }]}>
            <Text style={styles.summaryValue} testID="summary-count">{totals.count}</Text>
            <Text style={styles.summaryLabel}>Rimborsi</Text>
          </View>
          <View style={[styles.summaryBox, { backgroundColor: '#EDE7F6' }]}>
            <Text style={styles.summaryValue} testID="summary-total">{formatCurrency(totals.total)}</Text>
            <Text style={styles.summaryLabel}>Totale rimborsato</Text>
          </View>
        </View>

        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator color="#7B1FA2" size="large" />
            <Text style={{ marginTop: 10, color: '#666' }}>Caricamento…</Text>
          </View>
        ) : error ? (
          <View style={styles.card}>
            <Text style={{ color: '#C0392B', textAlign: 'center', marginBottom: 10 }}>{error}</Text>
            <TouchableOpacity onPress={load} style={styles.retryBtn} testID="retry-btn">
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', marginLeft: 6 }}>Riprova</Text>
            </TouchableOpacity>
          </View>
        ) : filteredRows.length === 0 ? (
          <View style={styles.card}>
            <Text style={{ color: '#888', textAlign: 'center', fontStyle: 'italic' }}>
              Nessun rimborso trovato con i filtri selezionati.
            </Text>
          </View>
        ) : (
          filteredRows.map((r) => (
            <View key={r.id} style={styles.rowCard} testID={`refund-row-${r.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowAthlete}>{r.athlete_name}</Text>
                <Text style={styles.rowDesc} numberOfLines={1}>
                  {r.description || 'Rata'}{r.team_name ? ` · ${r.team_name}` : ''}
                </Text>
                {!!r.reason && <Text style={styles.rowReason} numberOfLines={2}>Motivo: {r.reason}</Text>}
                <Text style={styles.rowMeta}>
                  {fmtDate(r.date)}{r.admin_email ? ` · ${r.admin_email}` : ''}
                </Text>
              </View>
              <Text style={styles.rowAmount}>-{formatCurrency(r.amount)}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9' },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#7B1FA2', paddingTop: 44, paddingBottom: 14, paddingHorizontal: 12 },
  backBtn: { padding: 6, marginRight: 6 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSubtitle: { color: '#E1BEE7', fontSize: 12, marginTop: 2 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2E7D32', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  exportBtnText: { color: '#fff', fontWeight: '700', marginLeft: 6, fontSize: 13 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  filterLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  smallLabel: { fontSize: 11, color: '#6B7280', marginBottom: 4 },
  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  presetChip: { backgroundColor: '#F3E5F5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  presetChipText: { color: '#6A1B9A', fontSize: 12, fontWeight: '600' },
  dateRow: { flexDirection: 'row', gap: 10 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: '#111827', backgroundColor: '#fff' },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  summaryBox: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  summaryValue: { fontSize: 16, fontWeight: '800', color: '#4A148C' },
  summaryLabel: { fontSize: 11, color: '#555', marginTop: 2 },
  rowCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#7B1FA2', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  rowAthlete: { fontSize: 14, fontWeight: '700', color: '#111827' },
  rowDesc: { fontSize: 12, color: '#4B5563', marginTop: 3 },
  rowReason: { fontSize: 12, color: '#6A1B9A', marginTop: 3, fontStyle: 'italic' },
  rowMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 3 },
  rowAmount: { fontSize: 15, fontWeight: '800', color: '#7B1FA2', marginLeft: 8 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#7B1FA2', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, alignSelf: 'center' },
});
