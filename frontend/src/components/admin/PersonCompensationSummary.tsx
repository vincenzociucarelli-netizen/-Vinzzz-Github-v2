/**
 * 🆕 13/06/2026 — RIEPILOGO COMPENSI UNIFICATO (Fase 2 PRD)
 *
 * v2 (13/06/2026 mattina): Refactor per feedback PO Vincenzo
 *  A) Selettore anno RIMOSSO → mostra automaticamente AMBEDUE gli anni della stagione
 *  B1) "Anno Fiscale 2025 (1° anno)" → "Anno Fiscale 2025 — sino al 31/12/2025"
 *  B2) "Pregresso (1° anno)" → "Percepito sino al [contract_start - 1]"
 *  C1) Periodo contrattuale "Contratto: dal gg/mm/aaaa al gg/mm/aaaa" sotto ogni ruolo
 *  C2) Click su riga importo → accordion con breakdown mensile (regola Quartili)
 *
 * Endpoint: GET /api/admin/persons/{user_id}/compensation-summary?year=Y
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import api from '../../services/api';
import { Ionicons } from '../Icon';
import { formatCurrency } from '../../utils/formatCurrency';

interface PersonCompensationSummaryProps {
  personId: string;
  /** Anno fiscale corrente — default = anno corrente. La UI mostra anche Y+1 */
  initialYear?: number;
}

interface BreakdownItem {
  year?: number;
  month: number;
  amount: number;
  quartile: number;
}

interface SectionData {
  role: string;
  contract_start: string | null;
  contract_end: string | null;
  monthly_amount: number;
  ras_total: number;
  ras_breakdown?: BreakdownItem[];
  ras_calculable: boolean;
  fiscal_year: { total: number; breakdown: BreakdownItem[] };
  fiscal_year_next: { total: number; breakdown: BreakdownItem[] };
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
  coach_section?: SectionData | null;
  athlete_section?: SectionData | null;
}

// === Helpers data ===
const MONTHS_IT = [
  '', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

const isoToDdmmyyyy = (iso?: string | null): string => {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

const isoDayBefore = (iso?: string | null): string => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() - 1);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  } catch { return ''; }
};

const earliestIso = (...isos: Array<string | null | undefined>): string | null => {
  const valid = isos.filter(Boolean) as string[];
  if (!valid.length) return null;
  return valid.sort()[0];
};

const quartileLabel = (q: number) => {
  if (q === 4) return 'mese pieno';
  if (q === 3) return '3 sett./4';
  if (q === 2) return '2 sett./4';
  if (q === 1) return '1 sett./4';
  return 'fuori contratto';
};

export const PersonCompensationSummary: React.FC<PersonCompensationSummaryProps> = ({
  personId,
  initialYear,
}) => {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Stato per accordion: chiave "scope:role" (es. "ras:coach", "fy_current:athlete")
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => setExpanded(p => ({ ...p, [key]: !p[key] }));

  useEffect(() => {
    if (!personId) return;
    const startYear = initialYear || new Date().getFullYear();
    setLoading(true);
    setError(null);
    let cancelled = false;
    (async () => {
      try {
        // 1ª chiamata: prendo anno corrente e leggo earliest_first_year
        let res = await api.get(`/admin/persons/${personId}/compensation-summary`, {
          params: { year: startYear },
        });
        // Se la persona ha contratti su più anni e l'anno corrente non è il primo
        // della stagione, rifaccio la chiamata con l'anno solare di inizio contratto
        // per mostrare i 2 box rilevanti (1° e 2° anno della stagione).
        const efy = res.data?.earliest_first_year;
        if (efy && efy < startYear && !cancelled) {
          res = await api.get(`/admin/persons/${personId}/compensation-summary`, {
            params: { year: efy },
          });
        }
        if (!cancelled) setData(res.data);
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.detail || 'Errore nel caricamento');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [personId, initialYear]);

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
  if (!data || !data.has_compensation) return null;

  // === Pregresso label: "Percepito sino al [earliest_contract_start - 1]" ===
  const earliestStart = earliestIso(
    data.coach_section?.contract_start,
    data.athlete_section?.contract_start,
  );
  const priorLabel = earliestStart
    ? `Percepito sino al ${isoDayBefore(earliestStart)}`
    : 'Pregresso (primo anno)';

  const renderRoleLine = (
    section: SectionData | null | undefined,
    label: string,
    scope: 'ras' | 'fy_current' | 'fy_next',
    importToShow: number,
    breakdownSource?: BreakdownItem[],
  ) => {
    if (!section || importToShow <= 0) return null;
    const key = `${scope}:${section.role}`;
    const isOpen = !!expanded[key];
    const breakdown = (breakdownSource || []).filter(b => b.amount > 0);
    const periodLabel = `Dal ${isoToDdmmyyyy(section.contract_start)} al ${isoToDdmmyyyy(section.contract_end) || '—'}`;
    return (
      <View style={styles.roleBlock}>
        <TouchableOpacity
          style={styles.roleHeader}
          onPress={() => toggle(key)}
          testID={`${scope}-${section.role}-toggle`}
          activeOpacity={0.65}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.roleLabel}>{label}</Text>
            <Text style={styles.contractRange}>Contratto: {periodLabel}</Text>
          </View>
          <View style={styles.roleRight}>
            <Text style={styles.roleAmount}>{formatCurrency(importToShow)}</Text>
            <Ionicons
              name={isOpen ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="#777"
              style={{ marginLeft: 4 }}
            />
          </View>
        </TouchableOpacity>

        {isOpen && (
          <View style={styles.breakdownBox} testID={`${scope}-${section.role}-breakdown`}>
            {breakdown.length === 0 ? (
              <Text style={styles.breakdownEmpty}>Nessun mese nel periodo selezionato.</Text>
            ) : (
              <>
                <Text style={styles.breakdownHeader}>
                  Calcolo (regola quartili): €{section.monthly_amount.toFixed(2)}/mese × percentuale settimanale
                </Text>
                {breakdown.map((b, i) => (
                  <View key={i} style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>
                      {MONTHS_IT[b.month]} {b.year ?? ''}
                    </Text>
                    <Text style={styles.breakdownCalc}>
                      €{section.monthly_amount.toFixed(2)} × {b.quartile * 25}% ({quartileLabel(b.quartile)})
                    </Text>
                    <Text style={styles.breakdownAmount}>{formatCurrency(b.amount)}</Text>
                  </View>
                ))}
                <View style={styles.breakdownTotal}>
                  <Text style={styles.breakdownTotalLabel}>Totale</Text>
                  <Text style={styles.breakdownTotalAmount}>{formatCurrency(importToShow)}</Text>
                </View>
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderFiscalBox = (block: FiscalYearBlock | null, scope: 'fy_current' | 'fy_next') => {
    if (!block) return null;
    if (block.grand_total <= 0 && !block.is_first_year) return null;
    const titleSuffix = `sino al 31/12/${block.year}`;
    return (
      <View
        style={[styles.box, scope === 'fy_current' ? styles.boxFiscal : styles.boxFiscalNext]}
        testID={`summary-box-${scope}`}
      >
        <Text style={styles.boxTitle}>📅 Anno Fiscale {block.year}</Text>
        <Text style={styles.boxSubtitle}>{titleSuffix}</Text>

        {/* Coach */}
        {renderRoleLine(
          data.coach_section,
          'Compensi Coach/Dirigente',
          scope,
          block.coach_total,
          scope === 'fy_current'
            ? data.coach_section?.fiscal_year.breakdown
            : data.coach_section?.fiscal_year_next.breakdown,
        )}

        {/* Atleta */}
        {renderRoleLine(
          data.athlete_section,
          'Compensi Atleta PRO',
          scope,
          block.athlete_total,
          scope === 'fy_current'
            ? data.athlete_section?.fiscal_year.breakdown
            : data.athlete_section?.fiscal_year_next.breakdown,
        )}

        {/* Esterni */}
        {block.supplementary > 0 && (
          <View style={styles.simpleRow}>
            <Text style={styles.rowLabel}>Compensi esterni (altre ASD)</Text>
            <Text style={[styles.rowValue, { color: '#1565C0' }]}>{formatCurrency(block.supplementary)}</Text>
          </View>
        )}

        {/* Pregresso (con label dinamica) */}
        {block.prior_compensation > 0 && (
          <View style={styles.simpleRow}>
            <Text style={styles.rowLabel}>{priorLabel}</Text>
            <Text style={[styles.rowValue, { color: '#E65100' }]}>{formatCurrency(block.prior_compensation)}</Text>
          </View>
        )}

        <View style={styles.divider} />
        <View style={styles.simpleRow}>
          <Text style={[styles.rowLabel, styles.rowBold]}>TOTALE ANNO</Text>
          <Text
            style={[styles.rowValue, styles.rowBold, {
              color: block.exceeds_15k ? '#8E44AD' : block.exceeds_5k ? '#F57F17' : '#2E7D32',
            }]}
            testID={`${scope}-grand-total`}
          >
            {formatCurrency(block.grand_total)}
          </Text>
        </View>

        {block.exceeds_15k && (
          <View style={styles.thresholdBadge15k}>
            <Text style={styles.thresholdBadgeText}>🚨 Supera €15.000 (IRPEF)</Text>
          </View>
        )}
        {!block.exceeds_15k && block.exceeds_5k && (
          <View style={styles.thresholdBadge5k}>
            <Text style={styles.thresholdBadgeText}>⚠️ Supera €5.000 (INPS)</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container} testID="person-compensation-summary">
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>📊 Riepilogo Compensi {data.is_dual_role ? '(Doppio Ruolo)' : ''}</Text>
          <Text style={styles.subtitle}>Calcolo unificato con regola dei quartili settimanali</Text>
        </View>
      </View>

      {data.is_dual_role && (
        <View style={styles.dualBadge} testID="dual-role-badge">
          <Ionicons name="people" size={14} color="#fff" />
          <Text style={styles.dualBadgeText}>Coach + Atleta PRO — soglie cumulative</Text>
        </View>
      )}

      {/* Box RAS */}
      {data.ras_summary && (
        <View style={[styles.box, styles.boxRas]} testID="summary-box-ras">
          <Text style={styles.boxTitle}>📋 Comunicazione RAS (intero contratto)</Text>
          {!data.ras_summary.ras_calculable && (
            <Text style={styles.warning}>
              ⚠️ Date contratto incomplete: totale non calcolabile fino alla compilazione.
            </Text>
          )}

          {renderRoleLine(
            data.coach_section,
            'Compensi Coach/Dirigente',
            'ras',
            data.ras_summary.coach_total,
            data.coach_section?.ras_breakdown,
          )}

          {renderRoleLine(
            data.athlete_section,
            'Compensi Atleta PRO',
            'ras',
            data.ras_summary.athlete_total,
            data.athlete_section?.ras_breakdown,
          )}

          <View style={styles.divider} />
          <View style={styles.simpleRow}>
            <Text style={[styles.rowLabel, styles.rowBold]}>TOTALE RAS</Text>
            <Text style={[styles.rowValue, styles.rowBold, { color: '#2E7D32' }]} testID="ras-grand-total">
              {formatCurrency(data.ras_summary.grand_total)}
            </Text>
          </View>
        </View>
      )}

      {/* Box Anno Corrente */}
      {renderFiscalBox(data.fiscal_year_current, 'fy_current')}

      {/* Box Anno Successivo */}
      {renderFiscalBox(data.fiscal_year_next, 'fy_next')}

      <Text style={styles.footnote}>
        💡 Tocca una riga per vedere il dettaglio mensile. La regola dei quartili settimanali calcola
        compensi proporzionali per mesi parziali: 1 sett.=25%, 2=50%, 3=75%, 4=100%.
      </Text>
    </View>
  );
};

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
  headerRow: { marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700', color: '#1A237E' },
  subtitle: { fontSize: 11, color: '#777', marginTop: 2 },
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
  boxTitle: { fontSize: 14, fontWeight: '700', color: '#333' },
  boxSubtitle: { fontSize: 12, color: '#666', marginBottom: 8, fontStyle: 'italic' },

  // Riga ruolo (tappable per dettaglio)
  roleBlock: { marginVertical: 4 },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  roleLabel: { fontSize: 13, color: '#333', fontWeight: '500' },
  contractRange: { fontSize: 11, color: '#777', marginTop: 1 },
  roleRight: { flexDirection: 'row', alignItems: 'center' },
  roleAmount: { fontSize: 14, fontWeight: '600', color: '#222' },

  // Accordion dettaglio
  breakdownBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  breakdownHeader: { fontSize: 11, color: '#1565C0', fontWeight: '600', marginBottom: 6 },
  breakdownEmpty: { fontSize: 12, color: '#999', fontStyle: 'italic' },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  breakdownLabel: { fontSize: 12, color: '#555', minWidth: 90 },
  breakdownCalc: { fontSize: 11, color: '#888', flex: 1, paddingHorizontal: 6 },
  breakdownAmount: { fontSize: 12, color: '#333', fontWeight: '500' },
  breakdownTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#BDBDBD',
  },
  breakdownTotalLabel: { fontSize: 12, fontWeight: '700', color: '#1A237E' },
  breakdownTotalAmount: { fontSize: 13, fontWeight: '700', color: '#2E7D32' },

  // Righe semplici (esterni, pregresso, totale)
  simpleRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingHorizontal: 4 },
  rowLabel: { fontSize: 13, color: '#555', flex: 1 },
  rowValue: { fontSize: 13, fontWeight: '500' },
  rowBold: { fontSize: 15, fontWeight: '700' },

  divider: { height: 1, backgroundColor: '#BDBDBD', marginVertical: 6 },
  warning: { fontSize: 12, color: '#E65100', fontStyle: 'italic', marginBottom: 6 },

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
});

export default PersonCompensationSummary;
