import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/services/api';

const MONTH_NAMES = ['', 'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const MONTH_NAMES_FULL = ['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount || 0);

const formatDate = (isoString?: string | null) => {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

const ROLE_LABEL: Record<string, string> = {
  coach: '🏐 Coach',
  dirigente: '🏅 Dirigente',
  collaboratore: '👤 Collaboratore',
  atleta_pro: '🏆 Atleta Pro',
};

type Declaration = {
  month: number | null;
  amount: number;
  declared_none: boolean;
  declared_at?: string | null;
};

type InternalMonth = { month: number; amount_gross: number };

type Row = {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  external_total: number;
  external_declarations_count: number;
  internal_total: number;
  internal_months_count: number;
  prior_compensation: number;
  total_cumulative: number;
  exceeded_5000: boolean;
  exceeded_15000: boolean;
  declarations: Declaration[];
  internal_months: InternalMonth[];
};

export default function ExternalCompensationsPage() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [onlyWithExternal, setOnlyWithExternal] = useState<boolean>(true);
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { year, only_with_external: onlyWithExternal };
      if (roleFilter) params.role = roleFilter;
      const res = await api.get('/admin/external-compensations/summary', { params });
      setRows(res.data?.rows || []);
    } catch (e: any) {
      console.error('Load external compensations summary error', e);
      Alert.alert(
        'Errore',
        e?.response?.data?.detail || e?.message || 'Impossibile caricare il riepilogo',
      );
    } finally {
      setLoading(false);
    }
  }, [year, onlyWithExternal, roleFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCSV = () => {
    if (!rows.length) {
      Alert.alert('Nessun dato', 'Non ci sono righe da esportare.');
      return;
    }
    const header = [
      'Cognome Nome',
      'Email',
      'Ruolo',
      'N° Dichiarazioni',
      'Totale Esterno (€)',
      'Totale Interno (€)',
      'Prior Compensation (€)',
      'Totale Cumulativo (€)',
      'Superata €5.000',
      'Superata €15.000',
    ];
    const lines = [header.join(';')];
    rows.forEach((r) => {
      lines.push(
        [
          `"${(r.full_name || '').replace(/"/g, '""')}"`,
          `"${(r.email || '').replace(/"/g, '""')}"`,
          r.role || '',
          r.external_declarations_count,
          r.external_total.toFixed(2).replace('.', ','),
          r.internal_total.toFixed(2).replace('.', ','),
          r.prior_compensation.toFixed(2).replace('.', ','),
          r.total_cumulative.toFixed(2).replace('.', ','),
          r.exceeded_5000 ? 'SI' : 'NO',
          r.exceeded_15000 ? 'SI' : 'NO',
        ].join(';'),
      );
    });
    const csv = '\uFEFF' + lines.join('\r\n'); // BOM per Excel italiano
    try {
      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `compensi_esterni_${year}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        Alert.alert('Export', 'Funzione di export disponibile solo da web.');
      }
    } catch (e: any) {
      Alert.alert('Errore export', e?.message || 'Errore durante l\'export CSV');
    }
  };

  // Totali aggregati per il riepilogo a fondo pagina
  const totals = rows.reduce(
    (acc, r) => {
      acc.external += r.external_total;
      acc.internal += r.internal_total;
      acc.cumulative += r.total_cumulative;
      acc.users += 1;
      if (r.exceeded_5000) acc.over5k += 1;
      if (r.exceeded_15000) acc.over15k += 1;
      return acc;
    },
    { external: 0, internal: 0, cumulative: 0, users: 0, over5k: 0, over15k: 0 },
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          data-testid="external-comp-back-btn"
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🏢 Compensi Esterni</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Filtri */}
        <View style={styles.filtersCard}>
          <Text style={styles.sectionTitle}>Filtri</Text>

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Anno</Text>
            <View style={styles.yearSwitcher}>
              <TouchableOpacity
                style={styles.yearBtn}
                onPress={() => setYear((y) => y - 1)}
                data-testid="year-prev-btn"
              >
                <Ionicons name="chevron-back" size={20} color="#1F2937" />
              </TouchableOpacity>
              <Text style={styles.yearValue}>{year}</Text>
              <TouchableOpacity
                style={styles.yearBtn}
                onPress={() => setYear((y) => y + 1)}
                data-testid="year-next-btn"
              >
                <Ionicons name="chevron-forward" size={20} color="#1F2937" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Solo chi ha compensi esterni</Text>
            <Switch
              value={onlyWithExternal}
              onValueChange={setOnlyWithExternal}
              data-testid="only-external-switch"
            />
          </View>

          <View style={[styles.filterRow, { flexWrap: 'wrap', gap: 6 }]}>
            <Text style={[styles.filterLabel, { width: '100%' }]}>Ruolo</Text>
            {['', 'coach', 'dirigente', 'collaboratore', 'atleta_pro'].map((r) => {
              const active = roleFilter === r;
              const label = r === '' ? 'Tutti' : ROLE_LABEL[r] || r;
              return (
                <TouchableOpacity
                  key={r || 'all'}
                  style={[styles.rolePill, active && styles.rolePillActive]}
                  onPress={() => setRoleFilter(r)}
                  data-testid={`role-filter-${r || 'all'}`}
                >
                  <Text style={[styles.rolePillText, active && styles.rolePillTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.reloadBtn]}
              onPress={load}
              data-testid="reload-btn"
            >
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Aggiorna</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.exportBtn]}
              onPress={exportCSV}
              data-testid="export-csv-btn"
            >
              <Ionicons name="download" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Export CSV</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Loading / Empty */}
        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Caricamento riepilogo {year}...</Text>
          </View>
        )}
        {!loading && rows.length === 0 && (
          <View style={styles.center}>
            <Text style={{ fontSize: 36 }}>🌱</Text>
            <Text style={styles.emptyTitle}>Nessuna dichiarazione</Text>
            <Text style={styles.emptySubtitle}>
              Nessuno ha dichiarato compensi esterni nel {year}
              {onlyWithExternal ? ' (filtro attivo)' : ''}.
            </Text>
          </View>
        )}

        {/* Lista utenti */}
        {!loading && rows.length > 0 && (
          <View style={{ paddingHorizontal: 12 }}>
            {rows.map((r) => {
              const expanded = expandedUserId === r.user_id;
              return (
                <View key={r.user_id} style={styles.userCard} data-testid={`user-row-${r.user_id}`}>
                  <TouchableOpacity
                    style={styles.userHeader}
                    onPress={() => setExpandedUserId(expanded ? null : r.user_id)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userName} numberOfLines={1}>
                        {r.full_name || r.email}
                      </Text>
                      <Text style={styles.userEmail} numberOfLines={1}>
                        {r.email} · {ROLE_LABEL[r.role] || r.role}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.userTotal}>{formatCurrency(r.total_cumulative)}</Text>
                      <Text style={styles.userSubTotal}>
                        Est. {formatCurrency(r.external_total)}
                      </Text>
                    </View>
                    <Ionicons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color="#6B7280"
                      style={{ marginLeft: 8 }}
                    />
                  </TouchableOpacity>

                  {/* Badges soglie */}
                  <View style={styles.badgeRow}>
                    {r.exceeded_15000 ? (
                      <View style={[styles.badge, styles.badge15k]}>
                        <Text style={styles.badgeText}>🚨 Superato €15.000</Text>
                      </View>
                    ) : r.exceeded_5000 ? (
                      <View style={[styles.badge, styles.badge5k]}>
                        <Text style={styles.badgeText}>⚠️ Superato €5.000</Text>
                      </View>
                    ) : (
                      <View style={[styles.badge, styles.badgeOk]}>
                        <Text style={styles.badgeText}>✓ Sotto soglia</Text>
                      </View>
                    )}
                    <Text style={styles.declCount}>
                      {r.external_declarations_count} dich. · {r.internal_months_count} quietanze
                    </Text>
                  </View>

                  {expanded && (
                    <View style={styles.expandedSection}>
                      {/* Breakdown numerico */}
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Quietanze firmate (interno)</Text>
                        <Text style={styles.breakdownValue}>{formatCurrency(r.internal_total)}</Text>
                      </View>
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Compensi esterni (altre ASD)</Text>
                        <Text style={styles.breakdownValue}>{formatCurrency(r.external_total)}</Text>
                      </View>
                      {r.prior_compensation > 0 && (
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>
                            Compensi pregressi (1° anno contratto)
                          </Text>
                          <Text style={styles.breakdownValue}>
                            {formatCurrency(r.prior_compensation)}
                          </Text>
                        </View>
                      )}
                      <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                        <Text style={styles.breakdownLabelBold}>TOTALE CUMULATIVO</Text>
                        <Text style={styles.breakdownValueBold}>
                          {formatCurrency(r.total_cumulative)}
                        </Text>
                      </View>

                      {/* Timeline dichiarazioni esterni */}
                      {r.declarations.length > 0 && (
                        <View style={{ marginTop: 12 }}>
                          <Text style={styles.timelineTitle}>📅 Dichiarazioni mensili</Text>
                          {r.declarations.map((d, idx) => (
                            <View key={idx} style={styles.timelineRow}>
                              <Text style={styles.timelineMonth}>
                                {d.month ? MONTH_NAMES_FULL[d.month] : '—'}
                              </Text>
                              <Text style={styles.timelineAmount}>
                                {d.declared_none
                                  ? '— Nessun compenso esterno'
                                  : formatCurrency(d.amount)}
                              </Text>
                              <Text style={styles.timelineDate}>{formatDate(d.declared_at)}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Quietanze firmate per mese */}
                      {r.internal_months.length > 0 && (
                        <View style={{ marginTop: 12 }}>
                          <Text style={styles.timelineTitle}>💰 Quietanze firmate</Text>
                          <View style={styles.monthsGrid}>
                            {r.internal_months.map((m, idx) => (
                              <View key={idx} style={styles.monthChip}>
                                <Text style={styles.monthChipMonth}>{MONTH_NAMES[m.month]}</Text>
                                <Text style={styles.monthChipAmount}>
                                  {formatCurrency(m.amount_gross)}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}

            {/* Footer Totali */}
            <View style={styles.footerCard}>
              <Text style={styles.footerTitle}>📊 Riepilogo {year}</Text>
              <View style={styles.footerRow}>
                <Text style={styles.footerLabel}>Utenti con dichiarazioni</Text>
                <Text style={styles.footerValue}>{totals.users}</Text>
              </View>
              <View style={styles.footerRow}>
                <Text style={styles.footerLabel}>Totale esterni</Text>
                <Text style={styles.footerValue}>{formatCurrency(totals.external)}</Text>
              </View>
              <View style={styles.footerRow}>
                <Text style={styles.footerLabel}>Totale interni</Text>
                <Text style={styles.footerValue}>{formatCurrency(totals.internal)}</Text>
              </View>
              <View style={[styles.footerRow, styles.footerTotal]}>
                <Text style={styles.footerLabelBold}>Totale cumulativo</Text>
                <Text style={styles.footerValueBold}>{formatCurrency(totals.cumulative)}</Text>
              </View>
              <View style={styles.footerRow}>
                <Text style={styles.footerLabel}>Sopra €5.000</Text>
                <Text style={styles.footerValue}>{totals.over5k}</Text>
              </View>
              <View style={styles.footerRow}>
                <Text style={styles.footerLabel}>Sopra €15.000</Text>
                <Text style={styles.footerValue}>{totals.over15k}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { padding: 4, width: 32 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1F2937', textAlign: 'center' },
  filtersCard: {
    margin: 12,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8 },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  filterLabel: { fontSize: 14, color: '#4B5563' },
  yearSwitcher: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  yearBtn: {
    padding: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  yearValue: { fontSize: 16, fontWeight: '700', color: '#1F2937', paddingHorizontal: 10 },
  rolePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  rolePillActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  rolePillText: { fontSize: 12, color: '#4B5563' },
  rolePillTextActive: { color: '#FFFFFF', fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  reloadBtn: { backgroundColor: '#6B7280' },
  exportBtn: { backgroundColor: '#059669' },
  actionBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 8, color: '#6B7280' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginTop: 8 },
  emptySubtitle: { fontSize: 13, color: '#6B7280', marginTop: 4, textAlign: 'center', paddingHorizontal: 24 },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  userHeader: { flexDirection: 'row', alignItems: 'center' },
  userName: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  userEmail: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  userTotal: { fontSize: 15, fontWeight: '800', color: '#1F2937' },
  userSubTotal: { fontSize: 11, color: '#D97706', marginTop: 2 },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badge5k: { backgroundColor: '#FEF3C7' },
  badge15k: { backgroundColor: '#FEE2E2' },
  badgeOk: { backgroundColor: '#D1FAE5' },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#1F2937' },
  declCount: { fontSize: 11, color: '#6B7280' },
  expandedSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  breakdownLabel: { fontSize: 12, color: '#4B5563' },
  breakdownValue: { fontSize: 12, color: '#1F2937', fontWeight: '600' },
  breakdownTotal: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
    marginTop: 4,
  },
  breakdownLabelBold: { fontSize: 13, color: '#1F2937', fontWeight: '700' },
  breakdownValueBold: { fontSize: 14, color: '#1F2937', fontWeight: '800' },
  timelineTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  timelineMonth: { width: 80, fontSize: 12, color: '#4B5563', fontWeight: '600' },
  timelineAmount: { flex: 1, fontSize: 12, color: '#1F2937', fontWeight: '600' },
  timelineDate: { fontSize: 11, color: '#9CA3AF' },
  monthsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  monthChip: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 64,
  },
  monthChipMonth: { fontSize: 10, color: '#1D4ED8', fontWeight: '700' },
  monthChipAmount: { fontSize: 11, color: '#1F2937', fontWeight: '600', marginTop: 2 },
  footerCard: {
    marginTop: 16,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  footerTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 10 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  footerLabel: { fontSize: 13, color: '#4B5563' },
  footerValue: { fontSize: 13, color: '#1F2937', fontWeight: '600' },
  footerLabelBold: { fontSize: 14, color: '#1F2937', fontWeight: '700' },
  footerValueBold: { fontSize: 15, color: '#1F2937', fontWeight: '800' },
  footerTotal: { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 8, marginTop: 4 },
});
