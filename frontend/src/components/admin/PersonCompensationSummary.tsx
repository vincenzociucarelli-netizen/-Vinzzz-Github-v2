/**
 * 🆕 13/06/2026 — RIEPILOGO COMPENSI UNIFICATO (Fase 2 PRD)
 *
 * Componente Admin-only che mostra 3 box per persona dual-role:
 *  1. 📊 Comunicazione RAS — totale intero contratto (regola quartili settimanali)
 *  2. 📅 Anno Fiscale Corrente — proiezione anno solare + esterni + pregresso
 *  3. 📅 Anno Fiscale Successivo — proiezione anno Y+1
 *
 * Endpoint: GET /api/admin/persons/{user_id}/compensation-summary?year=Y
 *
 * Montato in:
 *   - /app/frontend/app/admin/coach/[id].tsx
 *   - /app/frontend/app/admin/athlete/[id].tsx
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import api from '../../services/api';
import { Ionicons } from '../Icon';
import { formatCurrency } from '../../utils/formatCurrency';

interface PersonCompensationSummaryProps {
  /** user_id (coach/dirigente/collaboratore) OR athlete_id — il backend risolve entrambi */
  personId: string;
  /** Anno fiscale corrente. Default = anno corrente */
  initialYear?: number;
  /** Mostra il bottone di refresh */
  showRefresh?: boolean;
}

interface FiscalYearBlock {
  year: number;
  coach_total: number;
  athlete_total: number;
  supplementary: number;
  prior_compensation: number;
  is_first_year: boolean;
  grand_total: number;
  exceeds_5k: boolean;
  exceeds_15k: boolean;
}

interface SummaryData {
  user_id: string | null;
  athlete_id: string | null;
  person_name: string;
  year: number;
  year_next: number;
  is_dual_role: boolean;
  has_compensation: boolean;
  unified_prior_compensation?: number;
  earliest_first_year?: number | null;
  ras_summary: {
    coach_total: number;
    athlete_total: number;
    supplementary: number;
    grand_total: number;
    ras_calculable: boolean;
  } | null;
  fiscal_year_current: FiscalYearBlock | null;
  fiscal_year_next: FiscalYearBlock | null;
  coach_section?: any;
  athlete_section?: any;
}

export const PersonCompensationSummary: React.FC<PersonCompensationSummaryProps> = ({
  personId,
  initialYear,
  showRefresh = true,
}) => {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState<number>(initialYear || new Date().getFullYear());

  const fetchSummary = async (targetYear: number) => {
    if (!personId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/admin/persons/${personId}/compensation-summary`, {
        params: { year: targetYear },
      });
      setData(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Errore nel caricamento del riepilogo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, year]);

  if (loading) {
    return (
      <View style={styles.loadingContainer} testID="person-compensation-summary-loading">
        <ActivityIndicator size="small" color="#1976D2" />
        <Text style={styles.loadingText}>Caricamento riepilogo compensi...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer} testID="person-compensation-summary-error">
        <Ionicons name="alert-circle" size={18} color="#C62828" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!data || !data.has_compensation) {
    return null;
  }

  return (
    <View style={styles.container} testID="person-compensation-summary">
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>📊 Riepilogo Compensi {data.is_dual_role ? '(Doppio Ruolo)' : ''}</Text>
          <Text style={styles.subtitle}>
            Calcolo unificato con regola dei quartili settimanali
          </Text>
        </View>
        <View style={styles.yearSwitch}>
          <TouchableOpacity
            onPress={() => setYear(year - 1)}
            style={styles.yearBtn}
            testID="summary-year-prev"
          >
            <Ionicons name="chevron-back" size={16} color="#1565C0" />
          </TouchableOpacity>
          <Text style={styles.yearLabel}>{year}</Text>
          <TouchableOpacity
            onPress={() => setYear(year + 1)}
            style={styles.yearBtn}
            testID="summary-year-next"
          >
            <Ionicons name="chevron-forward" size={16} color="#1565C0" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Dual-role badge */}
      {data.is_dual_role && (
        <View style={styles.dualBadge} testID="dual-role-badge">
          <Ionicons name="people" size={14} color="#fff" />
          <Text style={styles.dualBadgeText}>
            Coach + Atleta PRO — soglie cumulative
          </Text>
        </View>
      )}

      {/* Box 1: Comunicazione RAS */}
      {data.ras_summary && (
        <View style={[styles.box, styles.boxRas]} testID="summary-box-ras">
          <Text style={styles.boxTitle}>📋 Comunicazione RAS (intero contratto)</Text>
          {!data.ras_summary.ras_calculable && (
            <Text style={styles.warning}>
              ⚠️ Date contratto incomplete: totale non calcolabile fino alla compilazione.
            </Text>
          )}
          {data.ras_summary.coach_total > 0 && (
            <Row label="Compensi Coach/Dirigente" value={data.ras_summary.coach_total} />
          )}
          {data.ras_summary.athlete_total > 0 && (
            <Row label="Compensi Atleta PRO" value={data.ras_summary.athlete_total} />
          )}
          {data.ras_summary.supplementary > 0 && (
            <Row label="Somme supplementari" value={data.ras_summary.supplementary} color="#1565C0" />
          )}
          <View style={styles.divider} />
          <Row
            label="TOTALE RAS"
            value={data.ras_summary.grand_total}
            bold
            color="#2E7D32"
            testID="ras-grand-total"
          />
        </View>
      )}

      {/* Box 2: Anno Fiscale Corrente */}
      {data.fiscal_year_current && (
        <View style={[styles.box, styles.boxFiscal]} testID="summary-box-fiscal-current">
          <Text style={styles.boxTitle}>
            📅 Anno Fiscale {data.fiscal_year_current.year} {data.fiscal_year_current.is_first_year && '(1° anno)'}
          </Text>
          {data.fiscal_year_current.coach_total > 0 && (
            <Row label="Compensi Coach/Dirigente" value={data.fiscal_year_current.coach_total} />
          )}
          {data.fiscal_year_current.athlete_total > 0 && (
            <Row label="Compensi Atleta PRO" value={data.fiscal_year_current.athlete_total} />
          )}
          {data.fiscal_year_current.supplementary > 0 && (
            <Row
              label="Compensi esterni (altre ASD)"
              value={data.fiscal_year_current.supplementary}
              color="#1565C0"
            />
          )}
          {data.fiscal_year_current.prior_compensation > 0 && (
            <Row
              label="Pregresso (1° anno)"
              value={data.fiscal_year_current.prior_compensation}
              color="#E65100"
            />
          )}
          <View style={styles.divider} />
          <Row
            label="TOTALE ANNO"
            value={data.fiscal_year_current.grand_total}
            bold
            color={
              data.fiscal_year_current.exceeds_15k
                ? '#8E44AD'
                : data.fiscal_year_current.exceeds_5k
                ? '#F57F17'
                : '#2E7D32'
            }
            testID="fiscal-current-grand-total"
          />
          {data.fiscal_year_current.exceeds_15k && (
            <View style={styles.thresholdBadge15k}>
              <Text style={styles.thresholdBadgeText}>🚨 Supera €15.000 (IRPEF)</Text>
            </View>
          )}
          {!data.fiscal_year_current.exceeds_15k && data.fiscal_year_current.exceeds_5k && (
            <View style={styles.thresholdBadge5k}>
              <Text style={styles.thresholdBadgeText}>⚠️ Supera €5.000 (INPS)</Text>
            </View>
          )}
        </View>
      )}

      {/* Box 3: Anno Fiscale Successivo */}
      {data.fiscal_year_next && data.fiscal_year_next.grand_total > 0 && (
        <View style={[styles.box, styles.boxFiscalNext]} testID="summary-box-fiscal-next">
          <Text style={styles.boxTitle}>
            📅 Anno Fiscale {data.fiscal_year_next.year} {data.fiscal_year_next.is_first_year && '(1° anno)'}
          </Text>
          {data.fiscal_year_next.coach_total > 0 && (
            <Row label="Compensi Coach/Dirigente" value={data.fiscal_year_next.coach_total} />
          )}
          {data.fiscal_year_next.athlete_total > 0 && (
            <Row label="Compensi Atleta PRO" value={data.fiscal_year_next.athlete_total} />
          )}
          {data.fiscal_year_next.supplementary > 0 && (
            <Row
              label="Compensi esterni (altre ASD)"
              value={data.fiscal_year_next.supplementary}
              color="#1565C0"
            />
          )}
          {data.fiscal_year_next.prior_compensation > 0 && (
            <Row
              label="Pregresso (1° anno)"
              value={data.fiscal_year_next.prior_compensation}
              color="#E65100"
            />
          )}
          <View style={styles.divider} />
          <Row
            label="TOTALE ANNO"
            value={data.fiscal_year_next.grand_total}
            bold
            color={
              data.fiscal_year_next.exceeds_15k
                ? '#8E44AD'
                : data.fiscal_year_next.exceeds_5k
                ? '#F57F17'
                : '#2E7D32'
            }
            testID="fiscal-next-grand-total"
          />
          {data.fiscal_year_next.exceeds_15k && (
            <View style={styles.thresholdBadge15k}>
              <Text style={styles.thresholdBadgeText}>🚨 Supera €15.000 (IRPEF)</Text>
            </View>
          )}
          {!data.fiscal_year_next.exceeds_15k && data.fiscal_year_next.exceeds_5k && (
            <View style={styles.thresholdBadge5k}>
              <Text style={styles.thresholdBadgeText}>⚠️ Supera €5.000 (INPS)</Text>
            </View>
          )}
        </View>
      )}

      <Text style={styles.footnote}>
        💡 La regola dei quartili settimanali calcola compensi proporzionali per mesi parziali:
        1 sett. = 25%, 2 = 50%, 3 = 75%, 4 = 100%.
      </Text>

      {showRefresh && (
        <TouchableOpacity
          onPress={() => fetchSummary(year)}
          style={styles.refreshBtn}
          testID="summary-refresh-btn"
        >
          <Ionicons name="refresh" size={14} color="#1565C0" />
          <Text style={styles.refreshText}>Aggiorna</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const Row: React.FC<{
  label: string;
  value: number;
  color?: string;
  bold?: boolean;
  testID?: string;
}> = ({ label, value, color = '#333', bold = false, testID }) => (
  <View style={styles.row}>
    <Text style={[styles.rowLabel, bold && styles.rowBold]}>{label}</Text>
    <Text
      style={[styles.rowValue, { color }, bold && styles.rowBold]}
      testID={testID}
    >
      {formatCurrency(value)}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  loadingText: { color: '#666', fontSize: 13 },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    gap: 8,
    marginVertical: 8,
  },
  errorText: { color: '#C62828', fontSize: 13, flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: '700', color: '#1A237E' },
  subtitle: { fontSize: 11, color: '#777', marginTop: 2 },
  yearSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  yearBtn: { padding: 4 },
  yearLabel: { fontSize: 14, fontWeight: '600', color: '#1565C0', minWidth: 50, textAlign: 'center' },
  dualBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3F51B5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 10,
    gap: 6,
  },
  dualBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  box: {
    borderRadius: 10,
    padding: 12,
    marginVertical: 6,
    borderWidth: 1,
  },
  boxRas: { backgroundColor: '#F1F8E9', borderColor: '#AED581' },
  boxFiscal: { backgroundColor: '#FFF8E1', borderColor: '#FFD54F' },
  boxFiscalNext: { backgroundColor: '#E1F5FE', borderColor: '#81D4FA' },
  boxTitle: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  rowLabel: { fontSize: 13, color: '#555', flex: 1 },
  rowValue: { fontSize: 13, fontWeight: '500' },
  rowBold: { fontSize: 15, fontWeight: '700' },
  divider: {
    height: 1,
    backgroundColor: '#BDBDBD',
    marginVertical: 6,
  },
  warning: {
    fontSize: 12,
    color: '#E65100',
    fontStyle: 'italic',
    marginBottom: 6,
  },
  thresholdBadge5k: {
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FF9800',
    borderRadius: 6,
    padding: 6,
    marginTop: 8,
    alignItems: 'center',
  },
  thresholdBadge15k: {
    backgroundColor: '#F3E5F5',
    borderWidth: 1,
    borderColor: '#9C27B0',
    borderRadius: 6,
    padding: 6,
    marginTop: 8,
    alignItems: 'center',
  },
  thresholdBadgeText: { fontSize: 12, fontWeight: '700', color: '#333' },
  footnote: {
    fontSize: 11,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 10,
    lineHeight: 16,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  refreshText: { fontSize: 12, color: '#1565C0', fontWeight: '600' },
});

export default PersonCompensationSummary;
