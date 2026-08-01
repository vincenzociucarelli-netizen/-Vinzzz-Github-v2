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
  date: string;
  athlete_id: string;
  athlete_name: string;
  team_name: string;
  description: string;
  method: string;
  status: string;
  amount: number;
  paid_amount: number;
  refund_amount: number;
  refund_reason: string;
  receipt_number: string;
  stripe_payment_intent: string;
}

const STATUS_OPTIONS = [
  { key: 'all', label: 'Tutti' },
  { key: 'paid', label: 'Pagati' },
  { key: 'partial', label: 'Parziali' },
  { key: 'pending', label: 'In attesa' },
  { key: 'unpaid', label: 'Non pagati' },
  { key: 'refunded', label: 'Rimborsati' },
];

const METHOD_OPTIONS = [
  { key: 'all', label: 'Tutti' },
  { key: 'stripe', label: 'Stripe' },
  { key: 'cash', label: 'Contanti' },
  { key: 'bank_transfer', label: 'Bonifico' },
  { key: 'other', label: 'Altro' },
];

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  paid: { label: 'Pagato', bg: '#E8F5E9', fg: '#2E7D32' },
  partial: { label: 'Parziale', bg: '#FFF3E0', fg: '#E65100' },
  pending: { label: 'In attesa', bg: '#ECEFF1', fg: '#546E7A' },
  unpaid: { label: 'Non pagato', bg: '#FDECEA', fg: '#C0392B' },
  refunded: { label: 'Rimborsato', bg: '#F3E5F5', fg: '#7B1FA2' },
};

const METHOD_LABEL: Record<string, string> = {
  stripe: 'Stripe (Carta)',
  cash: 'Contanti',
  bank_transfer: 'Bonifico',
  other: 'Altro',
};

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

export default function PaymentsHistoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState({ count: 0, total_amount: 0, total_paid: 0, total_refunded: 0 });

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState('all');
  const [method, setMethod] = useState('all');
  const [athleteQuery, setAthleteQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { status, method };
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await api.get('/admin/payments/history', { params });
      setRows(res.data.rows || []);
      setTotals(res.data.totals || { count: 0, total_amount: 0, total_paid: 0, total_refunded: 0 });
    } catch (e: any) {
      console.error('Errore storico pagamenti:', e);
      setError('Impossibile caricare lo storico pagamenti');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, status, method]);

  useEffect(() => {
    load();
  }, [load]);

  // Filtro atleta lato client (ricerca per nome)
  const filteredRows = useMemo(() => {
    const q = athleteQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => (r.athlete_name || '').toLowerCase().includes(q));
  }, [rows, athleteQuery]);

  const clientTotals = useMemo(() => {
    let amount = 0, paid = 0, refunded = 0;
    for (const r of filteredRows) {
      amount += r.amount || 0;
      if (r.status === 'paid' || r.status === 'partial') paid += r.paid_amount || 0;
      refunded += r.refund_amount || 0;
    }
    return { count: filteredRows.length, total_amount: amount, total_paid: paid, total_refunded: refunded };
  }, [filteredRows]);

  const setPreset = (preset: 'all' | 'year' | 'month') => {
    const now = new Date();
    if (preset === 'all') {
      setDateFrom(''); setDateTo('');
    } else if (preset === 'year') {
      setDateFrom(`${now.getFullYear()}-01-01`);
      setDateTo(`${now.getFullYear()}-12-31`);
    } else if (preset === 'month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      setDateFrom(iso(first)); setDateTo(iso(last));
    }
  };

  const exportCsv = () => {
    const sep = ';';
    const esc = (v: any) => {
      const s = String(v ?? '');
      if (s.includes(sep) || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const num = (n: number) => (n || 0).toFixed(2).replace('.', ',');
    const header = ['Data', 'Atleta', 'Squadra', 'Descrizione', 'Metodo', 'Stato', 'Importo', 'Incassato', 'Rimborsato', 'Motivo Rimborso', 'N. Ricevuta', 'ID Transazione'];
    const lines = [header.join(sep)];
    for (const r of filteredRows) {
      lines.push([
        esc(fmtDate(r.date)),
        esc(r.athlete_name),
        esc(r.team_name),
        esc(r.description),
        esc(METHOD_LABEL[r.method] || r.method),
        esc(STATUS_META[r.status]?.label || r.status),
        num(r.amount),
        num(r.paid_amount),
        num(r.refund_amount),
        esc(r.refund_reason),
        esc(r.receipt_number),
        esc(r.stripe_payment_intent),
      ].join(sep));
    }
    // Riga totali
    lines.push('');
    lines.push([esc('TOTALI'), '', '', '', '', '', num(clientTotals.total_amount), num(clientTotals.total_paid), num(clientTotals.total_refunded), '', '', ''].join(sep));

    const csv = '\ufeff' + lines.join('\n');
    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `storico_pagamenti_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <View style={styles.container} data-testid="payments-history-page">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="back-btn" data-testid="back-btn">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Storico Pagamenti</Text>
          <Text style={styles.headerSubtitle}>Contabilità · filtri e export CSV</Text>
        </View>
        <TouchableOpacity
          onPress={exportCsv}
          style={[styles.exportBtn, filteredRows.length === 0 && { opacity: 0.5 }]}
          disabled={filteredRows.length === 0}
          testID="export-csv-btn"
          data-testid="export-csv-btn"
        >
          <Ionicons name="download-outline" size={16} color="#fff" />
          <Text style={styles.exportBtnText}>CSV</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
        {/* Filtri */}
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
              <TextInput
                style={styles.dateInput}
                value={dateFrom}
                onChangeText={setDateFrom}
                placeholder="AAAA-MM-GG"
                placeholderTextColor="#aaa"
                testID="date-from-input"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.smallLabel}>Al</Text>
              <TextInput
                style={styles.dateInput}
                value={dateTo}
                onChangeText={setDateTo}
                placeholder="AAAA-MM-GG"
                placeholderTextColor="#aaa"
                testID="date-to-input"
              />
            </View>
          </View>

          <Text style={[styles.filterLabel, { marginTop: 14 }]}>Stato</Text>
          <View style={styles.chipsWrap}>
            {STATUS_OPTIONS.map(o => (
              <TouchableOpacity
                key={o.key}
                style={[styles.chip, status === o.key && styles.chipActive]}
                onPress={() => setStatus(o.key)}
                testID={`status-${o.key}`}
              >
                <Text style={[styles.chipText, status === o.key && styles.chipTextActive]}>{o.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.filterLabel, { marginTop: 14 }]}>Metodo</Text>
          <View style={styles.chipsWrap}>
            {METHOD_OPTIONS.map(o => (
              <TouchableOpacity
                key={o.key}
                style={[styles.chip, method === o.key && styles.chipActive]}
                onPress={() => setMethod(o.key)}
                testID={`method-${o.key}`}
              >
                <Text style={[styles.chipText, method === o.key && styles.chipTextActive]}>{o.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.filterLabel, { marginTop: 14 }]}>Atleta</Text>
          <TextInput
            style={styles.dateInput}
            value={athleteQuery}
            onChangeText={setAthleteQuery}
            placeholder="Cerca per cognome / nome…"
            placeholderTextColor="#aaa"
            testID="athlete-search-input"
          />
        </View>

        {/* Riepilogo */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryBox, { backgroundColor: '#E3F2FD' }]}>
            <Text style={styles.summaryValue} data-testid="summary-count">{clientTotals.count}</Text>
            <Text style={styles.summaryLabel}>Movimenti</Text>
          </View>
          <View style={[styles.summaryBox, { backgroundColor: '#E8F5E9' }]}>
            <Text style={styles.summaryValue} data-testid="summary-paid">{formatCurrency(clientTotals.total_paid)}</Text>
            <Text style={styles.summaryLabel}>Incassato</Text>
          </View>
          <View style={[styles.summaryBox, { backgroundColor: '#F3E5F5' }]}>
            <Text style={styles.summaryValue} data-testid="summary-refunded">{formatCurrency(clientTotals.total_refunded)}</Text>
            <Text style={styles.summaryLabel}>Rimborsato</Text>
          </View>
        </View>

        {/* Lista */}
        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator color="#1565C0" size="large" />
            <Text style={{ marginTop: 10, color: '#666' }}>Caricamento…</Text>
          </View>
        ) : error ? (
          <View style={styles.card}>
            <Text style={{ color: '#C0392B', textAlign: 'center', marginBottom: 10 }}>{error}</Text>
            <TouchableOpacity onPress={load} style={styles.retryBtn} testID="retry-btn" data-testid="retry-btn">
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', marginLeft: 6 }}>Riprova</Text>
            </TouchableOpacity>
          </View>
        ) : filteredRows.length === 0 ? (
          <View style={styles.card}>
            <Text style={{ color: '#888', textAlign: 'center', fontStyle: 'italic' }}>
              Nessun pagamento trovato con i filtri selezionati.
            </Text>
          </View>
        ) : (
          filteredRows.map((r) => {
            const meta = STATUS_META[r.status] || STATUS_META.unpaid;
            return (
              <View key={r.id} style={styles.rowCard} data-testid={`payment-row-${r.id}`}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Text style={styles.rowAthlete}>{r.athlete_name}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: meta.fg }]}>{meta.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.rowDesc} numberOfLines={1}>
                    {r.description || 'Rata'}{r.team_name ? ` · ${r.team_name}` : ''}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {fmtDate(r.date)} · {METHOD_LABEL[r.method] || r.method}
                    {r.refund_amount > 0 ? ` · rimborso ${formatCurrency(r.refund_amount)}` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.rowAmount}>{formatCurrency(r.amount)}</Text>
                  {r.status === 'partial' && (
                    <Text style={styles.rowPartial}>incassato {formatCurrency(r.paid_amount)}</Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1565C0', paddingTop: 44, paddingBottom: 14, paddingHorizontal: 12,
  },
  backBtn: { padding: 6, marginRight: 6 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSubtitle: { color: '#BBDEFB', fontSize: 12, marginTop: 2 },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#2E7D32',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  exportBtnText: { color: '#fff', fontWeight: '700', marginLeft: 6, fontSize: 13 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  filterLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  smallLabel: { fontSize: 11, color: '#6B7280', marginBottom: 4 },
  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  presetChip: { backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  presetChipText: { color: '#3730A3', fontSize: 12, fontWeight: '600' },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateInput: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 14, color: '#111827', backgroundColor: '#fff',
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#F1F3F5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: 'transparent' },
  chipActive: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  chipText: { fontSize: 12, color: '#495057', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  summaryBox: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  summaryValue: { fontSize: 16, fontWeight: '800', color: '#111827' },
  summaryLabel: { fontSize: 11, color: '#555', marginTop: 2 },
  rowCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10,
    padding: 12, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  rowAthlete: { fontSize: 14, fontWeight: '700', color: '#111827', marginRight: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  rowDesc: { fontSize: 12, color: '#4B5563', marginTop: 3 },
  rowMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  rowAmount: { fontSize: 15, fontWeight: '800', color: '#111827' },
  rowPartial: { fontSize: 10, color: '#E65100', marginTop: 2 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1565C0', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, alignSelf: 'center',
  },
});
